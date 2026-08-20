import { NextResponse } from "next/server";
import { dedupeGhostPosts } from "@/lib/dedupe-ghost-posts";
import { requireAdmin } from "@/lib/auth-guard";

/** Remove duplicate published Ghost posts (same normalized title). */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await dedupeGhostPosts(false);

  return NextResponse.json({
    ok: result.ok,
    kept: result.kept,
    deleted: result.deleted,
    errors: result.errors,
    details: result.details,
  });
}
