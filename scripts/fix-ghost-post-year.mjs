/**
 * Replace wrong calendar year in a Ghost post (default: 2025 → 2026).
 * Usage: node --import tsx scripts/fix-ghost-post-year.mjs [slug] [fromYear] [toYear]
 */
import "./load-env.mjs";
import {
  fetchGhostPost,
  listPublishedGhostPostsForSeo,
  updateGhostPostContent,
} from "../src/lib/ghost.ts";

const slug = process.argv[2] ?? "how-to-market-a-self-published-book";
const fromYear = process.argv[3] ?? "2025";
const toYear = process.argv[4] ?? "2026";

function replaceYear(text, from, to) {
  if (!text) return text;
  return text.replaceAll(from, to);
}

const posts = await listPublishedGhostPostsForSeo();
const meta = posts.find((p) => p.slug === slug);

if (!meta) {
  console.error(`Post not found: ${slug}`);
  process.exit(1);
}

const full = await fetchGhostPost(meta.id);
if (!full?.html || !full.updatedAt) {
  console.error(`Could not fetch full post: ${slug}`);
  process.exit(1);
}

const newTitle = replaceYear(full.title, fromYear, toYear);
const newHtml = replaceYear(full.html, fromYear, toYear);
const newExcerpt = replaceYear(meta.customExcerpt ?? meta.excerpt ?? "", fromYear, toYear);
const newMetaTitle = replaceYear(meta.metaTitle ?? "", fromYear, toYear);
const newMetaDesc = replaceYear(meta.metaDescription ?? "", fromYear, toYear);

console.log(`Updating "${full.title}"`);
console.log(`  title → ${newTitle}`);

const result = await updateGhostPostContent({
  id: full.id,
  updatedAt: full.updatedAt,
  title: newTitle,
  html: newHtml,
  customExcerpt: newExcerpt || undefined,
  metaTitle: newMetaTitle || undefined,
  metaDescription: newMetaDesc || undefined,
});

if (!result.ok) {
  console.error("Update failed:", result.error);
  process.exit(1);
}

console.log(`✓ Updated: ${result.url ?? slug}`);
