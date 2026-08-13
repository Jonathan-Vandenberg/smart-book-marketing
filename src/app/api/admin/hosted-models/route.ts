import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"
import { updateHostedModel } from "@/lib/product-api"

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      agent?: string
      modelId?: string
      label?: string
    }

    if (!body.agent || !body.modelId) {
      return NextResponse.json({ error: "agent and modelId are required" }, { status: 400 })
    }

    const model = await updateHostedModel({
      agent: body.agent,
      modelId: body.modelId,
      label: body.label,
    })

    return NextResponse.json({ model })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 },
    )
  }
}
