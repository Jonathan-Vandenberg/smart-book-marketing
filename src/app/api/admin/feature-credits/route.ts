import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"
import { updateFeatureCredit } from "@/lib/product-api"

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      feature?: string
      credits?: number
      label?: string
      description?: string | null
      enabled?: boolean
    }

    if (!body.feature || body.credits === undefined) {
      return NextResponse.json({ error: "feature and credits are required" }, { status: 400 })
    }

    const feature = await updateFeatureCredit({
      feature: body.feature,
      credits: body.credits,
      label: body.label,
      description: body.description,
      enabled: body.enabled,
    })

    return NextResponse.json({ feature })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 },
    )
  }
}
