import fs from "node:fs";
import path from "node:path";

export type Competitor = {
  slug: string;
  name: string;
  url: string;
  category: string;
  overlap: string;
  ourEdge: string;
  comparisonAngle: string;
  seoKeywords: string[];
  contentTopics: string[];
};

export type CompetitorTier = {
  id: string;
  label: string;
  competitors: Competitor[];
};

export type CompetitorsConfig = {
  product: string;
  productUrl: string;
  positioning: Record<string, string>;
  priorityForSeo: string[];
  tiers: CompetitorTier[];
  comparisonPostTemplates: string[];
  alternativeToTags: string[];
};

let cached: CompetitorsConfig | null = null;

export function loadCompetitorsConfig(): CompetitorsConfig {
  if (cached) return cached;

  const configPath = path.join(process.cwd(), "config", "competitors.json");
  if (!fs.existsSync(configPath)) {
    return {
      product: "Smart Book Planner",
      productUrl: "https://smartbookplanner.com",
      positioning: {},
      priorityForSeo: [],
      tiers: [],
      comparisonPostTemplates: [],
      alternativeToTags: [],
    };
  }

  cached = JSON.parse(fs.readFileSync(configPath, "utf8")) as CompetitorsConfig;
  return cached;
}

export function listAllCompetitors(): Competitor[] {
  return loadCompetitorsConfig().tiers.flatMap((tier) => tier.competitors);
}

export function getCompetitorBySlug(slug: string): Competitor | null {
  return listAllCompetitors().find((c) => c.slug === slug) ?? null;
}

export function getPriorityCompetitors(): Competitor[] {
  const config = loadCompetitorsConfig();
  const bySlug = new Map(listAllCompetitors().map((c) => [c.slug, c]));
  return config.priorityForSeo
    .map((slug) => bySlug.get(slug))
    .filter((c): c is Competitor => Boolean(c));
}

/** Pick a comparison topic for the content agent (rotates by index). */
export function pickComparisonTopic(index: number): {
  pillar: string;
  topic: string;
  competitor: Competitor;
} | null {
  const competitors = getPriorityCompetitors();
  if (competitors.length === 0) return null;

  const competitor = competitors[index % competitors.length];
  const topicIndex = Math.floor(index / competitors.length) % competitor.contentTopics.length;
  const pillar =
    competitor.category.includes("research") || competitor.category.includes("academic")
      ? "research-academia"
      : competitor.category.includes("ai")
        ? "ai-done-right"
        : "craft-fiction";

  return {
    pillar,
    topic: competitor.contentTopics[topicIndex],
    competitor,
  };
}
