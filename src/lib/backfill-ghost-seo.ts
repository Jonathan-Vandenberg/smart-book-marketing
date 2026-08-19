import { generateCoverImage, injectGhostBacklinks } from "@/lib/generate-blog-article";
import {
  isGhostConfigured,
  listPublishedGhostPostsForSeo,
  updateGhostPostSeo,
  type GhostPostSeoRecord,
} from "@/lib/ghost";
import {
  buildPostSeoBundle,
  hasBlogPostingJsonLd,
  stripHtml,
} from "@/lib/ghost-seo";
import { getBlogAiModel, getOpenRouterApiKey } from "@/lib/openrouter-config";

export type BackfillGhostSeoOptions = {
  dryRun?: boolean;
  slug?: string;
  generateImages?: boolean;
  injectBacklinks?: boolean;
  force?: boolean;
};

export type BackfillGhostSeoResult = {
  ok: boolean;
  processed: number;
  updated: number;
  skipped: number;
  errors: string[];
  details: Array<{
    slug: string;
    title: string;
    action: "updated" | "skipped" | "error";
    changes: string[];
    message?: string;
  }>;
};

function postExcerpt(post: GhostPostSeoRecord): string {
  const raw = post.customExcerpt || post.excerpt || "";
  return stripHtml(raw);
}

function needsSeoUpdate(post: GhostPostSeoRecord, force: boolean): string[] {
  const missing: string[] = [];
  if (force || !post.metaTitle?.trim()) missing.push("meta_title");
  if (force || !post.metaDescription?.trim()) missing.push("meta_description");
  if (force || !hasBlogPostingJsonLd(post.codeInjectionFoot)) missing.push("json_ld");
  return missing;
}

export async function backfillGhostPostsSeo(
  options: BackfillGhostSeoOptions = {}
): Promise<BackfillGhostSeoResult> {
  const result: BackfillGhostSeoResult = {
    ok: true,
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  if (!isGhostConfigured()) {
    result.ok = false;
    result.errors.push("Ghost not configured (GHOST_URL + GHOST_ADMIN_API_KEY)");
    return result;
  }

  let posts = await listPublishedGhostPostsForSeo();
  if (options.slug) {
    posts = posts.filter((p) => p.slug === options.slug);
    if (posts.length === 0) {
      result.ok = false;
      result.errors.push(`No published post found with slug: ${options.slug}`);
      return result;
    }
  }

  const apiKey = getOpenRouterApiKey();
  const model = getBlogAiModel();
  const needsImages = options.generateImages && Boolean(apiKey);

  if (options.generateImages && !apiKey) {
    result.errors.push("OPENROUTER_API_KEY not set — skipping cover image generation");
  }

  for (const post of posts) {
    result.processed += 1;
    const changes: string[] = [];
    const missing = needsSeoUpdate(post, Boolean(options.force));
    const needsImage = needsImages && !post.featureImage?.trim();

    if (missing.length === 0 && !needsImage) {
      result.skipped += 1;
      result.details.push({
        slug: post.slug,
        title: post.title,
        action: "skipped",
        changes: [],
        message: "SEO already complete",
      });
      continue;
    }

    const excerpt = postExcerpt(post);
    if (!excerpt) {
      result.skipped += 1;
      result.details.push({
        slug: post.slug,
        title: post.title,
        action: "skipped",
        changes: [],
        message: "No excerpt available for meta description / JSON-LD",
      });
      continue;
    }

    if (!post.url) {
      result.errors.push(`${post.slug}: missing post URL`);
      result.details.push({
        slug: post.slug,
        title: post.title,
        action: "error",
        changes: [],
        message: "Missing post URL",
      });
      continue;
    }

    if (!post.updatedAt) {
      result.errors.push(`${post.slug}: missing updated_at (required for Ghost PUT)`);
      result.details.push({
        slug: post.slug,
        title: post.title,
        action: "error",
        changes: [],
        message: "Missing updated_at",
      });
      continue;
    }

    let featureImage = post.featureImage ?? null;
    if (needsImage) {
      if (options.dryRun) {
        changes.push("feature_image (would generate)");
      } else {
        const generated = await generateCoverImage(post.title, excerpt, apiKey!);
        if (generated) {
          featureImage = generated;
          changes.push("feature_image");
        } else {
          result.errors.push(`${post.slug}: cover image generation failed`);
        }
      }
    }

    const seo = buildPostSeoBundle({
      title: post.title,
      slug: post.slug,
      url: post.url,
      excerpt,
      tags: post.tags,
      featureImage,
      publishedAt: post.publishedAt ?? undefined,
      existingFoot: post.codeInjectionFoot,
    });

    const updatePayload: {
      id: string;
      updatedAt: string;
      metaTitle?: string;
      metaDescription?: string;
      codeInjectionFoot?: string;
      featureImage?: string;
    } = {
      id: post.id,
      updatedAt: post.updatedAt,
    };

    if (missing.includes("meta_title") || options.force) {
      updatePayload.metaTitle = seo.metaTitle;
      changes.push("meta_title");
    }
    if (missing.includes("meta_description") || options.force) {
      updatePayload.metaDescription = seo.metaDescription;
      changes.push("meta_description");
    }
    if (missing.includes("json_ld") || options.force) {
      updatePayload.codeInjectionFoot = seo.codeInjectionFoot;
      changes.push("json_ld");
    }
    if (featureImage && featureImage !== post.featureImage) {
      updatePayload.featureImage = featureImage;
    }

    if (changes.length === 0) {
      result.skipped += 1;
      result.details.push({
        slug: post.slug,
        title: post.title,
        action: "skipped",
        changes: [],
        message: "Nothing to update",
      });
      continue;
    }

    if (options.dryRun) {
      result.updated += 1;
      result.details.push({
        slug: post.slug,
        title: post.title,
        action: "updated",
        changes,
        message: "dry run — no API write",
      });
      continue;
    }

    const updateResult = await updateGhostPostSeo(updatePayload);
    if (!updateResult.ok) {
      result.ok = false;
      result.errors.push(`${post.slug}: ${updateResult.error ?? "update failed"}`);
      result.details.push({
        slug: post.slug,
        title: post.title,
        action: "error",
        changes,
        message: updateResult.error,
      });
      continue;
    }

    result.updated += 1;
    result.details.push({
      slug: post.slug,
      title: post.title,
      action: "updated",
      changes,
      message: updateResult.url,
    });

    if (options.injectBacklinks && apiKey) {
      const backlinked = await injectGhostBacklinks(
        post.id,
        post.title,
        excerpt,
        post.slug,
        apiKey,
        model
      );
      if (backlinked.length > 0) {
        changes.push(`backlinks→${backlinked.join(",")}`);
      }
    }
  }

  return result;
}
