import fs from "node:fs";
import path from "node:path";
import {
  buildGhostSiteHeadInjection,
  buildLlmsTxt,
  llmsPageHtml,
  mergeSiteHeadInjection,
} from "@/lib/ghost-seo";
import {
  getGhostSetting,
  isGhostConfigured,
  updateGhostSettings,
  upsertGhostLlmsPage,
} from "@/lib/ghost";
import { getEnv } from "@/lib/store";

/** Idempotent: site head meta for indexing + /llms/ page for AI assistants. */
export async function ensureGhostSiteSeo(): Promise<{ ok: boolean; messages: string[] }> {
  if (!isGhostConfigured()) {
    return { ok: false, messages: ["Ghost not configured"] };
  }

  const blogUrl = getEnv("GHOST_URL", "https://blog.smartbookplanner.com");
  const messages: string[] = [];

  const headInjection = buildGhostSiteHeadInjection(blogUrl);
  const existingHead = await getGhostSetting("codeinjection_head");
  const mergedHead = mergeSiteHeadInjection(existingHead, headInjection);

  if (mergedHead !== (existingHead ?? "")) {
    const headResult = await updateGhostSettings([
      { key: "codeinjection_head", value: mergedHead },
    ]);
    if (headResult.ok) {
      messages.push("Updated Ghost site head (index + LLM-friendly meta)");
    } else {
      const snippetPath = path.join(process.cwd(), "config", "ghost-codeinjection-head.html");
      fs.mkdirSync(path.dirname(snippetPath), { recursive: true });
      fs.writeFileSync(snippetPath, mergedHead, "utf8");
      messages.push(
        `Site head must be pasted manually — Ghost does not allow API tokens to update Settings (code injection). Paste config/ghost-codeinjection-head.html into Ghost Admin → Settings → Code injection → Site header.`
      );
    }
  } else {
    messages.push("Ghost site head already configured");
  }

  const llmsTxt = buildLlmsTxt(blogUrl);
  const llmsResult = await upsertGhostLlmsPage(llmsPageHtml(llmsTxt));
  if (llmsResult.ok) {
    messages.push("LLMs page live at /llms/");
  } else {
    messages.push(`LLMs page failed: ${llmsResult.error}`);
  }

  return { ok: true, messages };
}
