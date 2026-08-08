import { appendAgentRun } from "@/lib/store";

export async function runContentAgent() {
  const message = "Content agent ran — wire OpenRouter + review queue next.";
  console.log(`[content] ${message}`);
  return appendAgentRun({ agent: "content", status: "ok", message });
}
