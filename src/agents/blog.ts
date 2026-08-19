import { appendAgentRun } from "@/lib/store";
import { isGhostConfigured } from "@/lib/ghost";
import { generateAndPublishBlogArticle } from "@/lib/generate-blog-article";

export async function runBlogAgent() {
  try {
    if (!isGhostConfigured()) {
      const message = "Blog agent skipped — Ghost not configured.";
      console.log(`[blog] ${message}`);
      return appendAgentRun({ agent: "blog", status: "skipped", message });
    }

    const result = await generateAndPublishBlogArticle();

    if (!result.success) {
      const message = `Blog agent failed: ${result.error ?? "unknown error"}`;
      console.error(`[blog] ${message}`);
      return appendAgentRun({ agent: "blog", status: "error", message });
    }

    const backlinkNote =
      result.backlinkedSlugs && result.backlinkedSlugs.length > 0
        ? ` Backlinked into ${result.backlinkedSlugs.length} older post(s).`
        : "";

    const message = `Published "${result.title}" → ${result.url ?? result.slug}.${backlinkNote}`;
    console.log(`[blog] ${message}`);
    return appendAgentRun({ agent: "blog", status: "ok", message });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Blog agent failed";
    console.error("[blog]", message);
    return appendAgentRun({ agent: "blog", status: "error", message });
  }
}
