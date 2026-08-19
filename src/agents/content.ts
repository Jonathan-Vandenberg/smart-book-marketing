import fs from "node:fs";
import path from "node:path";
import { appendAgentRun, getEnv } from "@/lib/store";
import { pickComparisonTopic } from "@/lib/competitors";
import { createDraft } from "@/lib/drafts";
import { listPlatforms } from "@/lib/platforms";
import { isGhostConfigured } from "@/lib/ghost";
import { getBufferConnectedPlatformSlugs } from "@/lib/buffer";
import { generateBlogPost, generateMarketingPost } from "@/lib/openrouter";

const TOPICS = [
  { pillar: "craft-fiction", topic: "Map your plot on 7 points before chapter one" },
  { pillar: "craft-fiction", topic: "Scene cards beat spreadsheets for novel planning" },
  { pillar: "research-academia", topic: "Build your paper template once, reuse forever" },
  { pillar: "ai-done-right", topic: "AI that reads your whole cast, not just the paragraph" },
  { pillar: "build-in-public", topic: "Shipping Smart Book Planner marketing ops in public" },
];

function pickTopic(index: number) {
  const comparison = pickComparisonTopic(index);
  if (comparison) {
    return {
      pillar: comparison.pillar,
      topic: `${comparison.topic} (${comparison.competitor.name} comparison)`,
    };
  }
  return TOPICS[index % TOPICS.length];
}

export async function runContentAgent() {
  try {
    const bufferSlugs = await getBufferConnectedPlatformSlugs();
    const blogAutoPublish = getEnv("BLOG_AUTO_PUBLISH", "true") === "true";
    const platforms = listPlatforms().filter((p) => {
      if (p.slug === "ghost") {
        if (blogAutoPublish) return false;
        return isGhostConfigured();
      }
      return bufferSlugs.has(p.slug);
    });
    if (platforms.length === 0) {
      return appendAgentRun({
        agent: "content",
        status: "skipped",
        message: "No publishable platforms — connect Ghost and/or link channels in Buffer.",
      });
    }

    const pillarsPath = path.join(process.cwd(), "config", "content-pillars.json");
    const pillars = fs.existsSync(pillarsPath)
      ? (JSON.parse(fs.readFileSync(pillarsPath, "utf8")).pillars as Array<{ id: string; label: string }>)
      : [];

    let created = 0;
    for (const platform of platforms) {
      const pick = pickTopic(created);
      const pillarLabel = pillars.find((p) => p.id === pick.pillar)?.label ?? pick.pillar;
      const body =
        platform.slug === "ghost"
          ? await generateBlogPost({ pillar: pillarLabel, topic: pick.topic })
          : await generateMarketingPost({
              platformName: platform.name,
              pillar: pillarLabel,
              topic: pick.topic,
            });

      const title =
        platform.slug === "ghost"
          ? body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? pick.topic
          : pick.topic;

      createDraft({
        platformId: platform.id,
        body,
        title,
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
