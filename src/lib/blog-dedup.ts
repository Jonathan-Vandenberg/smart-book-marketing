import type { GhostPostMeta } from "@/lib/ghost";
import { BLOG_TOPICS } from "@/lib/blog-topics";

export type ArticleIdentity = { title: string; slug: string };

export type TrendingTopicInput = { topic: string; newsUrls: string[] };

/** Topic chosen in code BEFORE the AI call — prevents paying for duplicate articles. */
export type BlogTopicAssignment = {
  topic: string;
  categorySlug: string;
  source: "trend" | "pillar";
  newsUrls: string[];
};

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

function inferCategoryFromTopic(topic: string): string {
  const lower = topic.toLowerCase();
  for (const pillar of BLOG_TOPICS) {
    if (pillar.keywords.some((k) => lower.includes(k.toLowerCase()))) return pillar.slug;
    if (
      pillar.targetQueries.some(
        (q) => lower.includes(q.toLowerCase()) || q.toLowerCase().includes(lower)
      )
    ) {
      return pillar.slug;
    }
  }
  return "general";
}

/** All deduped angles still available to write (trends first, then pillar queries). */
export function listAvailableBlogAngles(
  trends: TrendingTopicInput[],
  existing: GhostPostMeta[]
): BlogTopicAssignment[] {
  const angles: BlogTopicAssignment[] = [];

  for (const trend of filterTrendsForExisting(trends, existing)) {
    angles.push({
      topic: trend.topic,
      source: "trend",
      categorySlug: inferCategoryFromTopic(trend.topic),
      newsUrls: trend.newsUrls,
    });
  }

  for (const pillar of BLOG_TOPICS) {
    for (const query of pillar.targetQueries) {
      if (!topicAlreadyCovered(query, existing)) {
        angles.push({
          topic: query,
          source: "pillar",
          categorySlug: pillar.slug,
          newsUrls: [],
        });
      }
    }
  }

  return angles;
}

/**
 * Pick the next angle BEFORE calling OpenRouter — rotates daily so we don't always
 * hit craft-fiction #1. Skips anything already covered on Ghost.
 */
export function pickBlogTopicAssignment(
  trends: TrendingTopicInput[],
  existing: GhostPostMeta[]
): BlogTopicAssignment | null {
  const candidates = listAvailableBlogAngles(trends, existing);
  if (candidates.length === 0) return null;

  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const start = dayIndex % candidates.length;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[(start + i) % candidates.length];
    if (!topicAlreadyCovered(candidate.topic, existing)) {
      return candidate;
    }
  }

  return null;
}

export function assignmentPromptBlock(assignment: BlogTopicAssignment): string {
  const sources =
    assignment.newsUrls.length > 0
      ? `\nNews source URLs for context: ${assignment.newsUrls.join(", ")}`
      : "";

  return `
ASSIGNED ANGLE (required — write ONLY about this):
${assignment.topic}
Category: ${assignment.categorySlug}
Source: ${assignment.source === "trend" ? "Google Trends (reframe for writers)" : "content pillar target query"}${sources}

Your TITLE and PRIMARY_KEYWORD must be fresh SEO phrasing — not a copy of any blocked title below.`;
}

export function blockedTitlesPromptBlock(existing: GhostPostMeta[]): string {
  if (existing.length === 0) return "";
  return `
BLOCKED TITLES — do NOT reuse these titles or near-identical angles:
${existing.map((p) => `- ${p.title}`).join("\n")}`;
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
