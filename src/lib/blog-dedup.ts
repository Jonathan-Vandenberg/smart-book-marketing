import { BLOG_TOPICS } from "@/lib/blog-topics";
import { getEnv } from "@/lib/store";

export type ArticleIdentity = { title: string; slug: string };

export type TrendingTopicInput = { topic: string; newsUrls: string[] };

/** Post fields needed for topic cooldown dedup. */
export type BlogPostForDedup = {
  title: string;
  slug: string;
  publishedAt?: string | null;
};

/** Topic chosen in code BEFORE the AI call — prevents paying for duplicate articles. */
export type BlogTopicAssignment = {
  topic: string;
  categorySlug: string;
  source: "trend" | "pillar";
  newsUrls: string[];
};

/** Days before the same topic/angle can be written again (default 7). */
export function getBlogTopicCooldownDays(): number {
  const raw = getEnv("BLOG_TOPIC_COOLDOWN_DAYS", "7");
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 7;
}

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

function topicMatchesPost(topic: string, post: BlogPostForDedup): boolean {
  if (titlesAreDuplicates(topic, post.title)) return true;
  const normalizedTopic = normalizeBlogTitle(topic);
  const normalizedTitle = normalizeBlogTitle(post.title);
  if (normalizedTitle.includes(normalizedTopic) || normalizedTopic.includes(normalizedTitle)) {
    return true;
  }
  return false;
}

/** Posts published within the topic cooldown window (default 7 days). */
export function postsWithinTopicCooldown(
  posts: BlogPostForDedup[],
  withinDays = getBlogTopicCooldownDays()
): BlogPostForDedup[] {
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  return posts.filter((p) => {
    if (!p.publishedAt) return false;
    return new Date(p.publishedAt).getTime() > cutoff;
  });
}

/** True if this topic was covered on the blog within the cooldown window. */
export function topicRecentlyCovered(
  topic: string,
  posts: BlogPostForDedup[],
  withinDays = getBlogTopicCooldownDays()
): boolean {
  const recent = postsWithinTopicCooldown(posts, withinDays);
  return recent.some((p) => topicMatchesPost(topic, p));
}

/** @deprecated Use topicRecentlyCovered — kept for imports during transition. */
export function topicAlreadyCovered(topic: string, posts: BlogPostForDedup[]): boolean {
  return topicRecentlyCovered(topic, posts);
}

export function articleMatchesExisting(
  article: ArticleIdentity,
  posts: BlogPostForDedup[]
): boolean {
  const slugBase = canonicalSlugBase(article.slug);
  const withinDays = getBlogTopicCooldownDays();
  const recent = postsWithinTopicCooldown(posts, withinDays);

  // Slug collision — always block (SEO canonical)
  if (posts.some((p) => canonicalSlugBase(p.slug) === slugBase || p.slug === article.slug)) {
    return true;
  }

  // Title / angle overlap — only within cooldown window
  return recent.some((p) => titlesAreDuplicates(article.title, p.title));
}

export function filterTrendsForExisting(
  trends: TrendingTopicInput[],
  posts: BlogPostForDedup[]
): TrendingTopicInput[] {
  return trends.filter((t) => !topicRecentlyCovered(t.topic, posts));
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

/** Google Trends topics must match writing/book domain — skip celebrity/news noise. */
const WRITING_TREND_HINTS = [
  "book",
  "author",
  "novel",
  "write",
  "writer",
  "writing",
  "publish",
  "memoir",
  "research",
  "fiction",
  "story",
  "manuscript",
  "literary",
  "reading",
  "bestseller",
  "kindle",
  "self publish",
  "self-publish",
  "plot",
  "chapter",
  "outline",
  "citation",
  "thesis",
  "paper",
  "academic",
  "ai writing",
  "chatgpt",
];

export function isTrendRelevantToWriters(topic: string): boolean {
  if (inferCategoryFromTopic(topic) !== "general") return true;
  const lower = topic.toLowerCase();
  return WRITING_TREND_HINTS.some((hint) => lower.includes(hint));
}

function orderBlogAngleCandidates(candidates: BlogTopicAssignment[]): BlogTopicAssignment[] {
  const pillars = candidates.filter((c) => c.source === "pillar");
  const trends = candidates.filter((c) => c.source === "trend");
  return [...pillars, ...trends];
}

/** All angles not written within the cooldown window (pillars + writing-relevant trends). */
export function listAvailableBlogAngles(
  trends: TrendingTopicInput[],
  posts: BlogPostForDedup[]
): BlogTopicAssignment[] {
  const angles: BlogTopicAssignment[] = [];

  for (const trend of filterTrendsForExisting(trends, posts)) {
    if (!isTrendRelevantToWriters(trend.topic)) continue;
    angles.push({
      topic: trend.topic,
      source: "trend",
      categorySlug: inferCategoryFromTopic(trend.topic),
      newsUrls: trend.newsUrls,
    });
  }

  for (const pillar of BLOG_TOPICS) {
    for (const query of pillar.targetQueries) {
      if (!topicRecentlyCovered(query, posts)) {
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
 * Ordered angles for generation (pillar queries first, then writing-relevant trends).
 * Rotates daily; use first N entries as retry candidates when the model refuses or parse fails.
 */
export function pickBlogTopicCandidates(
  trends: TrendingTopicInput[],
  posts: BlogPostForDedup[],
  max = 5
): BlogTopicAssignment[] {
  const candidates = orderBlogAngleCandidates(listAvailableBlogAngles(trends, posts));
  if (candidates.length === 0) return [];

  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const start = dayIndex % candidates.length;
  const rotated: BlogTopicAssignment[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[(start + i) % candidates.length];
    if (!topicRecentlyCovered(candidate.topic, posts)) {
      rotated.push(candidate);
    }
  }

  return rotated.slice(0, max);
}

/**
 * Pick the next angle BEFORE calling OpenRouter — rotates daily.
 * Skips topics covered within BLOG_TOPIC_COOLDOWN_DAYS (default 7).
 */
export function pickBlogTopicAssignment(
  trends: TrendingTopicInput[],
  posts: BlogPostForDedup[]
): BlogTopicAssignment | null {
  return pickBlogTopicCandidates(trends, posts, 1)[0] ?? null;
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

/** Titles from posts within the cooldown window — AI must not reuse these. */
export function blockedTitlesPromptBlock(posts: BlogPostForDedup[]): string {
  const recent = postsWithinTopicCooldown(posts);
  if (recent.length === 0) return "";
  const days = getBlogTopicCooldownDays();
  return `
BLOCKED TITLES (published in the last ${days} days — do NOT reuse these titles or near-identical angles):
${recent.map((p) => `- ${p.title}`).join("\n")}`;
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
