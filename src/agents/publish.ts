import { appendAgentRun } from "@/lib/store";
import { getDraft, listDrafts, updateDraftStatus } from "@/lib/drafts";
import { publishToBuffer } from "@/lib/buffer";
import { bodyToGhostHtml, publishToGhost } from "@/lib/ghost";

const BUFFER_PLATFORMS = new Set(["x", "linkedin", "instagram", "threads", "facebook"]);

type DraftToPublish = { id: number; platformSlug: string; title: string | null; body: string };

async function publishDraft(draft: DraftToPublish) {
  if (draft.platformSlug === "ghost") {
    const html = bodyToGhostHtml(draft.body);
    const title =
      draft.title ??
      draft.body.match(/^#\s+(.+)$/m)?.[1]?.trim() ??
      "Smart Book Planner";
    return publishToGhost({ title, html, status: "published", tags: ["smart-book-planner"] });
  }

  if (BUFFER_PLATFORMS.has(draft.platformSlug)) {
    const result = await publishToBuffer(draft.body);
    return { ok: result.ok, id: result.id, url: result.id ? `buffer:${result.id}` : undefined, error: result.error };
  }

  return { ok: false, error: `No publisher configured for platform: ${draft.platformSlug}` };
}

export async function publishDraftById(id: number): Promise<{ ok: boolean; error?: string; url?: string }> {
  const draft = getDraft(id);
  if (!draft) {
    return { ok: false, error: "Draft not found" };
  }
  if (draft.status !== "approved" && draft.status !== "scheduled") {
    return { ok: false, error: `Draft must be approved or scheduled (current: ${draft.status})` };
  }

  const result = await publishDraft(draft);
  if (result.ok) {
    updateDraftStatus(draft.id, "published", {
      publishedAt: new Date().toISOString(),
      externalUrl: result.url,
    });
    await appendAgentRun({
      agent: "publish",
      status: "ok",
      message: `Published draft #${draft.id} (${draft.platformSlug}) immediately.`,
    });
    return { ok: true, url: result.url };
  }

  await appendAgentRun({
    agent: "publish",
    status: "error",
    message: `Publish now failed for draft #${draft.id}: ${result.error ?? "unknown"}`,
  });
  return { ok: false, error: result.error };
}

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
      const result = await publishDraft(draft);
      if (result.ok) {
        updateDraftStatus(draft.id, "published", {
          publishedAt: new Date().toISOString(),
          externalUrl: result.url,
        });
        published += 1;
      } else {
        errors.push(`${draft.platformSlug}: ${result.error ?? "unknown"}`);
      }
    }

    const message =
      published > 0
        ? `Published ${published} draft(s)${errors.length ? `; ${errors.length} failed` : ""}.`
        : `Publish failed — ${errors[0] ?? "configure BUFFER_ACCESS_TOKEN or GHOST_ADMIN_API_KEY"}`;

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

export async function shareGhostPostToBuffer(post: { title?: string; url?: string }) {
  if (!post.url) {
    return { ok: false, error: "No post URL" };
  }
  const title = post.title ?? "New on the Smart Book Planner blog";
  const text = `${title}\n\n${post.url}\n\nPlan your manuscript → https://smartbookplanner.com`;
  return publishToBuffer(text, undefined, "shareNow");
}
