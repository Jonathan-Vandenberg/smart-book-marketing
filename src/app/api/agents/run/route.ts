import { NextResponse } from "next/server";
import { runAnalyticsAgent } from "@/agents/analytics";
import { runContentAgent } from "@/agents/content";
import { runDailyTipAgent } from "@/agents/daily-tip";
import { runPublishAgent } from "@/agents/publish";
import { runSignalAgent } from "@/agents/signal";
import { requireAdmin } from "@/lib/auth-guard";

const AGENTS = {
  signal: runSignalAgent,
  content: runContentAgent,
  publish: runPublishAgent,
  analytics: runAnalyticsAgent,
  "daily-tip": runDailyTipAgent,
} as const;

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { agent?: string };
  const name = body.agent ?? "all";

  if (name === "all") {
    const results = await Promise.all(Object.values(AGENTS).map((fn) => fn()));
    return NextResponse.json({ ok: true, results });
  }

  const fn = AGENTS[name as keyof typeof AGENTS];
  if (!fn) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 400 });
  }

  const result = await fn();
  return NextResponse.json({ ok: true, result });
}
