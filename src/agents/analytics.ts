import { appendAgentRun } from "@/lib/store";

export async function runAnalyticsAgent() {
  const message = "Analytics agent ran — wire GA4 property + service account next.";
  console.log(`[analytics] ${message}`);
  return appendAgentRun({ agent: "analytics", status: "ok", message });
}
