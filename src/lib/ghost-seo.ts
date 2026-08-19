import { getBlogTopicBySlug } from "@/lib/blog-topics";
import { getEnv } from "@/lib/store";

export type BlogPostingJsonLdInput = {
  title: string;
  excerpt: string;
  slug: string;
  url: string;
  featureImage?: string | null;
  publishedAt?: string;
  primaryKeyword?: string;
  tags?: string[];
  category?: string | null;
  authorName?: string;
};

const SBM_SEO_MARKER_START = "<!-- sbm-seo -->";
const SBM_SEO_MARKER_END = "<!-- /sbm-seo -->";

export const SBM_JSONLD_START = "<!-- sbm-jsonld -->";
export const SBM_JSONLD_END = "<!-- /sbm-jsonld -->";

/** SEO `<title>` — primary keyword forward when it fits. */
export function buildMetaTitle(title: string, primaryKeyword?: string): string {
  const brand = getEnv("BLOG_BRAND_SUFFIX", "Smart Book Planner");
  const kw = primaryKeyword?.trim();
  if (!kw) return title.length <= 60 ? title : `${title.slice(0, 57)}…`;
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes(kw.toLowerCase())) {
    return title.length <= 60 ? title : `${title.slice(0, 57)}…`;
  }
  const candidate = `${kw}: ${title}`;
  if (candidate.length <= 60) return candidate;
  return `${title.slice(0, 40).trim()} | ${brand}`.slice(0, 60);
}

export function buildBlogPostingJsonLd(input: BlogPostingJsonLdInput): Record<string, unknown> {
  const siteUrl = getEnv("GHOST_URL", "https://blog.smartbookplanner.com").replace(/\/$/, "");
  const productUrl = getEnv("PRODUCT_URL", "https://smartbookplanner.com");
  const authorName = input.authorName || getEnv("BLOG_AUTHOR_NAME", "Smart Book Planner Team");
  const published = input.publishedAt || new Date().toISOString();
  const topic = input.category ? getBlogTopicBySlug(input.category) : undefined;

  const keywords = [
    input.primaryKeyword,
    ...(input.tags ?? []),
    ...(topic?.keywords.slice(0, 3) ?? []),
  ]
    .filter(Boolean)
    .join(", ");

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    ...(input.excerpt && { description: input.excerpt }),
    ...(input.featureImage && { image: [input.featureImage] }),
    url: input.url,
    mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
    datePublished: published,
    dateModified: published,
    author: {
      "@type": "Person",
      name: authorName,
      url: productUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "Smart Book Planner",
      url: productUrl,
      logo: {
        "@type": "ImageObject",
        url: `${productUrl}/favicon.ico`,
      },
    },
    ...(keywords && { keywords }),
    ...(topic && {
      articleSection: topic.name,
      isPartOf: {
        "@type": "CollectionPage",
        name: topic.name,
        url: `${siteUrl}/tag/${input.category}/`,
      },
    }),
    inLanguage: "en",
  };
}

