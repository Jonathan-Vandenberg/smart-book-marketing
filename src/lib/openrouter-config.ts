import { getEnv } from "@/lib/store";

export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Supports both env var names used across projects. */
export function getOpenRouterApiKey(): string {
  return getEnv("OPENROUTER_API_KEY") || getEnv("OPEN_ROUTER_API_KEY");
}

export function getBlogAiModel(): string {
  return getEnv("BLOG_AI_MODEL") || getEnv("CRON_AI_MODEL") || "x-ai/grok-4.20";
}

export function getBlogImageModel(): string {
  return getEnv("BLOG_IMAGE_MODEL") || getEnv("CRON_IMAGE_MODEL") || "google/gemini-3.1-flash-image-preview";
}

export function openRouterHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "HTTP-Referer": getEnv("GHOST_URL", "https://blog.smartbookplanner.com"),
    "X-Title": "Smart Book Marketing",
  };
}
