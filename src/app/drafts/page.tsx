import { auth } from "@/lib/auth";
import { listDrafts } from "@/lib/drafts";
import { listPlatforms } from "@/lib/platforms";
import { DashboardHeader } from "@/components/dashboard-shell";
import {
  approveDraftAction,
  rejectDraftAction,
  scheduleDraftAction,
  deleteDraftAction,
  createDraftAction,
  publishDraftNowAction,
  createBlogPromoDraftsAction,
} from "@/app/actions/drafts";
import { fetchLatestPublishedPost, isGhostConfigured } from "@/lib/ghost";
import { getBufferConnectedPlatformSlugs } from "@/lib/buffer";

export const dynamic = "force-dynamic";

import type { DraftStatus } from "@/lib/types";

const STATUSES: DraftStatus[] = ["draft", "approved", "scheduled", "published", "rejected"];

const BUFFER_PLATFORMS = new Set(["x", "linkedin", "instagram", "threads", "facebook"]);

function approvedPublishHint(platformSlug: string): string {
  if (platformSlug === "ghost") {
    return "Approved — use Publish Now or wait for the publish agent (Ghost blog; social link share via webhook after go-live).";
  }
  if (BUFFER_PLATFORMS.has(platformSlug)) {
    return "Approved — use Publish Now or wait for the publish agent (Buffer).";
  }
  return "Approved — use Publish Now or wait for the publish agent.";
}

function canPublishNow(status: DraftStatus): boolean {
  return status === "approved" || status === "scheduled";
}

