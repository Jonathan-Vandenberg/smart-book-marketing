import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    service: "smart-book-marketing",
    agentsEnabled: process.env.AGENTS_ENABLED === "true",
    timestamp: new Date().toISOString(),
  });
}
