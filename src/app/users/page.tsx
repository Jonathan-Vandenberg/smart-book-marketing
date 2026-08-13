import Link from "next/link"
import { auth } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-shell"
import { isProductApiConfigured, listProductUsers } from "@/lib/product-api"

export const dynamic = "force-dynamic"

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>
}) {
  const session = await auth()
  const params = await searchParams
  const search = params.search?.trim() ?? ""
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)

  if (!isProductApiConfigured()) {
    return (
      <main>
        <DashboardHeader current="/users" email={session?.user?.email} />
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Product users</h2>
          <p className="muted">
            Configure <code>PRODUCT_API_URL</code> and <code>PRODUCT_ADMIN_SECRET</code> to load
            user billing data from Smart Book Planner.
          </p>
        </section>
      </main>
    )
  }

  let loadError: string | null = null
  let users: Awaited<ReturnType<typeof listProductUsers>>["users"] = []
  let pagination = { page: 1, limit: 50, total: 0, totalPages: 0 }

  try {
    const data = await listProductUsers({ search, page, limit: 50 })
    users = data.users
    pagination = data.pagination
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Failed to load users"
  }

  return (
    <main>
      <DashboardHeader current="/users" email={session?.user?.email} />

      <section className="card" style={{ marginBottom: "1rem" }}>
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0 }}>Product users</h2>
            <p className="muted" style={{ margin: "0.35rem 0 0" }}>
              {pagination.total} users · hosted AI credit balances and billing mode
            </p>
          </div>
          <Link href="/credits" className="btn btn-sm">
            Edit credit costs
          </Link>
        </div>

        <form method="get" className="inline-actions" style={{ marginTop: "1rem" }}>
          <input
            name="search"
            defaultValue={search}
            placeholder="Search email or name"
            style={{ minWidth: "16rem" }}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            Search
          </button>
        </form>
      </section>

      {loadError ? (
        <section className="card">
          <p style={{ color: "#c62828" }}>{loadError}</p>
        </section>
      ) : (
        <section className="card" style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Plan</th>
                <th>AI mode</th>
                <th>Included</th>
                <th>Bonus</th>
                <th>Total left</th>
                <th>Usage logs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.email}</strong>
                      {user.name && (
                        <div className="muted" style={{ fontSize: "0.85rem" }}>
                          {user.name}
                        </div>
                      )}
                    </td>
                    <td>
                      {user.plan}
                      {user.isComped && (
                        <span className="badge ok" style={{ marginLeft: "0.35rem" }}>
                          comped
                        </span>
                      )}
                    </td>
                    <td>{user.aiBillingMode}</td>
                    <td>
                      {user.aiCreditsIncludedRemaining} / {user.aiCreditsLimit}
                    </td>
                    <td>{user.aiCreditsBonusBalance}</td>
                    <td>{user.aiCreditsTotalRemaining}</td>
                    <td>{user.usageLogCount}</td>
                    <td>
                      <Link href={`/users/${user.id}`}>Details →</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {pagination.totalPages > 1 && (
            <div className="inline-actions" style={{ marginTop: "1rem" }}>
              {page > 1 && (
                <Link
                  href={`/users?${new URLSearchParams({
                    ...(search ? { search } : {}),
                    page: String(page - 1),
                  }).toString()}`}
                  className="btn btn-sm"
                >
                  ← Previous
                </Link>
              )}
              <span className="muted">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              {page < pagination.totalPages && (
                <Link
                  href={`/users?${new URLSearchParams({
                    ...(search ? { search } : {}),
                    page: String(page + 1),
                  }).toString()}`}
                  className="btn btn-sm"
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  )
}
