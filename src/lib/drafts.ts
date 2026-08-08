import { getDb } from "@/lib/db";
import type { ContentDraft, DashboardStats, DraftStatus } from "@/lib/types";

function mapDraft(row: Record<string, unknown>): ContentDraft {
  return {
    id: row.id as number,
    platformId: row.platform_id as number,
    platformSlug: row.platform_slug as string,
    platformName: row.platform_name as string,
    pillar: (row.pillar as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    body: row.body as string,
    status: row.status as DraftStatus,
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    publishedAt: (row.published_at as string | null) ?? null,
    externalUrl: (row.external_url as string | null) ?? null,
    agentSource: (row.agent_source as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const DRAFT_SELECT = `
  SELECT d.*, p.slug AS platform_slug, p.name AS platform_name
  FROM content_drafts d
  JOIN platforms p ON p.id = d.platform_id
`;

export function listDrafts(status?: DraftStatus): ContentDraft[] {
  const db = getDb();
  if (status) {
    const rows = db.prepare(`${DRAFT_SELECT} WHERE d.status = ? ORDER BY d.updated_at DESC`).all(status);
    return rows.map((row) => mapDraft(row as Record<string, unknown>));
  }
  const rows = db.prepare(`${DRAFT_SELECT} ORDER BY d.updated_at DESC`).all();
  return rows.map((row) => mapDraft(row as Record<string, unknown>));
}

export function getDraft(id: number): ContentDraft | null {
  const row = getDb().prepare(`${DRAFT_SELECT} WHERE d.id = ?`).get(id);
  return row ? mapDraft(row as Record<string, unknown>) : null;
}

export function createDraft(input: {
  platformId: number;
  body: string;
  title?: string;
  pillar?: string;
  status?: DraftStatus;
  scheduledAt?: string;
  agentSource?: string;
}): ContentDraft {
  const result = getDb()
    .prepare(
      `INSERT INTO content_drafts (platform_id, pillar, title, body, status, scheduled_at, agent_source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(
      input.platformId,
      input.pillar ?? null,
      input.title ?? null,
      input.body,
      input.status ?? "draft",
      input.scheduledAt ?? null,
      input.agentSource ?? null,
    );

  const draft = getDraft(Number(result.lastInsertRowid));
  if (!draft) throw new Error("Failed to create draft");
  return draft;
}

export function updateDraftStatus(id: number, status: DraftStatus, extra?: { scheduledAt?: string; publishedAt?: string; externalUrl?: string }) {
  getDb()
    .prepare(
      `UPDATE content_drafts
       SET status = ?, scheduled_at = COALESCE(?, scheduled_at), published_at = COALESCE(?, published_at),
           external_url = COALESCE(?, external_url), updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      status,
      extra?.scheduledAt ?? null,
      extra?.publishedAt ?? null,
      extra?.externalUrl ?? null,
      id,
    );
}

export function listScheduledDue(nowIso: string): ContentDraft[] {
  const rows = getDb()
    .prepare(
      `${DRAFT_SELECT}
       WHERE d.status = 'scheduled' AND d.scheduled_at IS NOT NULL AND d.scheduled_at <= ?
       ORDER BY d.scheduled_at ASC`,
    )
    .all(nowIso);
  return rows.map((row) => mapDraft(row as Record<string, unknown>));
}

export function listDraftsInRange(startIso: string, endIso: string): ContentDraft[] {
  const rows = getDb()
    .prepare(
      `${DRAFT_SELECT}
       WHERE d.scheduled_at IS NOT NULL AND d.scheduled_at >= ? AND d.scheduled_at < ?
       ORDER BY d.scheduled_at ASC`,
    )
    .all(startIso, endIso);
  return rows.map((row) => mapDraft(row as Record<string, unknown>));
}

export function getDashboardStats(): DashboardStats {
  const db = getDb();
  const platformCount = (db.prepare("SELECT COUNT(*) as c FROM platforms").get() as { c: number }).c;
  const draftCount = (db.prepare("SELECT COUNT(*) as c FROM content_drafts").get() as { c: number }).c;
  const pendingReview = (db.prepare("SELECT COUNT(*) as c FROM content_drafts WHERE status = 'draft'").get() as { c: number }).c;
  const scheduledCount = (db.prepare("SELECT COUNT(*) as c FROM content_drafts WHERE status = 'scheduled'").get() as { c: number }).c;
  const publishedCount = (db.prepare("SELECT COUNT(*) as c FROM content_drafts WHERE status = 'published'").get() as { c: number }).c;
  return { platformCount, draftCount, pendingReview, scheduledCount, publishedCount };
}

export function deleteDraft(id: number) {
  getDb().prepare("DELETE FROM content_drafts WHERE id = ?").run(id);
}
