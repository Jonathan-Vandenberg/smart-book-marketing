import "./load-env.mjs";
import { dedupeGhostPosts } from "../src/lib/dedupe-ghost-posts.ts";

const dryRun = process.argv.includes("--dry-run");
console.log(`[ghost:dedupe] ${dryRun ? "DRY RUN" : "LIVE"}`);

const result = await dedupeGhostPosts(dryRun);

for (const d of result.details) {
  console.log(`${d.action === "kept" ? "✓ keep" : "✗ delete"} ${d.slug} — ${d.title}`);
}

console.log(`\nKept: ${result.kept} | Deleted: ${result.deleted}`);
if (result.errors.length) {
  console.error("Errors:", result.errors.join("\n"));
}

process.exit(result.ok ? 0 : 1);
