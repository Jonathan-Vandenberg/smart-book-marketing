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
