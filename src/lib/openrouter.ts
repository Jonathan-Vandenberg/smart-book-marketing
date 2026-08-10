import fs from "node:fs";
import path from "node:path";
import { getEnv } from "@/lib/store";

export async function generateMarketingPost(input: {
  platformName: string;
  pillar: string;
  topic: string;
}): Promise<string> {
  const apiKey = getEnv("OPENROUTER_API_KEY");
  const brandVoicePath = path.join(process.cwd(), "config", "brand-voice.md");
  const brandVoice = fs.existsSync(brandVoicePath)
    ? fs.readFileSync(brandVoicePath, "utf8")
    : "";

  if (!apiKey) {
    return `[${input.platformName} · ${input.pillar}]\n\n${input.topic}\n\nStart your manuscript → https://smartbookplanner.com`;
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://marketing.smartbookplanner.com",
      "X-Title": "Smart Book Marketing",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: brandVoice },
        {
          role: "user",
          content: `Write a ${input.platformName} post for pillar "${input.pillar}" about: ${input.topic}. Keep it concise and ready to publish. Include CTA to smartbookplanner.com.`,
        },
      ],
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter error: ${res.status}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || input.topic;
}

export async function generateBlogPost(input: {
  pillar: string;
  topic: string;
}): Promise<string> {
  const apiKey = getEnv("OPENROUTER_API_KEY");
  const brandVoicePath = path.join(process.cwd(), "config", "brand-voice.md");
  const brandVoice = fs.existsSync(brandVoicePath)
    ? fs.readFileSync(brandVoicePath, "utf8")
    : "";

  if (!apiKey) {
    return `# ${input.topic}\n\n${input.topic}\n\nStart your manuscript → https://smartbookplanner.com`;
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://marketing.smartbookplanner.com",
      "X-Title": "Smart Book Marketing",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: brandVoice },
        {
          role: "user",
          content: `Write an SEO blog article for Smart Book Planner about: ${input.topic} (pillar: ${input.pillar}).

Requirements:
- 600–900 words
- Use markdown: one # title, ## subheadings, short paragraphs, bullet lists with * or -
- Practical advice for novelists, memoirists, or researchers
- Mention Smart Book Planner naturally once near the end
- CTA: Start your manuscript → https://smartbookplanner.com`,
        },
      ],
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter error: ${res.status}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || input.topic;
}

export async function generateBlogPromoPost(input: {
  platformName: string;
  articleTitle: string;
  articleUrl: string;
  excerpt?: string | null;
}): Promise<string> {
  const apiKey = getEnv("OPENROUTER_API_KEY");
  const brandVoicePath = path.join(process.cwd(), "config", "brand-voice.md");
  const brandVoice = fs.existsSync(brandVoicePath)
    ? fs.readFileSync(brandVoicePath, "utf8")
    : "";

  const excerptLine = input.excerpt ? `\nArticle summary: ${input.excerpt.slice(0, 280)}` : "";

  if (!apiKey) {
    return `New on the blog: ${input.articleTitle}\n\n${input.articleUrl}\n\nStart your manuscript → https://smartbookplanner.com`;
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://marketing.smartbookplanner.com",
      "X-Title": "Smart Book Marketing",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: brandVoice },
        {
          role: "user",
          content: `Write a ${input.platformName} post promoting our latest blog article.

Article title: ${input.articleTitle}
Article URL (must include exactly once in the post): ${input.articleUrl}${excerptLine}

Requirements:
- Short, engaging promo — not a full article summary
- Include the article URL on its own line
- End with CTA: Start your manuscript → https://smartbookplanner.com
- Ready to publish as plain text (no markdown headers)`,
        },
      ],
      max_tokens: 400,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter error: ${res.status}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (content) return content;

  return `New on the blog: ${input.articleTitle}\n\n${input.articleUrl}\n\nStart your manuscript → https://smartbookplanner.com`;
}
