import Link from "next/link"
import { auth } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-shell"
import { ModelsEditor } from "@/components/models-editor"
import { getHostedModels, isProductApiConfigured } from "@/lib/product-api"

export const dynamic = "force-dynamic"

export default async function ModelsPage() {
  const session = await auth()

  if (!isProductApiConfigured()) {
    return (
      <main>
        <DashboardHeader current="/models" email={session?.user?.email} />
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Hosted AI models</h2>
          <p className="muted">
            Set <code>PRODUCT_API_URL</code> and <code>PRODUCT_ADMIN_SECRET</code> in{" "}
            <code>.env.local</code> to manage hosted OpenRouter models.
          </p>
        </section>
      </main>
    )
  }

  let models: Awaited<ReturnType<typeof getHostedModels>> = []
  let loadError: string | null = null

  try {
    models = await getHostedModels()
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Failed to load hosted models"
  }

  return (
    <main>
      <DashboardHeader current="/models" email={session?.user?.email} />

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Hosted AI models</h2>
        <p className="muted">
          OpenRouter models used for hosted AI users (platform key). Dropdowns are populated from
          OpenRouter using <code>PLATFORM_OPENROUTER_API_KEY</code> on the product server.
        </p>
        <p className="muted">
          BYOK users still pick their own models in product Settings.
        </p>
      </section>

      {loadError ? (
        <section className="card">
          <p style={{ color: "#c62828" }}>{loadError}</p>
        </section>
      ) : (
        <section className="card">
          <ModelsEditor models={models} />
        </section>
      )}

      <p style={{ marginTop: "1rem" }}>
        <Link href="/credits">Edit credit costs →</Link>
      </p>
    </main>
  )
}
