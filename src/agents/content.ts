import fs from "node:fs";
import path from "node:path";
import { appendAgentRun } from "@/lib/store";
import { createDraft } from "@/lib/drafts";
import { listPlatforms } from "@/lib/platforms";
import { generateMarketingPost } from "@/lib/openrouter";

const TOPICS = [
  { pillar: "craft-fiction", topic: "Map your plot on 7 points before chapter one" },
  { pillar: "craft-fiction", topic: "Scene cards beat spreadsheets for novel planning" },
  { pillar: "research-academia", topic: "Build your paper template once, reuse forever" },
  { pillar: "ai-done-right", topic: "AI that reads your whole cast, not just the paragraph" },
  { pillar: "build-in-public", topic: "Shipping Smart Book Planner marketing ops in public" },
];

export async function runContentAgent() {
  try {
    const platforms = listPlatforms().filter((p) => ["x", "linkedin", "beehiiv"].includes(p.slug));
    if (platforms.length === 0) {
      return appendAgentRun({ agent: "content", status: "skipped", message: "No target platforms found" });
    }

    const pillarsPath = path.join(process.cwd(), "config", "content-pillars.json");
    const pillars = fs.existsSync(pillarsPath)
      ? (JSON.parse(fs.readFileSync(pillarsPath, "utf8")).pillars as Array<{ id: string; label: string }>)
      : [];

    let created = 0;
    for (const platform of platforms) {
      const pick = TOPICS[created % TOPICS.length];
      const pillarLabel = pillars.find((p) => p.id === pick.pillar)?.label ?? pick.pillar;
      const body = await generateMarketingPost({
        platformName: platform.name,
        pillar: pillarLabel,
        topic: pick.topic,
      });

      createDraft({
        platformId: platform.id,
        body,
        title: pick.topic,
        pillar: pick.pillar,
        agentSource: "content-agent",
      });
      created += 1;
    }

    const message = `Content agent created ${created} draft(s) for review.`;
    console.log(`[content] ${message}`);
    return appendAgentRun({ agent: "content", status: "ok", message });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Content agent failed";
    console.error("[content]", message);
    return appendAgentRun({ agent: "content", status: "error", message });
  }
}
