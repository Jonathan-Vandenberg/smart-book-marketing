import Link from "next/link"
import { auth } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-shell"
import { CreditsEditor } from "@/components/credits-editor"
import { getFeatureCredits, isProductApiConfigured } from "@/lib/product-api"

export const dynamic = "force-dynamic"

export default async function CreditsPage() {
  const session = await auth()

  if (!isProductApiConfigured()) {
    return (
      <main>
        <DashboardHeader current="/credits" email={session?.user?.email} />
        <section className="card">
          <h2 style={{ marginTop: 0 }}>AI credit costs</h2>
          <p className="muted">
            Set <code>PRODUCT_API_URL</code> and <code>PRODUCT_ADMIN_SECRET</code> in{" "}
            <code>.env.local</code> to connect to the Smart Book Planner product database.
          </p>
        </section>
      </main>
    )
  }

  let features: Awaited<ReturnType<typeof getFeatureCredits>> = []
  let loadError: string | null = null

  try {
    features = await getFeatureCredits()
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Failed to load credit config"
  }

  return (
    <main>
      <DashboardHeader current="/credits" email={session?.user?.email} />

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>AI credit costs</h2>
        <p className="muted">
          Per-action credit prices for hosted AI. Changes apply immediately to new requests
          (rogan-writer reads from <code>ai_feature_credits</code> table).
        </p>
        <p className="muted">
          Monthly included pool is still set via <code>HOSTED_AI_CREDITS_MONTHLY</code> on the
          product server.
        </p>
        <p className="muted">
          <Link href="/models">Hosted OpenRouter models →</Link>
        </p>
      </section>

      {loadError ? (
        <section className="card">
          <p style={{ color: "#c62828" }}>{loadError}</p>
        </section>
      ) : (
        <section className="card">
          <CreditsEditor features={features} />
        </section>
      )}

      <p style={{ marginTop: "1rem" }}>
        <Link href="/users">View user credit usage →</Link>
      </p>
    </main>
  )
}
