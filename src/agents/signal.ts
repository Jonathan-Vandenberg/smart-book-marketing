import fs from "node:fs";
import path from "node:path";
import { appendAgentRun } from "@/lib/store";

export async function runSignalAgent() {
  const brandVoicePath = path.join(process.cwd(), "config", "brand-voice.md");
  const brandVoice = fs.existsSync(brandVoicePath)
    ? fs.readFileSync(brandVoicePath, "utf8")
    : "";

  const message = brandVoice
    ? "Signal agent ran — brand voice loaded; wire GSC + F5Bot next."
    : "Signal agent ran — add config/brand-voice.md";

  console.log(`[signal] ${message}`);
  return appendAgentRun({ agent: "signal", status: "ok", message });
}
