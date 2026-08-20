import {
  deleteGhostPost,
  isGhostConfigured,
  listPublishedGhostPostsForSeo,
} from "@/lib/ghost";
import { normalizeBlogTitle, scorePostForKeep } from "@/lib/blog-dedup";

export type DedupeGhostPostsResult = {
  ok: boolean;
  kept: number;
  deleted: number;
  errors: string[];
  details: Array<{ action: "kept" | "deleted"; slug: string; title: string }>;
};

/** Remove duplicate published posts (same normalized title). Keeps best SEO/cover/canonical slug. */
export async function dedupeGhostPosts(dryRun = false): Promise<DedupeGhostPostsResult> {
  const result: DedupeGhostPostsResult = {
    ok: true,
    kept: 0,
    deleted: 0,
    errors: [],
    details: [],
  };

  if (!isGhostConfigured()) {
    result.ok = false;
    result.errors.push("Ghost not configured");
    return result;
  }

  const posts = await listPublishedGhostPostsForSeo();
  const groups = new Map<string, typeof posts>();

  for (const post of posts) {
    const key = normalizeBlogTitle(post.title);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(post);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    if (group.length <= 1) {
      result.kept += 1;
      continue;
    }

    const sorted = [...group].sort(
      (a, b) => scorePostForKeep(b) - scorePostForKeep(a)
    );
    const [keep, ...remove] = sorted;

    result.details.push({ action: "kept", slug: keep.slug, title: keep.title });
    result.kept += 1;

    for (const post of remove) {
      if (!post.updatedAt) {
        result.errors.push(`${post.slug}: missing updated_at`);
        continue;
      }

      if (dryRun) {
        result.deleted += 1;
        result.details.push({ action: "deleted", slug: post.slug, title: post.title });
        continue;
      }

      const del = await deleteGhostPost({ id: post.id, updatedAt: post.updatedAt });
      if (del.ok) {
        result.deleted += 1;
        result.details.push({ action: "deleted", slug: post.slug, title: post.title });
      } else {
        result.ok = false;
        result.errors.push(`${post.slug}: ${del.error ?? "delete failed"}`);
      }
    }
  }

  return result;
}
