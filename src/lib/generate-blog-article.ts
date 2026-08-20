import fs from "node:fs";
import path from "node:path";
import {
  bodyToGhostHtml,
  fetchGhostPost,
  ghostPostHref,
  isGhostConfigured,
  listPublishedGhostPosts,
  listPublishedGhostPostsForSeo,
  publishToGhost,
  updateGhostPostHtml,
  type GhostPostMeta,
} from "@/lib/ghost";
import {
  articleMatchesExisting,
  buildUncoveredPillarPromptBlock,
  filterTrendsForExisting,
  formatTrendListForPrompt,
  hasRecentBlogPublish,
} from "@/lib/blog-dedup";
import { BLOG_TOPICS, getBlogTopicBySlug, topicGuideForPrompt } from "@/lib/blog-topics";
import { ensureGhostSiteSeo } from "@/lib/ensure-ghost-seo";
import {
  wrapJsonLdFootInjection,
  buildBlogPostingJsonLd,
  buildJsonLdScriptTag,
  buildMetaTitle,
} from "@/lib/ghost-seo";
import {
  getBlogAiModel,
  getBlogImageModel,
  getOpenRouterApiKey,
  openRouterHeaders,
  OPENROUTER_API_URL,
} from "@/lib/openrouter-config";
import { isSupabaseStorageConfigured, uploadBlogCoverImage } from "@/lib/supabase-storage";
import { getEnv } from "@/lib/store";

const GOOGLE_TRENDS_RSS = "https://trends.google.com/trending/rss?geo=US";

export type TrendingTopic = {
  topic: string;
  newsUrls: string[];
};

export type GeneratedBlogArticle = {
  title: string;
  content: string;
  excerpt: string;
  metaDescription: string;
  slug: string;
  primaryKeyword: string;
  sourceUrls: string[];
  category: string | null;
  tags: string[];
};

export type BlogPublishResult = {
  success: boolean;
  skipped?: boolean;
  title?: string;
  slug?: string;
  url?: string;
  featureImage?: string | null;
  backlinkedSlugs?: string[];
  error?: string;
};

function loadBrandVoice(): string {
  const brandVoicePath = path.join(process.cwd(), "config", "brand-voice.md");
  return fs.existsSync(brandVoicePath) ? fs.readFileSync(brandVoicePath, "utf8") : "";
}

function stripOuterCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:\w+)?\s*\n?([\s\S]*?)\n?```$/);
  return match ? match[1].trim() : trimmed;
}

function cleanMetaValue(value: string): string {
  return value.replace(/^\*+\s*|\s*\*+$/g, "").trim();
}

function extractMetaField(meta: string, key: string): string {
  const m = meta.match(new RegExp(`^${key}:\\s*(.+)$`, "im"));
  return m ? cleanMetaValue(m[1]) : "";
}

/** Normalize AI output — models often omit ---END--- or return markdown instead of HTML. */
function parseStructuredAiResponse(rawText: string): { meta: string; articleBody: string } | null {
  const text = stripOuterCodeFence(rawText);

  const articleParts = text.split(/---ARTICLE---/i);
  if (articleParts.length >= 2) {
    const meta = articleParts[0]
      .replace(/^(?:---META---|\*\*META\*\*)\s*/im, "")
      .trim();
    const articleBody = articleParts
      .slice(1)
      .join("---ARTICLE---")
      .replace(/---END---[\s\S]*$/i, "")
      .trim();

    if (articleBody.length > 100) {
      return { meta, articleBody };
    }
  }

  const metaMatch = text.match(/(?:---META---|\*\*META\*\*)\s*([\s\S]*?)---ARTICLE---/i);
  const articleMatch =
    text.match(/---ARTICLE---([\s\S]*?)---END---/i) ??
    text.match(/---ARTICLE---([\s\S]*?)$/i);

  if (metaMatch && articleMatch) {
    return { meta: metaMatch[1].trim(), articleBody: articleMatch[1].trim() };
  }

  const title = extractMetaField(text, "TITLE");
  if (title) {
    const bodyStart = text.search(/---ARTICLE---/i);
    if (bodyStart !== -1) {
      const meta = text.slice(0, bodyStart).replace(/^(?:---META---|\*\*META\*\*)\s*/im, "").trim();
      const articleBody = text
        .slice(bodyStart)
        .replace(/^---ARTICLE---\s*/i, "")
        .replace(/---END---[\s\S]*$/i, "")
        .trim();
      if (articleBody.length > 100) return { meta, articleBody };
    }
  }

  return null;
}

function normalizeArticleHtml(articleBody: string): string {
  let content = stripOuterCodeFence(articleBody);

  // Unwrap ```html fences inside the article block
  const htmlFence = content.match(/^```(?:html)?\s*\n?([\s\S]*?)\n?```$/i);
  if (htmlFence) content = htmlFence[1].trim();

  if (/<[a-z][\s\S]*>/i.test(content)) {
    const firstTagIndex = content.indexOf("<");
    if (firstTagIndex > 0) content = content.substring(firstTagIndex);
    const lastClosingTag = content.lastIndexOf(">");
    if (lastClosingTag !== -1 && lastClosingTag < content.length - 1) {
      content = content.substring(0, lastClosingTag + 1);
    }
    return content;
  }

  // Model returned markdown — convert for Ghost
  return bodyToGhostHtml(content);
}