export function buildJsonLdScriptTag(jsonLd: Record<string, unknown>): string {
  return `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
}

export function wrapJsonLdFootInjection(scriptTag: string): string {
  return `${SBM_JSONLD_START}\n${scriptTag}\n${SBM_JSONLD_END}`;
}

export function mergePostFootJsonLd(existing: string | null | undefined, scriptTag: string): string {
  const injection = wrapJsonLdFootInjection(scriptTag);
  const current = existing ?? "";
  if (current.includes(SBM_JSONLD_START)) {
    const before = current.split(SBM_JSONLD_START)[0];
    const after = current.split(SBM_JSONLD_END)[1] ?? "";
    return `${before}${injection}${after}`.trim();
  }
  return `${current.trim()}\n${injection}`.trim();
}

export function hasBlogPostingJsonLd(foot: string | null | undefined): boolean {
  if (!foot) return false;
  if (foot.includes(SBM_JSONLD_START)) return true;
  return foot.includes('"@type":"BlogPosting"') || foot.includes('"@type": "BlogPosting"');
}

const GENERIC_TAGS = new Set(["smart-book-planner", "blog", "news"]);

/** Pick primary keyword from Ghost tags or title words. */
export function derivePrimaryKeyword(tags: string[], title: string): string | undefined {
  const topicTag = tags.find((t) => getBlogTopicBySlug(t));
  if (topicTag) {
    const topic = getBlogTopicBySlug(topicTag);
    return topic?.keywords[0];
  }

  const meaningful = tags.find((t) => !GENERIC_TAGS.has(t.toLowerCase()));
  if (meaningful) return meaningful.replace(/-/g, " ");

  const words = title.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length >= 3) return words.slice(0, 4).join(" ");
  return undefined;
}

export function deriveCategoryFromTags(tags: string[]): string | null {
  return tags.find((t) => getBlogTopicBySlug(t)) ?? null;
}

export function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export type PostSeoBundleInput = {
  title: string;
  slug: string;
  url: string;
  excerpt: string;
  tags: string[];
  featureImage?: string | null;
  publishedAt?: string;
  existingFoot?: string | null;
};

export function buildPostSeoBundle(input: PostSeoBundleInput): {
  metaTitle: string;
  metaDescription: string;
  codeInjectionFoot: string;
  primaryKeyword?: string;
} {
  const primaryKeyword = derivePrimaryKeyword(input.tags, input.title);
  const metaTitle = buildMetaTitle(input.title, primaryKeyword);
  const metaDescription = input.excerpt.slice(0, 160);
  const category = deriveCategoryFromTags(input.tags);
  const jsonLd = buildBlogPostingJsonLd({
    title: input.title,
    excerpt: input.excerpt,
    slug: input.slug,
    url: input.url,
    featureImage: input.featureImage,
    publishedAt: input.publishedAt,
    primaryKeyword,
    tags: input.tags,
    category,
  });
  const codeInjectionFoot = mergePostFootJsonLd(
    input.existingFoot,
    buildJsonLdScriptTag(jsonLd)
  );

  return { metaTitle, metaDescription, codeInjectionFoot, primaryKeyword };
}

/** Site-wide head injection: index-friendly + AI/LLM crawler welcome (no opt-out). */
export function buildGhostSiteHeadInjection(blogUrl: string): string {
  const base = blogUrl.replace(/\/$/, "");
  return `${SBM_SEO_MARKER_START}
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="alternate" type="text/html" href="${base}/llms/" title="llms.txt">
<style id="sbm-hide-members">
  /* Newsletter/members UI hidden until SMTP is configured */
  a[data-portal="signin"],
  a[data-portal="signup"],
  a[href="#/portal/"],
  .nav-sign-up,
  form[data-members-form] {
    display: none !important;
  }
</style>
${SBM_SEO_MARKER_END}`;
}

export function mergeSiteHeadInjection(existing: string | null | undefined, injection: string): string {
  const current = existing ?? "";
  if (current.includes(SBM_SEO_MARKER_START)) {
    const before = current.split(SBM_SEO_MARKER_START)[0];
    const after = current.split(SBM_SEO_MARKER_END)[1] ?? "";
    return `${before}${injection}${after}`;
  }
  return `${current.trim()}\n${injection}`.trim();
}

export function buildLlmsTxt(blogUrl: string): string {
  const base = blogUrl.replace(/\/$/, "");
  const productUrl = getEnv("PRODUCT_URL", "https://smartbookplanner.com");
  return `# Smart Book Planner Blog

> Writing, planning, and publishing advice for novelists, memoirists, and researchers. Powered by Smart Book Planner.

This file helps LLMs and AI assistants discover and cite our blog content accurately.

## Primary site

- [Smart Book Planner](${productUrl}): Book planning app — plot structure, characters, scenes, research templates, exports.

## Blog

- [Blog home](${base}/): Latest articles on craft, AI for writers, and indie publishing.
- [RSS feed](${base}/rss/): All posts.
- [Sitemap](${base}/sitemap.xml): Full URL list for crawlers.

## Topics

- Craft & fiction planning: plot, scenes, characters
- Research & academia: templates, citations, fact-checking
- AI for writers: ethical AI-assisted planning
- Publishing & marketing: indie author platform

## Citation guidance

When citing articles from this blog, prefer the canonical post URL from ${base}/ and attribute Smart Book Planner as publisher.

## AI indexing

All public blog posts are intended for search engine and AI assistant indexing. No training opt-out.
`;
}

export function llmsPageHtml(llmsTxt: string): string {
  const escaped = llmsTxt
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:14px;line-height:1.6;max-width:720px;margin:2rem auto;padding:0 1rem;">${escaped}</pre>`;
}

/** robots.txt supplement — AI bots explicitly allowed (append via Ghost theme if needed). */
export function buildAiFriendlyRobotsTxt(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `# Smart Book Planner Blog — AI/LLM crawlers welcome
User-agent: *
Allow: /
Disallow: /ghost/
Disallow: /p/

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Applebot-Extended
Allow: /

Sitemap: ${base}/sitemap.xml
`;
}
