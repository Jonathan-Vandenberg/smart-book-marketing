import cron from "node-cron";
import { runAnalyticsAgent } from "@/agents/analytics";
import { runBlogAgent } from "@/agents/blog";
import { runContentAgent } from "@/agents/content";
import { runDailyTipAgent } from "@/agents/daily-tip";
import { runPublishAgent } from "@/agents/publish";
import { runSignalAgent } from "@/agents/signal";
import { agentsEnabled, getEnv } from "@/lib/store";

let started = false;

export function startScheduler() {
  if (started || !agentsEnabled()) {
    console.log("[scheduler] Agents disabled or already started");
    return;
  }
  started = true;

  const jobs = [
    { name: "signal", expr: getEnv("SIGNAL_CRON", "0 6 * * 1"), fn: runSignalAgent },
    { name: "content", expr: getEnv("CONTENT_CRON", "0 7 * * 1"), fn: runContentAgent },
    { name: "blog", expr: getEnv("BLOG_CRON", "0 9 * * *"), fn: runBlogAgent },
    { name: "publish", expr: getEnv("PUBLISH_CRON", "0 8 * * *"), fn: runPublishAgent },
    { name: "analytics", expr: getEnv("ANALYTICS_CRON", "0 6 * * 5"), fn: runAnalyticsAgent },
    { name: "daily-tip", expr: getEnv("DAILY_TIP_CRON", "0 12 * * *"), fn: runDailyTipAgent },
  ];

  for (const job of jobs) {
    if (!cron.validate(job.expr)) {
      console.warn(`[scheduler] Invalid cron for ${job.name}: ${job.expr}`);
      continue;
    }
    cron.schedule(job.expr, () => {
      void job.fn().catch((err) => {
        console.error(`[scheduler] ${job.name} failed`, err);
      });
    });
    console.log(`[scheduler] Registered ${job.name}: ${job.expr}`);
  }

  console.log("[scheduler] Marketing agents running");
}
