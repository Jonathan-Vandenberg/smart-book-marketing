import { appendAgentRun } from "@/lib/store";

export async function runDailyTipAgent() {
  const message = "Daily tip agent ran — wire Buffer/Typefully publish next.";
  console.log(`[daily-tip] ${message}`);
  return appendAgentRun({ agent: "daily-tip", status: "ok", message });
}
