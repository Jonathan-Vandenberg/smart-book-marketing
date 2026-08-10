import { NextResponse } from "next/server";
import { shareGhostPostToBuffer } from "@/agents/publish";
import { parseGhostWebhookPayload } from "@/lib/ghost";
import { getEnv } from "@/lib/store";

export async function POST(request: Request) {
  const secret = getEnv("GHOST_WEBHOOK_SECRET");
  if (secret) {
    const url = new URL(request.url);
    if (url.searchParams.get("secret") !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const post = parseGhostWebhookPayload(body);
  if (!post?.url) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no post url" });
  }

  const result = await shareGhostPostToBuffer(post);
  if (!result.ok) {
    console.warn("[ghost-webhook] Buffer share failed:", result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  console.log("[ghost-webhook] Shared to Buffer:", post.url);
  return NextResponse.json({ ok: true, shared: true, postUrl: post.url });
}
