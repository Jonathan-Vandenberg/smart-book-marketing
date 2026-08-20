import { NextResponse } from "next/server";
import { backfillBacklinksToLatestPost } from "@/lib/generate-blog-article";
import { requireAdmin } from "@/lib/auth-guard";

export const maxDuration = 600;

/** Inject links from older Ghost posts → latest published article. */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await backfillBacklinksToLatestPost();

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    latestTitle: result.latestTitle,
    backlinkedSlugs: result.backlinkedSlugs,
    message:
      result.backlinkedSlugs && result.backlinkedSlugs.length > 0
        ? `Backlinks added to ${result.backlinkedSlugs.length} post(s) pointing to "${result.latestTitle}".`
        : `No older posts needed updates for "${result.latestTitle}".`,
  });
}
