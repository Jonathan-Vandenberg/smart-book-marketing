import { getBufferConnectedPlatformSlugs } from "@/lib/buffer";
import { createDraft } from "@/lib/drafts";
import { fetchLatestPublishedPost, isGhostConfigured } from "@/lib/ghost";
import { generateBlogPromoPost } from "@/lib/openrouter";
import { listPlatforms } from "@/lib/platforms";

export type BlogPromoResult = {
  ok: boolean;
  created: number;
  articleTitle?: string;
  articleUrl?: string;
  platforms?: string[];
  error?: string;
};

/** Fetch latest Ghost post and create social promo drafts for each connected Buffer channel. */
export async function createBlogPromoDrafts(): Promise<BlogPromoResult> {
  if (!isGhostConfigured()) {
    return { ok: false, created: 0, error: "Ghost is not configured" };
  }

  const article = await fetchLatestPublishedPost();
  if (!article) {
    return { ok: false, created: 0, error: "No published Ghost posts found" };
  }

  const bufferSlugs = await getBufferConnectedPlatformSlugs();
  const platforms = listPlatforms().filter((p) => bufferSlugs.has(p.slug));
  if (platforms.length === 0) {
    return {
      ok: false,
      created: 0,
      articleTitle: article.title,
      articleUrl: article.url,
      error: "No social channels linked in Buffer — connect Facebook, X, etc. in publish.buffer.com",
    };
  }

  const platformNames: string[] = [];

  for (const platform of platforms) {
    const body = await generateBlogPromoPost({
      platformName: platform.name,
      articleTitle: article.title,
      articleUrl: article.url,
      excerpt: article.excerpt,
    });

    createDraft({
      platformId: platform.id,
      title: article.title,
      body,
      pillar: "blog-promo",
      articleUrl: article.url,
      agentSource: "blog-promo",
    });
    platformNames.push(platform.name);
  }

  return {
    ok: true,
    created: platforms.length,
    articleTitle: article.title,
    articleUrl: article.url,
    platforms: platformNames,
  };
}
