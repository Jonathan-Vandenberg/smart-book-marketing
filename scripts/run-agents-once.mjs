import "dotenv/config";
import { runAnalyticsAgent } from "../src/agents/analytics.ts";
import { runContentAgent } from "../src/agents/content.ts";
import { runDailyTipAgent } from "../src/agents/daily-tip.ts";
import { runSignalAgent } from "../src/agents/signal.ts";

const agent = process.argv[2] ?? "all";

const agents = {
  signal: runSignalAgent,
  content: runContentAgent,
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
