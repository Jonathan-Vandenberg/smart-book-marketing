import { NextResponse } from "next/server";
import { runBlogAgent, type RunBlogAgentResult } from "@/agents/blog";
import { requireAdmin } from "@/lib/auth-guard";
import { createBlogJob, getBlogJob, updateBlogJob, type BlogJobRecord } from "@/lib/store";

export const maxDuration = 600;

function jobPayload(job: BlogJobRecord) {
  return {
    jobId: job.id,
    status: job.status,
    message: job.message,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    publish: job.publish,
    dedupe: job.dedupe,
    backlinkedSlugs: job.backlinkedSlugs,
    ok: job.status === "ok",
  };
}

function persistJobResult(jobId: string, result: RunBlogAgentResult) {
  updateBlogJob(jobId, {
    status: result.run.status,
    message: result.run.message,
    finishedAt: new Date().toISOString(),
    publish: result.publish
      ? {
          title: result.publish.title,
          url: result.publish.url,
          slug: result.publish.slug,
        }
      : undefined,
    dedupe: result.dedupe
      ? {
          kept: result.dedupe.kept,
          deleted: result.dedupe.deleted,
        }
      : undefined,
    backlinkedSlugs: result.publish?.backlinkedSlugs,
  });
}

/** Poll job status: GET ?jobId=... */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = getBlogJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(jobPayload(job));
}

/** Start async blog pipeline — returns immediately; client polls GET with jobId. */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = createBlogJob();
  console.log(`[blog-api] Manual generate job ${job.id} started`);

  void runBlogAgent({ force: true, dedupeFirst: true })
    .then((result) => {
      persistJobResult(job.id, result);
      console.log(`[blog-api] Job ${job.id} finished: ${result.run.status}`);
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : "Blog agent failed";
      updateBlogJob(job.id, {
        status: "error",
        message,
        finishedAt: new Date().toISOString(),
      });
      console.error(`[blog-api] Job ${job.id} error:`, message);
    });

  return NextResponse.json(
    {
      ...jobPayload(job),
      hint: "Poll GET /api/admin/blog/generate?jobId=… until status is not running.",
    },
    { status: 202 }
  );
}
