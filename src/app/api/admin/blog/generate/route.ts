import { NextResponse } from "next/server";
import { runBlogAgent } from "@/agents/blog";
import { requireAdmin } from "@/lib/auth-guard";

export const maxDuration = 600;

/** Manual blog pipeline: dedupe Ghost → trends + news URLs → AI → publish. */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[blog-api] Manual generate requested");
  const result = await runBlogAgent({ force: true, dedupeFirst: true });

  return NextResponse.json({
    ok: result.run.status === "ok",
    status: result.run.status,
    message: result.run.message,
    publish: result.publish,
    dedupe: result.dedupe
      ? { kept: result.dedupe.kept, deleted: result.dedupe.deleted, errors: result.dedupe.errors }
      : undefined,
  });
}
