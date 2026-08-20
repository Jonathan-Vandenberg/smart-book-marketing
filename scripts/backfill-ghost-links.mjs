import "./load-env.mjs";
import { backfillBacklinksToLatestPost } from "../src/lib/generate-blog-article.ts";

const result = await backfillBacklinksToLatestPost();
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
