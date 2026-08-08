import fs from "node:fs";
import path from "node:path";
import { getEnv } from "@/lib/store";

function serviceAccountKeyExists(): boolean {
  const keyPath = getEnv("GOOGLE_SERVICE_ACCOUNT_KEY_PATH");
  if (!keyPath) return false;
  return fs.existsSync(path.join(process.cwd(), keyPath));
}

export function isGa4Configured(): boolean {
  return Boolean(getEnv("GA4_PROPERTY_ID")) && serviceAccountKeyExists();
}

export function isGscConfigured(): boolean {
  return Boolean(getEnv("GSC_SITE_URL")) && serviceAccountKeyExists();
}

export function isBufferConfigured(): boolean {
  return Boolean(getEnv("BUFFER_ACCESS_TOKEN"));
}

export function isBeehiivConfigured(): boolean {
  return Boolean(getEnv("BEEHIIV_API_KEY"));
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(getEnv("OPENROUTER_API_KEY"));
}

/** Live API connection status derived from env vars (not manual DB toggles). */
export function resolvePlatformApiConnected(slug: string): boolean {
  switch (slug) {
    case "google-analytics":
      return isGa4Configured();
    case "search-console":
      return isGscConfigured();
    case "buffer":
      return isBufferConfigured();
    case "beehiiv":
      return isBeehiivConfigured();
    case "x":
    case "linkedin":
    case "instagram":
    case "threads":
      return isBufferConfigured();
    default:
      return false;
  }
}

export function listIntegrationStatus() {
  return [
    {
      name: "Google Analytics 4",
      configured: isGa4Configured(),
      note: "GA4_PROPERTY_ID + GOOGLE_SERVICE_ACCOUNT_KEY_PATH",
    },
    {
      name: "Google Search Console",
      configured: isGscConfigured(),
      note: "GSC_SITE_URL + service account key",
    },
    {
      name: "OpenRouter",
      configured: isOpenRouterConfigured(),
      note: "OPENROUTER_API_KEY",
    },
    {
      name: "Buffer",
      configured: isBufferConfigured(),
      note: "BUFFER_ACCESS_TOKEN",
    },
  ];
}
