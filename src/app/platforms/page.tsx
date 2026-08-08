import { auth } from "@/lib/auth";
import { listPlatforms } from "@/lib/platforms";
import { DashboardHeader } from "@/components/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function PlatformsPage() {
  const session = await auth();
  const platforms = listPlatforms();

  const byTier = [1, 2, 3].map((tier) => ({
    tier,
    items: platforms.filter((p) => p.tier === tier),
  }));

  return (
    <main>
      <DashboardHeader current="/platforms" email={session?.user?.email} />

      <p className="muted" style={{ marginBottom: "1.5rem" }}>
        Registry of marketing channels. Connect APIs via env vars (Buffer, Beehiiv, OpenRouter, GA4).
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
