import "./load-env.mjs";
import { runAnalyticsAgent } from "../src/agents/analytics.ts";
import { runBlogAgent } from "../src/agents/blog.ts";
import { runContentAgent } from "../src/agents/content.ts";
import { runDailyTipAgent } from "../src/agents/daily-tip.ts";
import { runPublishAgent } from "../src/agents/publish.ts";
import { runSignalAgent } from "../src/agents/signal.ts";

const agent = process.argv[2] ?? "all";

const agents = {
  signal: runSignalAgent,
  content: runContentAgent,
  blog: runBlogAgent,
  publish: runPublishAgent,
  analytics: runAnalyticsAgent,
  "daily-tip": runDailyTipAgent,
};

async function main() {
  if (agent === "all") {
    for (const fn of Object.values(agents)) {
      await fn();
    }
    return;
  }

  const fn = agents[agent];
  if (!fn) {
    console.error(`Unknown agent: ${agent}`);
    process.exit(1);
  }
  await fn();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
