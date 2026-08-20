import type { GhostPostMeta } from "@/lib/ghost";
import { BLOG_TOPICS } from "@/lib/blog-topics";

export type ArticleIdentity = { title: string; slug: string };

export type TrendingTopicInput = { topic: string; newsUrls: string[] };

/** Normalize title for duplicate comparison. */
export function normalizeBlogTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip Ghost numeric suffixes (-2, -3) from duplicate slugs. */
export function canonicalSlugBase(slug: string): string {
  return slug.replace(/-\d+$/, "");
}

export function titlesAreDuplicates(a: string, b: string): boolean {
  const na = normalizeBlogTitle(a);
  const nb = normalizeBlogTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const wordsA = new Set(na.split(" ").filter((w) => w.length > 3));
  const wordsB = new Set(nb.split(" ").filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap += 1;
  }
  const ratio = overlap / Math.min(wordsA.size, wordsB.size);
  return ratio >= 0.85;
}

export function articleMatchesExisting(
  article: ArticleIdentity,
  existing: GhostPostMeta[]
): boolean {
  const slugBase = canonicalSlugBase(article.slug);
  return existing.some(
    (p) =>
      titlesAreDuplicates(article.title, p.title) ||
      canonicalSlugBase(p.slug) === slugBase ||
      p.slug === article.slug
  );
}

export function topicAlreadyCovered(topic: string, existing: GhostPostMeta[]): boolean {
  const normalizedTopic = normalizeBlogTitle(topic);
  if (!normalizedTopic) return false;

  return existing.some((p) => {
    if (titlesAreDuplicates(topic, p.title)) return true;
    const normalizedTitle = normalizeBlogTitle(p.title);
    // Target query covered if existing title contains the core query phrase
    if (normalizedTitle.includes(normalizedTopic) || normalizedTopic.includes(normalizedTitle)) {
      return true;
    }
    return false;
  });
}

export function filterTrendsForExisting(
  trends: TrendingTopicInput[],
  existing: GhostPostMeta[]
): TrendingTopicInput[] {
  return trends.filter((t) => !topicAlreadyCovered(t.topic, existing));
}

/** Uncovered pillar queries — fallback when no trend fits writers (listed for AI, not pre-assigned). */
export function buildUncoveredPillarPromptBlock(existing: GhostPostMeta[]): string {
  const lines: string[] = [];
  for (const pillar of BLOG_TOPICS) {
    for (const query of pillar.targetQueries) {
      if (!topicAlreadyCovered(query, existing)) {
        lines.push(`- ${query} → category: ${pillar.slug}`);
      }
    }
  }
  if (lines.length === 0) return "";
  return `
If none of today's trends fit writers/authors well, pick ONE uncovered pillar query instead:
${lines.join("\n")}`;
}

export function formatTrendListForPrompt(trends: TrendingTopicInput[]): string {
  return trends
    .map(
      (t, i) =>
        `${i + 1}. ${t.topic}${t.newsUrls.length > 0 ? ` [sources: ${t.newsUrls.join(", ")}]` : ""}`
    )
    .join("\n");
}

export function hasRecentBlogPublish(
  posts: Array<{ publishedAt?: string | null }>,
  withinHours = 20
): boolean {
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000;
  return posts.some((p) => {
    if (!p.publishedAt) return false;
    return new Date(p.publishedAt).getTime() > cutoff;
  });
}

/** Score posts to pick the canonical duplicate to keep. */
export function scorePostForKeep(post: {
  slug: string;
  featureImage?: string | null;
  metaTitle?: string | null;
  codeInjectionFoot?: string | null;
  publishedAt?: string | null;
}): number {
  let score = 0;
  if (post.featureImage) score += 10;
  if (post.metaTitle?.trim()) score += 3;
  if (post.codeInjectionFoot?.includes("BlogPosting")) score += 3;
  if (!/-\d+$/.test(post.slug)) score += 5;
  if (post.publishedAt) score += new Date(post.publishedAt).getTime() / 1e15;
  return score;
}
