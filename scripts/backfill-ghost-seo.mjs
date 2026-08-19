import "./load-env.mjs";
import { backfillGhostPostsSeo } from "../src/lib/backfill-ghost-seo.ts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const generateImages = args.includes("--images");
const injectBacklinks = args.includes("--backlinks");
const force = args.includes("--force");
const slugArg = args.find((a) => a.startsWith("--slug="));
const slug = slugArg ? slugArg.slice("--slug=".length) : undefined;

console.log(
  [
    "[ghost:backfill-seo]",
    dryRun ? "DRY RUN" : "LIVE",
    slug ? `slug=${slug}` : "all posts",
    generateImages ? "+images" : "",
    injectBacklinks ? "+backlinks" : "",
    force ? "+force" : "",
  ]
    .filter(Boolean)
    .join(" ")
);

const result = await backfillGhostPostsSeo({
  dryRun,
  slug,
  generateImages,
  injectBacklinks,
  force,
});

for (const detail of result.details) {
  const label =
    detail.action === "updated"
      ? "✓"
      : detail.action === "skipped"
        ? "–"
        : "✗";
  const changeList = detail.changes.length > 0 ? ` [${detail.changes.join(", ")}]` : "";
  const msg = detail.message ? ` — ${detail.message}` : "";
  console.log(`${label} ${detail.slug}${changeList}${msg}`);
}

console.log(
  `\nProcessed: ${result.processed} | Updated: ${result.updated} | Skipped: ${result.skipped}`
);

if (result.errors.length > 0) {
  console.error("\nErrors:");
  for (const err of result.errors) console.error(`  - ${err}`);
}

process.exit(result.ok ? 0 : 1);
