import { auth } from "@/lib/auth";
import { listPlatforms, listPlatformsWithLiveStatus } from "@/lib/platforms";
import { DashboardHeader } from "@/components/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function PlatformsPage() {
  const session = await auth();
  const platforms = await listPlatformsWithLiveStatus();

  const byTier = [1, 2, 3].map((tier) => ({
    tier,
    items: platforms.filter((p) => p.tier === tier),
  }));

  return (
    <main>
      <DashboardHeader current="/platforms" email={session?.user?.email} />

      <p className="muted" style={{ marginBottom: "1.5rem" }}>
        Registry of marketing channels. <strong>Connected</strong> means the API is configured and, for social
        platforms, a matching channel is linked in Buffer — not just that you have a Buffer token.
      </p>

      {byTier.map(({ tier, items }) => (
        <section key={tier} className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Tier {tier}</h2>
          {items.length === 0 ? (
            <p className="muted">No platforms in this tier.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Handle</th>
                  <th>Category</th>
                  <th>Automation</th>
                  <th>API</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.handle ?? "—"}</td>
                    <td>{p.category}</td>
                    <td>{p.automationLevel}</td>
                    <td>{p.apiConnected ? "Connected" : "Not connected"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </main>
  );
}
