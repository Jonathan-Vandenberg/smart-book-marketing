"use client";

import { useState } from "react";

type JobPayload = {
  ok?: boolean;
  jobId?: string;
  status?: string;
  message?: string;
  publish?: { url?: string; title?: string };
  dedupe?: { kept: number; deleted: number };
  backlinkedSlugs?: string[];
  kept?: number;
  deleted?: number;
  errors?: string[];
  error?: string;
};

async function parseJsonResponse(res: Response): Promise<JobPayload | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as JobPayload;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function BlogArticleActions({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState<"generate" | "dedupe" | "backfill" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function pollJob(jobId: string): Promise<JobPayload | null> {
    for (let i = 0; i < 120; i += 1) {
      await sleep(5000);
      const res = await fetch(`/api/admin/blog/generate?jobId=${encodeURIComponent(jobId)}`);
      const data = await parseJsonResponse(res);
      if (!data) continue;
      if (data.status && data.status !== "running") return data;
    }
    return null;
  }

  async function runGenerate() {
    setLoading("generate");
    setFeedback("Starting pipeline (dedupe → trends → AI → Ghost)…");
    setError(false);

    try {
      const res = await fetch("/api/admin/blog/generate", { method: "POST" });
      const started = await parseJsonResponse(res);

      if (!started?.jobId) {
        setError(true);
        setFeedback(
          started?.message ??
            "Could not start job — check Agents run history; the article may still have published."
        );
        return;
      }

      setFeedback("Generating article — this usually takes 3–8 minutes…");

      const data = await pollJob(started.jobId);
      if (!data) {
        setError(false);
        setFeedback(
          "Pipeline still running or status unavailable — check Agents run history and Ghost blog."
        );
        return;
      }

      const dedupeNote =
        data.dedupe && data.dedupe.deleted > 0
          ? ` Removed ${data.dedupe.deleted} duplicate post(s).`
          : "";
      const backlinkNote =
        data.backlinkedSlugs && data.backlinkedSlugs.length > 0
          ? ` Backlinks added to ${data.backlinkedSlugs.length} older post(s).`
          : "";

      if (data.status === "ok") {
        setFeedback(`${data.message?.replace(/\.\s*Backlinked into \d+ older post\(s\)\./, ".") ?? "Published."}${dedupeNote}${backlinkNote}`);
      } else if (data.status === "skipped") {
        setFeedback(`${data.message ?? "Skipped."}${dedupeNote}`);
      } else {
        setError(true);
        setFeedback(data.message ?? "Blog agent failed");
      }
    } catch (err) {
      setError(true);
      setFeedback(
        err instanceof Error
          ? `${err.message} — if Ghost shows a new post, the pipeline likely succeeded despite this error.`
          : "Request failed"
      );
    } finally {
      setLoading(null);
    }
  }

  async function runDedupe() {
    setLoading("dedupe");
    setFeedback(null);
    setError(false);

    try {
      const res = await fetch("/api/admin/blog/dedupe", { method: "POST" });
      const data = await parseJsonResponse(res);

      if (!data || !res.ok || !data.ok) {
        setError(true);
        setFeedback(data?.errors?.join("; ") ?? "Dedupe failed");
        return;
      }

      setFeedback(`Dedupe complete — kept ${data.kept ?? "?"}, deleted ${data.deleted ?? 0}.`);
    } catch (err) {
      setError(true);
      setFeedback(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(null);
    }
  }

  async function runBackfillLinks() {
    setLoading("backfill");
    setFeedback(null);
    setError(false);

    try {
      const res = await fetch("/api/admin/blog/backfill-links", { method: "POST" });
      const data = await parseJsonResponse(res);

      if (!data || !res.ok || !data.ok) {
        setError(true);
        setFeedback((data as { error?: string })?.error ?? "Backfill failed");
        return;
      }

      setFeedback(data.message ?? "Backlinks updated.");
    } catch (err) {
      setError(true);
      setFeedback(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      {!compact && (
        <p className="muted" style={{ marginTop: 0 }}>
          Google Trends + news sources → AI article for writers → Ghost publish at{" "}
          <a href="https://blog.smartbookplanner.com" target="_blank" rel="noreferrer">
            blog.smartbookplanner.com
          </a>
          . Manual runs bypass the 20h cron guard and dedupe duplicates first.
        </p>
      )}
      <div className="inline-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={loading !== null}
          onClick={runGenerate}
        >
          {loading === "generate" ? "Generating…" : "Generate & publish article"}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={loading !== null}
          onClick={runDedupe}
        >
          {loading === "dedupe" ? "Deduping…" : "Remove duplicate posts"}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={loading !== null}
          onClick={runBackfillLinks}
        >
          {loading === "backfill" ? "Linking…" : "Link older posts → latest"}
        </button>
      </div>
      {feedback && (
        <p
          className={error ? undefined : "muted"}
          style={{
            marginBottom: 0,
            marginTop: "0.75rem",
            fontSize: "0.9rem",
            color: error ? "var(--danger, #c0392b)" : undefined,
          }}
        >
          {feedback}
        </p>
      )}
    </div>
  );
}
