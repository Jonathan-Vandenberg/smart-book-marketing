import "./load-env.mjs";
import { ensureGhostSiteSeo } from "../src/lib/ensure-ghost-seo.ts";
import { buildAiFriendlyRobotsTxt } from "../src/lib/ghost-seo.ts";
import { getEnv } from "../src/lib/store.ts";
import fs from "node:fs";
import path from "node:path";

const result = await ensureGhostSiteSeo();
console.log(result.messages.join("\n"));

const blogUrl = getEnv("GHOST_URL", "https://blog.smartbookplanner.com");
const robotsTxt = buildAiFriendlyRobotsTxt(blogUrl);
const outPath = path.join(process.cwd(), "config", "ghost-robots-ai.txt");
fs.writeFileSync(outPath, robotsTxt, "utf8");
console.log(`\nWrote AI-friendly robots.txt reference to ${outPath}`);
console.log("If Ghost theme supports custom robots.txt, paste that file there.");
console.log(`LLMs page: ${blogUrl.replace(/\/$/, "")}/llms/`);

process.exit(result.ok ? 0 : 1);
