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
  assignmentPromptBlock,
  blockedTitlesPromptBlock,
  filterTrendsForExisting,
  getBlogTopicCooldownDays,
  hasRecentBlogPublish,
  pickBlogTopicAssignment,
  type BlogPostForDedup,
  type BlogTopicAssignment,
} from "@/lib/blog-dedup";
import { BLOG_TOPICS, getBlogTopicBySlug } from "@/lib/blog-topics";
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
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`^${escaped}\\s*:\\s*(.+)$`, "im"),
    new RegExp(`^\\*\\*${escaped}\\*\\*\\s*:\\s*(.+)$`, "im"),
    new RegExp(`^${escaped}\\s+-\\s+(.+)$`, "im"),
  ];
  for (const pattern of patterns) {
    const m = meta.match(pattern);
    if (m?.[1]) return cleanMetaValue(m[1]);
  }
  return "";
}

function titleFromHtml(html: string): string | null {
  const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (!h2?.[1]) return null;
  const text = h2[1].replace(/<[^>]+>/g, "").trim();
  return text || null;
}

function titleFromAssignmentTopic(topic: string): string {
  return topic
    .split(/\s+/)
    .map((w) => (w.length <= 3 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function resolveArticleTitle(
  meta: string,
  articleBody: string,
  content: string,
  rawText: string,
  assignmentTopic?: string
): string {
  return (
    extractMetaField(meta, "TITLE") ||
    extractMetaField(rawText, "TITLE") ||
    titleFromHtml(content) ||
    titleFromHtml(articleBody) ||
    titleFromMarkdown(articleBody) ||
    (assignmentTopic ? titleFromAssignmentTopic(assignmentTopic) : "") ||
    ""
  );
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

You will receive an ASSIGNED ANGLE chosen before this request (already deduped against published posts). Write ONLY that angle — do NOT drift to a covered topic like novel planning if it is blocked.

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
- Mention Smart Book Planner naturally TWICE: once early (within the first 2–3 sections after the intro, tied to planning/outlining the topic) and once in the conclusion CTA
- When existing blog articles are listed, include 2–3 inline internal links to them using the exact href format given

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
  assignment: BlogTopicAssignment,
  linkCandidates: { title: string; slug: string }[],
  existingPosts: BlogPostForDedup[],
  apiKey: string,
  model: string
): Promise<GeneratedBlogArticle | null> {
  const brandVoice = loadBrandVoice();
  const pillar = getBlogTopicBySlug(assignment.categorySlug);

  const internalLinksSection =
    linkCandidates.length > 0
      ? `\nINTERNAL LINKING (required when articles exist): Weave in at least 2 inline links to existing posts below. Use exact HTML: <a href="${ghostPostHref("{slug}")}">{descriptive anchor text}</a> (replace {slug}). Place links inside body paragraphs — not only in a list at the end.\n\nExisting articles:\n${linkCandidates.slice(0, 15).map((p) => `- ${p.title} → slug: ${p.slug}`).join("\n")}\n`
      : "";

  const userPrompt = `Brand voice reference:
${brandVoice}

Category context: ${pillar ? `${pillar.name} (${pillar.slug})` : assignment.categorySlug}
${assignmentPromptBlock(assignment)}
${blockedTitlesPromptBlock(existingPosts)}

Your task:
1. Write a comprehensive SEO article on the ASSIGNED ANGLE only. If it is a Google Trends topic, reframe the news for writers — not a generic news recap.
2. Use news source URLs when provided; cite real authoritative URLs in SOURCE_URLS (never fabricate).
3. Set CATEGORY to "${assignment.categorySlug}" unless a better pillar clearly fits the assigned topic.
4. Your TITLE must be distinct from every blocked title — use fresh wording even when the topic is similar.
5. Write 1200–1800 words following the system prompt structure.
6. Include at least one early, natural mention of Smart Book Planner (smartbookplanner.com) — not only in the final paragraph.

${internalLinksSection}
Output only the structured format. No preamble or refusal.`;

  return requestArticleFromOpenRouter(apiKey, model, userPrompt, assignment.topic);
}

async function requestArticleFromOpenRouter(
  apiKey: string,
  model: string,
  userPrompt: string,
  assignmentTopic?: string
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

    const title = resolveArticleTitle(meta, articleBody, content, text, assignmentTopic);
    if (!title || content.length < 100) {
      console.error("[blog-cron] Failed to parse article — missing title or body too short");
      console.error("[blog-cron] Title:", title || "(empty)", "| Body length:", content.length);
      console.error("[blog-cron] Meta preview:", meta.slice(0, 300).replace(/\n/g, " "));
      if (getEnv("BLOG_DEBUG") !== "true") {
        const debugPath = path.join(process.cwd(), "data", "last-blog-ai-response.txt");
        fs.mkdirSync(path.dirname(debugPath), { recursive: true });
        fs.writeFileSync(debugPath, text, "utf8");
      }
      return null;
    }

    if (!extractMetaField(meta, "TITLE") && !extractMetaField(text, "TITLE")) {
      console.warn(`[blog-cron] TITLE missing from meta — inferred: "${title}"`);
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

function countInternalLinks(html: string, slugs: string[]): number {
  let count = 0;
  for (const slug of slugs) {
    if (html.includes(ghostPostHref(slug)) || html.includes(`/${slug}"`) || html.includes(`/${slug}/`)) {
      count += 1;
    }
  }
  return count;
}

/** Ensure new post links to at least 2 existing posts when the model skipped internal links. */
function ensureOutboundInternalLinks(
  html: string,
  candidates: { title: string; slug: string }[],
  minLinks = 2
): string {
  if (candidates.length === 0) return html;

  const slugs = candidates.map((c) => c.slug);
  if (countInternalLinks(html, slugs) >= minLinks) return html;

  const missing = candidates.filter(
    (c) => !html.includes(ghostPostHref(c.slug)) && !html.includes(`/${c.slug}/`)
  );
  if (missing.length === 0) return html;

  const picks = missing.slice(0, Math.max(minLinks, 2));
  const items = picks
    .map((p) => `<li><a href="${ghostPostHref(p.slug)}">${p.title}</a></li>`)
    .join("\n");

  return (
    html +
    `\n<h2>Related on this blog</h2>\n<ul>\n${items}\n</ul>`
  );
}

function postAlreadyLinksTo(html: string, newSlug: string): boolean {
  return html.includes(ghostPostHref(newSlug)) || html.includes(`/${newSlug}/`);
}

function deterministicBacklinkHtml(
  html: string,
  newTitle: string,
  newSlug: string
): string {
  const href = ghostPostHref(newSlug);
  if (postAlreadyLinksTo(html, newSlug)) return html;

  const insert = `<p>See also: <a href="${href}">${newTitle}</a>.</p>`;
  const lastH2 = html.lastIndexOf("<h2");
  if (lastH2 > 0) {
    return html.slice(0, lastH2) + insert + html.slice(lastH2);
  }
  return html + insert;
}

function parseBacklinkCandidateIds(text: string, allPosts: GhostPostMeta[]): GhostPostMeta[] {
  const jsonMatch = text.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(parsed)) return [];

    const idSet = new Set(parsed.map((v) => String(v)));
    return allPosts.filter((p) => idSet.has(String(p.id)));
  } catch {
    return [];
  }
}

function fallbackBacklinkCandidates(
  allPosts: GhostPostMeta[],
  newSlug: string,
  max = 3
): GhostPostMeta[] {
  return allPosts
    .filter((p) => p.slug !== newSlug)
    .slice(0, max);
}

function ensureProductMentions(html: string, productUrl: string): string {
  const lower = html.toLowerCase();
  const count = (lower.match(/smart book planner|smartbookplanner\.com/g) || []).length;
  if (count >= 2) return html;

  const earlyBlurb = `<p>When you're ready to structure your draft, <a href="${productUrl}">Smart Book Planner</a> gives you a clear outline before you write chapter one.</p>`;
  const firstH2End = html.indexOf("</h2>");
  if (firstH2End === -1) return earlyBlurb + html;

  const firstHalf = lower.slice(0, Math.floor(lower.length * 0.45));
  if (firstHalf.includes("smart book planner") || firstHalf.includes("smartbookplanner.com")) {
    return html;
  }

  return html.slice(0, firstH2End + 5) + earlyBlurb + html.slice(firstH2End + 5);
}

async function selectBacklinkCandidates(
  newTitle: string,
  newExcerpt: string,
  newSlug: string,
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

Select 2–3 articles most topically related where a backlink would read naturally. Return ONLY a JSON array of Ghost post IDs exactly as shown in brackets. Example: ["673abc123","673def456"]`;

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

    if (res.ok) {
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content ?? "";
      const matched = parseBacklinkCandidateIds(text, allPosts);
      if (matched.length > 0) {
        const merged = [...matched];
        for (const p of fallbackBacklinkCandidates(allPosts, newSlug, 5)) {
          if (merged.length >= 3) break;
          if (!merged.some((m) => m.id === p.id)) merged.push(p);
        }
        return merged.slice(0, 3);
      }
    }
  } catch {
    // fall through
  }

  return fallbackBacklinkCandidates(allPosts, newSlug, 3);
}

async function injectBacklinkIntoPost(
  post: { id: string; title: string; slug: string; html: string },
  newTitle: string,
  newSlug: string,
  apiKey: string,
  model: string
): Promise<string> {
  const href = ghostPostHref(newSlug);
  if (postAlreadyLinksTo(post.html, newSlug)) return post.html;

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

    if (res.ok) {
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const updated = data.choices?.[0]?.message?.content ?? "";
      if (updated.includes("<") && postAlreadyLinksTo(updated, newSlug)) {
        const firstTag = updated.indexOf("<");
        const lastTag = updated.lastIndexOf(">");
        if (firstTag !== -1 && lastTag !== -1) {
          return updated.substring(firstTag, lastTag + 1);
        }
      }
    }
  } catch {
    // deterministic fallback below
  }

  return deterministicBacklinkHtml(post.html, newTitle, newSlug);
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

  const candidates = await selectBacklinkCandidates(
    newTitle,
    newExcerpt,
    newSlug,
    allPostMeta,
    apiKey,
    model
  );
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

    if (postAlreadyLinksTo(full.html, newSlug)) {
      console.log(`[blog-cron] Already links to new post: ${candidate.title}`);
      continue;
    }

    const updatedHtml = await injectBacklinkIntoPost(
      { id: full.id, title: full.title, slug: full.slug, html: full.html },
      newTitle,
      newSlug,
      apiKey,
      model
    );

    if (updatedHtml === full.html) {
      console.warn(`[blog-cron] No backlink change for: ${candidate.title}`);
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

/** Add backlinks from older posts → latest published post (repair / manual). */
export async function backfillBacklinksToLatestPost(): Promise<{
  ok: boolean;
  backlinkedSlugs?: string[];
  latestTitle?: string;
  error?: string;
}> {
  if (!isGhostConfigured()) {
    return { ok: false, error: "Ghost not configured" };
  }

  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    return { ok: false, error: "OPENROUTER_API_KEY not set" };
  }

  const posts = await listPublishedGhostPosts("1");
  const latest = posts[0];
  if (!latest) {
    return { ok: false, error: "No published posts" };
  }

  const full = await fetchGhostPost(latest.id);
  const excerpt = full?.customExcerpt ?? latest.title;

  const backlinkedSlugs = await injectGhostBacklinks(
    latest.id,
    latest.title,
    excerpt,
    latest.slug,
    apiKey,
    getBlogAiModel()
  );

  return {
    ok: true,
    latestTitle: latest.title,
    backlinkedSlugs,
  };
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

  const existingPostsSeo = await listPublishedGhostPostsForSeo();
  const cooldownDays = getBlogTopicCooldownDays();

  if (!options.force && hasRecentBlogPublish(existingPostsSeo)) {
    return {
      success: false,
      skipped: true,
      error: "Blog post already published in the last 20 hours — skipping",
    };
  }

  const filteredTrends = filterTrendsForExisting(trends, existingPostsSeo);
  const assignment = pickBlogTopicAssignment(trends, existingPostsSeo);

  if (!assignment) {
    return {
      success: false,
      skipped: true,
      error: `No uncovered angles in the last ${cooldownDays} days — skipping (no AI call)`,
    };
  }

  console.log(
    `[blog-cron] Assigned angle (${assignment.source}): ${assignment.topic} [${assignment.categorySlug}]` +
      ` (topic cooldown: ${cooldownDays}d)` +
      (filteredTrends.length < trends.length ? `; ${trends.length - filteredTrends.length} trends filtered as recent` : "")
  );

  const linkCandidates = existingPostsSeo.map((p) => ({ title: p.title, slug: p.slug }));

  const article = await callAI(assignment, linkCandidates, existingPostsSeo, apiKey, model);

  if (!article) {
    return { success: false, error: "Failed to generate article" };
  }

  if (articleMatchesExisting(article, existingPostsSeo)) {
    console.error(
      `[blog-cron] AI returned duplicate title despite pre-assignment — rejected before image/publish: ${article.title}`
    );
    return {
      success: false,
      skipped: true,
      error: `Generated title duplicates existing post: ${article.title}. Assignment was: ${assignment.topic}`,
    };
  }

  console.log(`[blog-cron] Generated: ${article.title}`);

  const productUrl = getEnv("PRODUCT_URL", "https://smartbookplanner.com");
  let contentWithAttribution = article.content + buildSourceAttribution(article.sourceUrls);
  contentWithAttribution = ensureOutboundInternalLinks(contentWithAttribution, linkCandidates);
  contentWithAttribution = ensureProductMentions(contentWithAttribution, productUrl);
  const featureImage = await generateCoverImage(article.title, article.excerpt, apiKey);

  const ctaHtml = `<p><strong>Start your manuscript →</strong> <a href="${productUrl}">Smart Book Planner</a></p>`;
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
