import Link from "next/link"
import { auth } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-shell"
import { getProductUserDetail, isProductApiConfigured } from "@/lib/product-api"

export const dynamic = "force-dynamic"

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const session = await auth()
  const { userId } = await params

  if (!isProductApiConfigured()) {
    return (
      <main>
        <DashboardHeader current="/users" email={session?.user?.email} />
        <section className="card">
          <p className="muted">Product API not configured.</p>
        </section>
      </main>
    )
  }

  let loadError: string | null = null
  let detail: Awaited<ReturnType<typeof getProductUserDetail>> | null = null

  try {
    detail = await getProductUserDetail(userId)
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Failed to load user"
  }

  if (loadError || !detail) {
    return (
      <main>
        <DashboardHeader current="/users" email={session?.user?.email} />
        <p style={{ marginBottom: "1rem" }}>
          <Link href="/users">← Back to users</Link>
        </p>
        <section className="card">
          <p style={{ color: "#c62828" }}>{loadError ?? "User not found"}</p>
        </section>
      </main>
    )
  }

  const { user, usageLogs, usageByFeature, creditPurchases } = detail

  return (
    <main>
      <DashboardHeader current="/users" email={session?.user?.email} />

      <p style={{ marginBottom: "1rem" }}>
        <Link href="/users">← Back to users</Link>
      </p>

      <section className="grid grid-3" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <p className="badge">Included remaining</p>
          <p className="stat-value">
            {user.aiCreditsIncludedRemaining} / {user.aiCreditsLimit}
          </p>
        </div>
        <div className="card">
          <p className="badge">Bonus credits</p>
          <p className="stat-value">{user.aiCreditsBonusBalance}</p>
        </div>
        <div className="card">
          <p className="badge">Total available</p>
          <p className="stat-value">{user.aiCreditsTotalRemaining}</p>
        </div>
      </section>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>{user.email}</h2>
        <div className="grid grid-2">
          <div>
            <p className="muted">Plan: {user.plan}</p>
            <p className="muted">AI billing mode: {user.aiBillingMode}</p>
            <p className="muted">
              Subscription: {user.subscriptionStatus ?? "—"}
              {user.currentPeriodEnd &&
                ` · renews ${new Date(user.currentPeriodEnd).toLocaleDateString("en-ZA")}`}
            </p>
          </div>
          <div>
            <p className="muted">
              Credits used (included pool): {user.aiCreditsUsed}
            </p>
            <p className="muted">
              Reset:{" "}
              {user.aiCreditsResetAt
                ? new Date(user.aiCreditsResetAt).toLocaleDateString("en-ZA")
                : "—"}
            </p>
            <p className="muted">
              Joined: {new Date(user.createdAt).toLocaleDateString("en-ZA")}
            </p>
          </div>
        </div>
      </section>

      {usageByFeature.length > 0 && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Usage by feature</h2>
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Calls</th>
                <th>Credits charged</th>
              </tr>
            </thead>
            <tbody>
              {usageByFeature.map((row) => (
                <tr key={row.feature}>
                  <td><code>{row.feature}</code></td>
                  <td>{row.callCount}</td>
                  <td>{row.totalCredits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {creditPurchases.length > 0 && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Credit purchases</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Pack</th>
                <th>Credits</th>
                <th>Amount (ZAR)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {creditPurchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td>{new Date(purchase.createdAt).toLocaleString("en-ZA")}</td>
                  <td>{purchase.packId}</td>
                  <td>{purchase.creditsGranted}</td>
                  <td>{purchase.amountZar}</td>
                  <td>{purchase.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Recent AI usage log</h2>
        {usageLogs.length === 0 ? (
          <p className="muted">No usage recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Feature</th>
                <th>Credits</th>
                <th>Model</th>
                <th>Tokens</th>
                <th>Key</th>
              </tr>
            </thead>
            <tbody>
              {usageLogs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.createdAt).toLocaleString("en-ZA")}</td>
                  <td><code>{log.feature}</code></td>
                  <td>{log.creditsCharged}</td>
                  <td className="muted" style={{ fontSize: "0.85rem" }}>
                    {log.model ?? "—"}
                  </td>
                  <td className="muted" style={{ fontSize: "0.85rem" }}>
                    {log.promptTokens ?? 0} / {log.completionTokens ?? 0}
                  </td>
                  <td>{log.keySource}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
