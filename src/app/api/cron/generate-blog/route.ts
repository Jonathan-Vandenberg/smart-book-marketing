import { NextRequest, NextResponse } from "next/server";
import { generateAndPublishBlogArticle } from "@/lib/generate-blog-article";
import { getEnv } from "@/lib/store";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = getEnv("CRON_SECRET");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron] generate-blog starting…");
  const result = await generateAndPublishBlogArticle();

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  return GET(request);
}
