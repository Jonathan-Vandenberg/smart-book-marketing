"use server";

import { revalidatePath } from "next/cache";
import { createDraft, deleteDraft, updateDraftStatus } from "@/lib/drafts";
import { runContentAgent } from "@/agents/content";
import { runPublishAgent } from "@/agents/publish";

export async function approveDraftAction(formData: FormData) {
  const id = Number(formData.get("draftId"));
  if (!id) return;
  updateDraftStatus(id, "approved");
  revalidatePath("/drafts");
  revalidatePath("/");
  revalidatePath("/calendar");
}

export async function rejectDraftAction(formData: FormData) {
  const id = Number(formData.get("draftId"));
  if (!id) return;
  updateDraftStatus(id, "rejected");
  revalidatePath("/drafts");
  revalidatePath("/");
}

export async function scheduleDraftAction(formData: FormData) {
  const id = Number(formData.get("draftId"));
  const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();
  if (!id || !scheduledAt) return;
  updateDraftStatus(id, "scheduled", { scheduledAt: new Date(scheduledAt).toISOString() });
  revalidatePath("/drafts");
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function deleteDraftAction(formData: FormData) {
  const id = Number(formData.get("draftId"));
  if (!id) return;
  deleteDraft(id);
  revalidatePath("/drafts");
  revalidatePath("/");
}

export async function createDraftAction(formData: FormData) {
  const platformId = Number(formData.get("platformId"));
  const body = String(formData.get("body") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const pillar = String(formData.get("pillar") ?? "").trim();
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();

  if (!platformId || !body) return;

  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw).toISOString() : undefined;

  createDraft({
    platformId,
    body,
    title: title || undefined,
    pillar: pillar || undefined,
    status: scheduledAt ? "scheduled" : "draft",
    scheduledAt,
    agentSource: "manual",
  });

  revalidatePath("/drafts");
  revalidatePath("/");
  revalidatePath("/calendar");
}

export async function runContentAgentAction() {
  await runContentAgent();
  revalidatePath("/drafts");
  revalidatePath("/agents");
  revalidatePath("/");
}

export async function runPublishAgentAction() {
  await runPublishAgent();
  revalidatePath("/drafts");
  revalidatePath("/agents");
  revalidatePath("/");
}