function titleFromMarkdown(body: string): string | null {
  const match = body.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

export async function fetchTrendingTopics(): Promise<TrendingTopic[]> {
  try {
    const res = await fetch(GOOGLE_TRENDS_RSS, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const xml = await res.text();
    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const results: TrendingTopic[] = [];

    for (const block of itemBlocks) {
      let topic = "";
      const cdataMatch = block.match(/<title><!\[CDATA\[(.+?)\]\]><\/title>/);
      const plainMatch = block.match(/<title>([^<]+)<\/title>/);
      if (cdataMatch) topic = cdataMatch[1];
      else if (plainMatch && plainMatch[1] !== "Daily Search Trends") topic = plainMatch[1];
      if (!topic) continue;

      const newsUrlMatches = [...block.matchAll(/<ht:news_item_url>([^<]+)<\/ht:news_item_url>/g)];
      const newsUrls = newsUrlMatches.map((m) => m[1].trim()).filter(Boolean);
      results.push({ topic, newsUrls });
    }

    if (results.length === 0) {
      const titleRegex = /<title><!\[CDATA\[(.+?)\]\]><\/title>/g;
      const titleRegex2 = /<title>([^<]+)<\/title>/g;
      let match: RegExpExecArray | null;
      while ((match = titleRegex.exec(xml)) !== null) {
        results.push({ topic: match[1], newsUrls: [] });
      }
      while ((match = titleRegex2.exec(xml)) !== null) {
        const topic = match[1];
        if (topic !== "Daily Search Trends" && !results.some((r) => r.topic === topic)) {
          results.push({ topic, newsUrls: [] });
        }
      }
    }

    return results.slice(0, 20);
  } catch (err) {
    console.error("[blog-cron] Failed to fetch Google Trends:", err);
    return [];
  }
}

const SYSTEM_PROMPT = `You are an elite SEO strategist, expert editor, and authoritative writing coach for Smart Book Planner (smartbookplanner.com) — a book planning app for novelists, memoirists, and researchers.

Your mission is to create a high-quality article of 1200–1800 words that can realistically rank on Google, attract organic traffic, and help writers plan and finish manuscripts.

You will receive today's Google Trends topics (with news source URLs). Pick ONE trend and reframe it for writers/authors — or fall back to an uncovered content-pillar query when no trend fits. Do NOT write generic news recaps or geopolitical/finance analysis.

Do NOT write generic AI filler. Make smart assumptions based on search intent and competitor gaps.

WRITING STYLE:
- Warm, knowledgeable fellow writer — not hype SaaS bro
- Never promise "AI writes your bestseller"
- Short paragraphs, scannable H2/H3 structure
- Practical advice with concrete examples
- Avoid: "delve into", "unlock", "game-changer", "comprehensive guide"
- Do NOT reference today's date or "as of" qualifiers

SEO STRUCTURE:
- Short direct answer near the top
- Key takeaways (bullet list)
- Clear H2/H3 sections, FAQ, conclusion with CTA to smartbookplanner.com
- Mention Smart Book Planner naturally once near the end

OUTPUT FORMAT — follow exactly:
---META---
TITLE: [SEO title with primary keyword]
META_DESCRIPTION: [150–160 chars]
SLUG: [url-friendly-slug-without-date]
PRIMARY_KEYWORD: [main target keyword]
CATEGORY: [one of: craft-fiction | research-academia | ai-done-right | build-in-public | publishing-marketing | general]
TAGS: [comma-separated Ghost tags, 2–4 tags]
EXCERPT: [1–2 sentence summary]
SOURCE_URLS: [comma-separated authoritative URLs referenced]
---ARTICLE---
[Full article as clean HTML. No <html>/<head>/<body>. No H1. Use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <a> only.]
---END---`;

async function callAI(
  trends: TrendingTopic[],
  linkCandidates: { title: string; slug: string }[],
  existingTitles: string[],
  pillarFallbackBlock: string,
  apiKey: string,
  model: string
): Promise<GeneratedBlogArticle | null> {
  const brandVoice = loadBrandVoice();
  const topicList = formatTrendListForPrompt(trends);

  const internalLinksSection =
    linkCandidates.length > 0
      ? `\nINTERNAL LINKING: Where topically natural, weave in 2–3 inline links to existing articles. Use exact HTML: <a href="${ghostPostHref("{slug}")}">{descriptive anchor text}</a> (replace {slug} with the slug below).\n\nExisting articles:\n${linkCandidates.map((p) => `- ${p.title} → slug: ${p.slug}`).join("\n")}\n`
      : "";

  const alreadyPublished =
    existingTitles.length > 0
      ? `\nAlready published on this blog (do NOT repeat these titles or angles):\n${existingTitles.map((t) => `- ${t}`).join("\n")}\n`
      : "";

  const userPrompt = `Brand voice reference:
${brandVoice}

Here are today's trending topics from Google Trends (with source news URLs):
${topicList}

CONTENT PILLARS — prefer angles that fit writers, authors, and book planning:
${topicGuideForPrompt()}
${pillarFallbackBlock}
${alreadyPublished}

Your task:
1. Pick the trend most relevant to WRITING, AUTHORS, BOOK PLANNING, FICTION CRAFT, RESEARCH WRITING, or INDIE PUBLISHING. Reframe the news as practical advice for writers — NOT a generic news recap or geopolitical/finance analysis.
2. Use the provided source URLs for context when researching; cite real authoritative URLs in SOURCE_URLS (writing blogs, publishers, literary orgs — never fabricate).
3. If no trend fits writers well, pick ONE uncovered pillar query from the fallback list above instead.
4. Assign the best CATEGORY slug from the pillars (or "general" if none fit).
5. Write a comprehensive SEO article (1200–1800 words) following the system prompt structure.

${internalLinksSection}
Output only the structured format. No preamble or refusal.`;

  return requestArticleFromOpenRouter(apiKey, model, userPrompt);
}

async function requestArticleFromOpenRouter(
  apiKey: string,
  model: string,
  userPrompt: string
): Promise<GeneratedBlogArticle | null> {
  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...openRouterHeaders(),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 8000,
      }),
    });

    if (!res.ok) {
      console.error("[blog-cron] OpenRouter error:", await res.text());
      return null;
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content;
    if (!text) return null;

    if (getEnv("BLOG_DEBUG") === "true") {
      const debugPath = path.join(process.cwd(), "data", "last-blog-ai-response.txt");
      fs.mkdirSync(path.dirname(debugPath), { recursive: true });
      fs.writeFileSync(debugPath, text, "utf8");
      console.log(`[blog-cron] Debug: saved raw AI response to ${debugPath}`);
    }

    const parsed = parseStructuredAiResponse(text);
    if (!parsed) {
      console.error("[blog-cron] Failed to parse AI response structure");
      console.error("[blog-cron] Response preview:", text.slice(0, 400).replace(/\n/g, " "));
      return null;
    }

    const { meta, articleBody } = parsed;
    const content = normalizeArticleHtml(articleBody);

    let title = extractMetaField(meta, "TITLE") || titleFromMarkdown(articleBody);
    if (!title || content.length < 100) {
      console.error("[blog-cron] Failed to parse article — missing title or body too short");
      console.error("[blog-cron] Title:", title || "(empty)", "| Body length:", content.length);
      return null;
    }

    const rawSourceUrls = extractMetaField(meta, "SOURCE_URLS");
    const sourceUrls = rawSourceUrls
      .split(",")
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http"));

    const rawCategory = extractMetaField(meta, "CATEGORY");
    const category = rawCategory && rawCategory !== "general" ? rawCategory : null;

    const rawTags = extractMetaField(meta, "TAGS");
    const tags = rawTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const topicKeywords = category ? getBlogTopicBySlug(category)?.keywords ?? [] : [];
    const primaryKeyword = extractMetaField(meta, "PRIMARY_KEYWORD");
    const mergedTags = [
      ...new Set([
        ...(category ? [category] : []),
        ...tags,
        ...(primaryKeyword ? [primaryKeyword] : []),
        ...topicKeywords.slice(0, 2),
      ]),
    ].slice(0, 6);

    let slug = extractMetaField(meta, "SLUG").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) slug = slugifyTitle(title);

    return {
      title,
      content,
      excerpt: extractMetaField(meta, "EXCERPT"),
      metaDescription: extractMetaField(meta, "META_DESCRIPTION"),
      slug,
      primaryKeyword,
      sourceUrls,
      category,
      tags: mergedTags,
    };
  } catch (err) {
    console.error("[blog-cron] AI generation error:", err);
    return null;
  }
}

