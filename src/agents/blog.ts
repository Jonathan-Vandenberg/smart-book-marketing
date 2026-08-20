import { appendAgentRun } from "@/lib/store";
import { isGhostConfigured } from "@/lib/ghost";
import { dedupeGhostPosts, type DedupeGhostPostsResult } from "@/lib/dedupe-ghost-posts";
import {
  generateAndPublishBlogArticle,
  type BlogPublishResult,
} from "@/lib/generate-blog-article";

export type RunBlogAgentOptions = {
  /** Manual runs from the marketing dashboard. */
  force?: boolean;
  /** Delete duplicate Ghost posts before generating (manual runs). */
  dedupeFirst?: boolean;
};

export type RunBlogAgentResult = {
  run: ReturnType<typeof appendAgentRun>;
  publish?: BlogPublishResult;
  dedupe?: DedupeGhostPostsResult;
};

export async function runBlogAgent(options: RunBlogAgentOptions = {}): Promise<RunBlogAgentResult> {
  try {
    if (!isGhostConfigured()) {
      const message = "Blog agent skipped — Ghost not configured.";
      console.log(`[blog] ${message}`);
      return { run: appendAgentRun({ agent: "blog", status: "skipped", message }) };
    }

    let dedupe: DedupeGhostPostsResult | undefined;
    if (options.dedupeFirst) {
      dedupe = await dedupeGhostPosts(false);
      console.log(`[blog] Dedupe: kept ${dedupe.kept}, deleted ${dedupe.deleted}`);
      if (!dedupe.ok && dedupe.errors.length > 0) {
        const message = `Blog dedupe failed: ${dedupe.errors.join("; ")}`;
        console.error(`[blog] ${message}`);
        return {
          run: appendAgentRun({ agent: "blog", status: "error", message }),
          dedupe,
        };
      }
    }

    const result = await generateAndPublishBlogArticle({ force: options.force });

    if (!result.success) {
      if (result.skipped) {
        const message = `Blog agent skipped: ${result.error ?? "duplicate or recent publish"}`;
        console.log(`[blog] ${message}`);
        return {
          run: appendAgentRun({ agent: "blog", status: "skipped", message }),
          publish: result,
          dedupe,
        };
      }
      const message = `Blog agent failed: ${result.error ?? "unknown error"}`;
      console.error(`[blog] ${message}`);
      return {
        run: appendAgentRun({ agent: "blog", status: "error", message }),
        publish: result,
        dedupe,
      };
    }

    const backlinkNote =
      result.backlinkedSlugs && result.backlinkedSlugs.length > 0
        ? ` Backlinked into ${result.backlinkedSlugs.length} older post(s).`
        : "";

    const message = `Published "${result.title}" → ${result.url ?? result.slug}.${backlinkNote}`;
    console.log(`[blog] ${message}`);
    return {
      run: appendAgentRun({ agent: "blog", status: "ok", message }),
      publish: result,
      dedupe,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Blog agent failed";
    console.error("[blog]", message);
    return { run: appendAgentRun({ agent: "blog", status: "error", message }) };
  }
}
