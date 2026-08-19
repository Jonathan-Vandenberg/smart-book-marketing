import "./load-env.mjs";
import { generateAndPublishBlogArticle } from "../src/lib/generate-blog-article.ts";

const result = await generateAndPublishBlogArticle();
console.log(JSON.stringify(result, null, 2));
process.exit(result.success ? 0 : 1);