function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) +
    "-" +
    Date.now().toString(36)
  );
}

function getDomainLabel(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.split(".")[0].replace(/^./, (c) => c.toUpperCase());
  } catch {
    return url;
  }
}

function buildSourceAttribution(sourceUrls: string[]): string {
  if (sourceUrls.length === 0) return "";
  const items = sourceUrls
    .map(
      (url) =>
        `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${getDomainLabel(url)}</a>`
    )
    .join(" · ");

  return `<hr><p><strong>Sources</strong></p><p>${items}</p>`;
}

export async function generateCoverImage(
  title: string,
  excerpt: string,
  apiKey: string
): Promise<string> {
  if (!isSupabaseStorageConfigured()) {
    console.warn("[blog-cron] Supabase storage not configured — skipping cover image");
    return "";
  }

  try {
    const imagePrompt = `Editorial photograph for a writing and book planning article titled "${title}". ${excerpt}. Style: warm, literary, creative workspace or books, no text in the image.`;

    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...openRouterHeaders(),
      },
      body: JSON.stringify({
        model: getBlogImageModel(),
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      console.error("[blog-cron] Image API error:", await res.text());
      return "";
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }>; content?: unknown } }>;
    };
    const message = data.choices?.[0]?.message;

    let imageB64: string | null = null;
    let imageUrl: string | null = null;

    const images = message?.images;
    if (Array.isArray(images) && images.length > 0) {
      const url = images[0]?.image_url?.url;
      if (url?.startsWith("data:image/")) imageB64 = url.split(",")[1];
      else if (url) imageUrl = url;
    }

    if (!imageB64 && !imageUrl) {
      const content = message?.content;
      if (Array.isArray(content)) {
        for (const part of content as Array<{ image_url?: { url?: string } }>) {
          const url = part?.image_url?.url;
          if (url?.startsWith("data:image/")) {
            imageB64 = url.split(",")[1];
            break;
          } else if (url) {
            imageUrl = url;
            break;
          }
        }
      } else if (typeof content === "string" && content.startsWith("data:image/")) {
        imageB64 = content.split(",")[1];
      }
    }

    if (!imageB64 && !imageUrl) {
      console.error("[blog-cron] No image in OpenRouter response");
      return "";
    }

    let imageBuffer: Buffer;
    if (imageB64) {
      imageBuffer = Buffer.from(imageB64, "base64");
    } else {
      const imgRes = await fetch(imageUrl!);
      imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    }

    const publicUrl = await uploadBlogCoverImage(imageBuffer);
    console.log(`[blog-cron] Cover image uploaded: ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error("[blog-cron] Cover image generation failed:", err);
    return "";
  }
}

async function selectBacklinkCandidates(
  newTitle: string,
  newExcerpt: string,
  allPosts: GhostPostMeta[],
  apiKey: string,
  model: string
): Promise<GhostPostMeta[]> {
  if (allPosts.length === 0) return [];

  const list = allPosts.map((p, i) => `${i + 1}. [${p.id}] ${p.title}`).join("\n");

  const prompt = `You are a content editor selecting which existing articles should receive a backlink to a newly published article.

New article:
Title: ${newTitle}
Summary: ${newExcerpt}

Existing articles:
${list}

Select 2–3 articles most topically related where a backlink would read naturally. Return ONLY a JSON array of article IDs. Example: ["id-1","id-2"]`;

  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...openRouterHeaders(),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 200,
      }),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const ids: string[] = JSON.parse(jsonMatch[0]);
    return allPosts.filter((p) => ids.includes(p.id));
  } catch {
    return [];
  }
}

async function injectBacklinkIntoPost(
  post: { id: string; title: string; slug: string; html: string },
  newTitle: string,
  newSlug: string,
  apiKey: string,
  model: string
): Promise<string | null> {
  const href = ghostPostHref(newSlug);
  const prompt = `You are a content editor adding a single internal link to an existing article.

Existing article title: ${post.title}
New article to link to: "${newTitle}" at ${href}

Instructions:
- Find ONE natural location for a contextual inline link to the new article
- Insert exactly one anchor: <a href="${href}">{descriptive anchor text}</a>
- Never use "click here" or "read more"
- Do NOT change any other content
- Return the full updated HTML only

Existing article HTML:
${post.html}`;

  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...openRouterHeaders(),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 10000,
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const updated = data.choices?.[0]?.message?.content ?? "";
    if (!updated.includes("<")) return null;

    const firstTag = updated.indexOf("<");
    const lastTag = updated.lastIndexOf(">");
    if (firstTag === -1 || lastTag === -1) return null;

    return updated.substring(firstTag, lastTag + 1);
  } catch {
    return null;
  }
}

export async function injectGhostBacklinks(
  newPostId: string,
  newTitle: string,
  newExcerpt: string,
  newSlug: string,
  apiKey: string,
  model: string
): Promise<string[]> {
  const updatedSlugs: string[] = [];
  const allPostMeta = (await listPublishedGhostPosts()).filter((p) => p.id !== newPostId);

  if (allPostMeta.length === 0) return updatedSlugs;

  console.log(`[blog-cron] Selecting backlink candidates from ${allPostMeta.length} Ghost posts…`);

  const candidates = await selectBacklinkCandidates(newTitle, newExcerpt, allPostMeta, apiKey, model);
  if (candidates.length === 0) {
    console.log("[blog-cron] No suitable backlink candidates");
    return updatedSlugs;
  }

  console.log(
    `[blog-cron] Backlinking into: ${candidates.map((c) => c.title).join(", ")}`
  );

  for (const candidate of candidates) {
    const full = await fetchGhostPost(candidate.id);
    if (!full?.html) {
      console.warn(`[blog-cron] Could not fetch post: ${candidate.title}`);
      continue;
    }
    if (!full.updatedAt) {
      console.warn(`[blog-cron] Post missing updated_at, skipping backlink: ${candidate.title}`);
      continue;
    }

    const updatedHtml = await injectBacklinkIntoPost(
      { id: full.id, title: full.title, slug: full.slug, html: full.html },
      newTitle,
      newSlug,
      apiKey,
      model
    );

    if (!updatedHtml) {
      console.warn(`[blog-cron] Backlink injection failed: ${candidate.title}`);
      continue;
    }

    const result = await updateGhostPostHtml({
      id: full.id,
      html: updatedHtml,
      updatedAt: full.updatedAt,
    });

    if (result.ok) {
      console.log(`[blog-cron] Backlink injected into: ${candidate.title}`);
      updatedSlugs.push(candidate.slug);
    } else {
      console.error(`[blog-cron] Ghost update failed for "${candidate.title}": ${result.error}`);
    }
  }

  return updatedSlugs;
}

export type BlogGenerateOptions = {
  /** Manual dashboard runs bypass the 20h publish guard. Cron keeps default false. */
  force?: boolean;
};

/** Full pipeline: trends → AI article → cover image → Ghost publish → backlink injection. */
export async function generateAndPublishBlogArticle(
  options: BlogGenerateOptions = {}
): Promise<BlogPublishResult> {
  if (!isGhostConfigured()) {
    return { success: false, error: "Ghost not configured (GHOST_URL + GHOST_ADMIN_API_KEY)" };
  }

  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY not set" };
  }

  const model = getBlogAiModel();

  const seoSetup = await ensureGhostSiteSeo();
  for (const msg of seoSetup.messages) {
    console.log(`[blog-cron] ${msg}`);
  }

  const trends = await fetchTrendingTopics();
  if (trends.length === 0) {
    return { success: false, error: "No trending topics found" };
  }

  console.log(`[blog-cron] Found ${trends.length} trending topics`);

  const existingPosts = await listPublishedGhostPosts();
  const existingPostsSeo = await listPublishedGhostPostsForSeo();

  if (!options.force && hasRecentBlogPublish(existingPostsSeo)) {
    return {
      success: false,
      skipped: true,
      error: "Blog post already published in the last 20 hours — skipping",
    };
  }

  const filteredTrends = filterTrendsForExisting(trends, existingPosts);
  const trendsToUse = filteredTrends.length > 0 ? filteredTrends : trends;
  const pillarFallbackBlock = buildUncoveredPillarPromptBlock(existingPosts);

  if (trendsToUse.length === 0 && !pillarFallbackBlock) {
    return {
      success: false,
      skipped: true,
      error: "All trend and pillar topics already covered — skipping",
    };
  }

  console.log(
    `[blog-cron] Using ${trendsToUse.length} trends${filteredTrends.length < trends.length ? " (filtered for duplicates)" : ""}`
  );

  const linkCandidates = existingPosts.map((p) => ({ title: p.title, slug: p.slug }));
  const existingTitles = existingPosts.map((p) => p.title);

  const article = await callAI(
    trendsToUse,
    linkCandidates,
    existingTitles,
    pillarFallbackBlock,
    apiKey,
    model
  );

  if (!article) {
    return { success: false, error: "Failed to generate article" };
  }

  if (articleMatchesExisting(article, existingPosts)) {
    return {
      success: false,
      skipped: true,
      error: `Generated title duplicates existing post: ${article.title}`,
    };
  }

  console.log(`[blog-cron] Generated: ${article.title}`);

  const contentWithAttribution = article.content + buildSourceAttribution(article.sourceUrls);
  const featureImage = await generateCoverImage(article.title, article.excerpt, apiKey);

  const ctaHtml = `<p><strong>Start your manuscript →</strong> <a href="${getEnv("PRODUCT_URL", "https://smartbookplanner.com")}">Smart Book Planner</a></p>`;
  const htmlWithCta = contentWithAttribution.includes("smartbookplanner.com")
    ? contentWithAttribution
    : contentWithAttribution + ctaHtml;

  const blogBase = getEnv("GHOST_URL", "https://blog.smartbookplanner.com").replace(/\/$/, "");
  const postUrl = `${blogBase}/${article.slug}/`;
  const metaTitle = buildMetaTitle(article.title, article.primaryKeyword);
  const jsonLd = buildBlogPostingJsonLd({
    title: article.title,
    excerpt: article.excerpt,
    slug: article.slug,
    url: postUrl,
    featureImage: featureImage || null,
    primaryKeyword: article.primaryKeyword,
    tags: article.tags,
    category: article.category,
  });
  const codeInjectionFoot = wrapJsonLdFootInjection(buildJsonLdScriptTag(jsonLd));

  const publishResult = await publishToGhost({
    title: article.title,
    html: htmlWithCta,
    status: "published",
    slug: article.slug,
    tags: article.tags.length > 0 ? article.tags : ["smart-book-planner"],
    featureImage: featureImage || undefined,
    customExcerpt: article.excerpt,
    metaDescription: article.metaDescription || article.excerpt,
    metaTitle,
    codeInjectionFoot,
  });

  if (!publishResult.ok || !publishResult.id) {
    return { success: false, error: publishResult.error ?? "Ghost publish failed" };
  }

  console.log(`[blog-cron] Published to Ghost: ${publishResult.url ?? article.slug}`);

  const backlinkedSlugs = await injectGhostBacklinks(
    publishResult.id,
    article.title,
    article.excerpt,
    article.slug,
    apiKey,
    model
  );

  return {
    success: true,
    title: article.title,
    slug: article.slug,
    url: publishResult.url,
    featureImage: featureImage || null,
    backlinkedSlugs,
  };
}

export { BLOG_TOPICS };
