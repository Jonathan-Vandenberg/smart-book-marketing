/** SEO topic silos for the Smart Book Planner blog (Ghost tags + AI prompt context). */
export type BlogTopic = {
  slug: string;
  name: string;
  keywords: string[];
  targetQueries: string[];
};

export const BLOG_TOPICS: BlogTopic[] = [
  {
    slug: "craft-fiction",
    name: "Craft & planning (fiction)",
    keywords: [
      "novel planning",
      "plot structure",
      "scene cards",
      "character development",
      "fiction writing",
    ],
    targetQueries: [
      "how to plan a novel before writing chapter one",
      "7 plot points novel structure",
      "scene card workflow for fiction",
    ],
  },
  {
    slug: "research-academia",
    name: "Research & academia",
    keywords: [
      "academic writing",
      "research paper template",
      "citation styles",
      "thesis planning",
      "fact checking research",
    ],
    targetQueries: [
      "research paper template workflow",
      "APA MLA Chicago citation workflow",
      "how to fact check before submitting a paper",
    ],
  },
  {
    slug: "ai-done-right",
    name: "AI done right for writers",
    keywords: [
      "AI writing assistant",
      "AI for novelists",
      "manuscript consistency",
      "BYOK OpenRouter",
      "writing with AI ethically",
    ],
    targetQueries: [
      "AI that remembers your whole cast",
      "best AI tools for novel planning",
      "AI writing assistant vs blank page ChatGPT",
    ],
  },
  {
    slug: "build-in-public",
    name: "Build in public",
    keywords: [
      "indie author tools",
      "writing software",
      "author productivity",
      "self publishing workflow",
      "manuscript export",
    ],
    targetQueries: [
      "best book planning software for indie authors",
      "export manuscript to Kindle EPUB PDF",
      "writing app for researchers and novelists",
    ],
  },
  {
    slug: "publishing-marketing",
    name: "Publishing & book marketing",
    keywords: [
      "book marketing",
      "author platform",
      "self publishing",
      "book launch",
      "author newsletter",
    ],
    targetQueries: [
      "how to market a self published book",
      "author platform before launch",
      "book marketing for first time authors",
    ],
  },
];

export function getBlogTopicBySlug(slug: string): BlogTopic | undefined {
  return BLOG_TOPICS.find((t) => t.slug === slug);
}

export function topicGuideForPrompt(): string {
  return BLOG_TOPICS.map(
    (t) => `- ${t.slug}: ${t.name} (targets: ${t.targetQueries.slice(0, 2).join("; ")})`
  ).join("\n");
}
