import { auth } from "@/lib/auth";
import { getDashboardStats } from "@/lib/drafts";
import { listIntegrationStatus } from "@/lib/integrations";
import { DashboardHeader } from "@/components/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await auth();
  const stats = getDashboardStats();
  const integrations = listIntegrationStatus();

  return (
    <main>
      <DashboardHeader current="/analytics" email={session?.user?.email} />

      <section className="grid grid-3" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <p className="badge">Published</p>
          <p className="stat-value">{stats.publishedCount}</p>
        </div>
        <div className="card">
          <p className="badge">Scheduled</p>
          <p className="stat-value">{stats.scheduledCount}</p>
        </div>
        <div className="card">
          <p className="badge">Pending review</p>
          <p className="stat-value">{stats.pendingReview}</p>
        </div>
      </section>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Integration status</h2>
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Status</th>
              <th>Env var</th>
            </tr>
          </thead>
          <tbody>
            {integrations.map((i) => (
              <tr key={i.name}>
                <td>{i.name}</td>
                <td>{i.configured ? "Configured" : "Not configured"}</td>
                <td className="muted">{i.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Website analytics (coming soon)</h2>
        <p className="muted">
          GA4 and GSC widgets will appear here once the analytics agent is wired to pull weekly signups,
          organic sessions, and top search queries for smartbookplanner.com.
        </p>
      </section>
    </main>
  );
}
