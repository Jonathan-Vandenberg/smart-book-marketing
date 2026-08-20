"use client";

import { useState } from "react";

type ApiResult = {
  ok?: boolean;
  status?: string;
  message?: string;
  publish?: { url?: string; title?: string };
  dedupe?: { kept: number; deleted: number; errors?: string[] };
  kept?: number;
  deleted?: number;
  errors?: string[];
};

export function BlogArticleActions({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState<"generate" | "dedupe" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function runGenerate() {
    setLoading("generate");
    setFeedback(null);
    setError(false);

    try {
      const res = await fetch("/api/admin/blog/generate", { method: "POST" });
      const data = (await res.json()) as ApiResult;

      if (!res.ok) {
        setError(true);
        setFeedback(data.message ?? "Generate failed");
        return;
      }

      const dedupeNote =
        data.dedupe && data.dedupe.deleted > 0
          ? ` Removed ${data.dedupe.deleted} duplicate post(s).`
          : "";

      if (data.status === "ok") {
        setFeedback(`${data.message ?? "Published."}${dedupeNote}`);
      } else if (data.status === "skipped") {
        setError(false);
        setFeedback(`${data.message ?? "Skipped."}${dedupeNote}`);
      } else {
        setError(true);
        setFeedback(data.message ?? "Blog agent failed");
      }
    } catch (err) {
      setError(true);
      setFeedback(err instanceof Error ? err.message : "Request failed");
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
      const data = (await res.json()) as ApiResult;

      if (!res.ok || !data.ok) {
        setError(true);
        setFeedback(data.errors?.join("; ") ?? "Dedupe failed");
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