export default async function DraftsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; publishError?: string; published?: string; promoError?: string; promoCreated?: string; promoTitle?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const { status: rawStatus, publishError, published, promoError, promoCreated, promoTitle } = params;
  const status = STATUSES.includes(rawStatus as DraftStatus) ? (rawStatus as DraftStatus) : undefined;
  const drafts = listDrafts(status);
  const platforms = listPlatforms();
  const latestArticle = isGhostConfigured() ? await fetchLatestPublishedPost() : null;
  const bufferSlugs = await getBufferConnectedPlatformSlugs();
  const promoPlatformCount = platforms.filter((p) => bufferSlugs.has(p.slug)).length;

  return (
    <main>
      <DashboardHeader current="/drafts" email={session?.user?.email} />

      {latestArticle && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Promote latest blog article</h2>
          <p style={{ margin: "0 0 0.5rem" }}>
            <strong>{latestArticle.title}</strong>
          </p>
          <p className="muted" style={{ margin: "0 0 1rem" }}>
            <a href={latestArticle.url} target="_blank" rel="noreferrer">{latestArticle.url}</a>
            {latestArticle.publishedAt && (
              <> · Published {new Date(latestArticle.publishedAt).toLocaleDateString("en-ZA")}</>
            )}
          </p>
          {latestArticle.excerpt && (
            <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>{latestArticle.excerpt.slice(0, 200)}…</p>
          )}
          <form action={createBlogPromoDraftsAction}>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={promoPlatformCount === 0}
            >
              Generate social drafts ({promoPlatformCount} channel{promoPlatformCount === 1 ? "" : "s"})
            </button>
          </form>
          {promoPlatformCount === 0 && (
            <p className="muted" style={{ margin: "0.75rem 0 0", fontSize: "0.85rem" }}>
              Link a channel in Buffer first (e.g. Facebook).
            </p>
          )}
        </section>
      )}

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>New draft</h2>
        <form action={createDraftAction}>
          <div className="form-row">
            <label>
              Platform
              <select name="platformId" required>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input name="title" placeholder="Optional headline" />
            </label>
            <label>
              Pillar
              <input name="pillar" placeholder="e.g. craft-fiction" />
            </label>
            <label>
              Body
              <textarea name="body" rows={5} required placeholder="Post content..." />
            </label>
            <label>
              Schedule (optional)
              <input type="datetime-local" name="scheduledAt" />
            </label>
          </div>
          <button type="submit" className="btn btn-primary">Save draft</button>
        </form>
      </section>

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Draft queue</h2>
          <div className="inline-actions">
            <a href="/drafts" className="btn btn-sm">All</a>
            <a href="/drafts?status=draft" className="btn btn-sm">Draft</a>
            <a href="/drafts?status=approved" className="btn btn-sm">Approved</a>
            <a href="/drafts?status=scheduled" className="btn btn-sm">Scheduled</a>
            <a href="/drafts?status=published" className="btn btn-sm">Published</a>
          </div>
        </div>

        {publishError && (
          <p className="badge error" style={{ marginBottom: "1rem" }}>Publish failed: {publishError}</p>
        )}
        {published && (
          <p className="badge ok" style={{ marginBottom: "1rem" }}>Draft #{published} published successfully.</p>
        )}
        {promoCreated && (
          <p className="badge ok" style={{ marginBottom: "1rem" }}>
            Created {promoCreated} promo draft{promoCreated === "1" ? "" : "s"} for &ldquo;{promoTitle}&rdquo;.
          </p>
        )}
        {promoError && (
          <p className="badge error" style={{ marginBottom: "1rem" }}>{promoError}</p>
        )}

        {drafts.length === 0 ? (
          <p className="muted">No drafts yet.</p>
        ) : (
          drafts.map((draft) => (
            <article key={draft.id} style={{ borderTop: "1px solid rgba(33,28,21,0.08)", paddingTop: "1rem", marginTop: "1rem" }}>
              <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                <div>
                  <strong>{draft.platformName}</strong>
                  <span className={`badge status-${draft.status}`} style={{ marginLeft: "0.5rem" }}>{draft.status}</span>
                  {draft.pillar && <span className="muted" style={{ marginLeft: "0.5rem" }}>{draft.pillar}</span>}
                </div>
                <span className="muted">{new Date(draft.updatedAt).toLocaleString("en-ZA")}</span>
              </div>
              {draft.title && <h3 style={{ margin: "0.5rem 0 0", fontSize: "1rem" }}>{draft.title}</h3>}
              {draft.articleUrl && (
                <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
                  Article: <a href={draft.articleUrl} target="_blank" rel="noreferrer">{draft.articleUrl}</a>
                </p>
              )}
              <p className="draft-body">{draft.body}</p>
              {draft.scheduledAt && <p className="muted">Scheduled: {new Date(draft.scheduledAt).toLocaleString("en-ZA")}</p>}

              {draft.status === "draft" && (
                <div className="inline-actions">
                  <form action={approveDraftAction}>
                    <input type="hidden" name="draftId" value={draft.id} />
                    <button type="submit" className="btn btn-primary btn-sm">Approve</button>
                  </form>
                  <form action={rejectDraftAction}>
                    <input type="hidden" name="draftId" value={draft.id} />
                    <button type="submit" className="btn btn-sm">Reject</button>
                  </form>
                  <form action={scheduleDraftAction}>
                    <input type="hidden" name="draftId" value={draft.id} />
                    <input type="hidden" name="scheduledAt" value={new Date(Date.now() + 86400000).toISOString()} />
                    <button type="submit" className="btn btn-sm">Schedule +24h</button>
                  </form>
                  <form action={deleteDraftAction}>
                    <input type="hidden" name="draftId" value={draft.id} />
                    <button type="submit" className="btn btn-sm">Delete</button>
                  </form>
                </div>
              )}

              {draft.status === "approved" && (
                <p className="muted">{approvedPublishHint(draft.platformSlug)}</p>
              )}

              {canPublishNow(draft.status) && (
                <div className="inline-actions" style={{ marginTop: "0.5rem" }}>
                  <form action={publishDraftNowAction}>
                    <input type="hidden" name="draftId" value={draft.id} />
                    <button type="submit" className="btn btn-primary btn-sm">Publish Now</button>
                  </form>
                </div>
              )}

              {draft.status === "published" && draft.externalUrl && (
                <p className="muted" style={{ marginTop: "0.5rem" }}>
                  Published: {draft.externalUrl.startsWith("http") ? (
                    <a href={draft.externalUrl} target="_blank" rel="noreferrer">{draft.externalUrl}</a>
                  ) : (
                    draft.externalUrl
                  )}
                </p>
              )}
            </article>
          ))
        )}
      </section>
    </main>
  );
}
