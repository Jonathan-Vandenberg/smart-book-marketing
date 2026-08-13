import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"
import { getOpenRouterModels, type HostedModel } from "@/lib/product-api"

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const type = request.nextUrl.searchParams.get("type") as HostedModel["modelType"] | null
  if (!type) {
    return NextResponse.json({ error: "type query param is required" }, { status: 400 })
  }

  try {
    const models = await getOpenRouterModels(type)
    return NextResponse.json({ models })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load models" },
      { status: 500 },
    )
  }
}
