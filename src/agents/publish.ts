import { appendAgentRun } from "@/lib/store";
import { listDrafts, updateDraftStatus } from "@/lib/drafts";
import { publishToBuffer } from "@/lib/buffer";

export async function runPublishAgent() {
  try {
    const approved = listDrafts("approved");
    const due = listDrafts("scheduled").filter((d) => {
      if (!d.scheduledAt) return false;
      return new Date(d.scheduledAt).getTime() <= Date.now();
    });

    const queue = [...approved, ...due];
    if (queue.length === 0) {
      const message = "Publish agent: nothing approved or due.";
      console.log(`[publish] ${message}`);
      return appendAgentRun({ agent: "publish", status: "skipped", message });
    }

    let published = 0;
    const errors: string[] = [];

    for (const draft of queue) {
      const result = await publishToBuffer(draft.body);
      if (result.ok) {
        updateDraftStatus(draft.id, "published", {
          publishedAt: new Date().toISOString(),
          externalUrl: result.id ? `buffer:${result.id}` : undefined,
        });
        published += 1;
      } else {
        errors.push(`${draft.platformSlug}: ${result.error ?? "unknown"}`);
      }
    }

    const message =
      published > 0
        ? `Published ${published} draft(s)${errors.length ? `; ${errors.length} failed` : ""}.`
        : `Publish failed — ${errors[0] ?? "configure BUFFER_ACCESS_TOKEN"}`;

    console.log(`[publish] ${message}`);
    return appendAgentRun({
      agent: "publish",
      status: published > 0 ? "ok" : "error",
      message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish agent failed";
    console.error("[publish]", message);
    return appendAgentRun({ agent: "publish", status: "error", message });
  }
}
