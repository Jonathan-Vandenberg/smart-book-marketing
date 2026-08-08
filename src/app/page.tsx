import { auth } from "@/lib/auth";
import { getAgentRuns, agentsEnabled } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const runs = getAgentRuns();
  const agentsOn = agentsEnabled();

  return (
    <main>
      <header style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <p className="badge">Smart Book Planner</p>
          <h1 style={{ margin: "0.5rem 0 0", fontSize: "2rem" }}>Marketing Command Center</h1>
          <p style={{ color: "var(--ink-soft)", maxWidth: "42rem" }}>
            Agentic marketing, analytics, and content queue for{" "}
            <a href="https://www.smartbookplanner.com">smartbookplanner.com</a>.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--ink-soft)" }}>
            {session?.user?.email}
          </p>
          <form
            action={async () => {
              "use server";
              const { signOut } = await import("@/lib/auth");
              await signOut({ redirectTo: "/auth/signin" });
            }}
            style={{ marginTop: "0.5rem" }}
          >
            <button type="submit" style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0 }}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="grid grid-3" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <p className="badge">Agents</p>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.5rem 0" }}>
            {agentsOn ? "Enabled" : "Disabled"}
          </p>
          <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "0.9rem" }}>
            Cron jobs start with the Next.js server via instrumentation hook.
          </p>
        </div>
        <div className="card">
          <p className="badge">Runs logged</p>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.5rem 0" }}>
            {runs.length}
          </p>
          <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "0.9rem" }}>
            Stored in <code>data/agent-runs.json</code> on the server.
          </p>
        </div>
        <div className="card">
          <p className="badge">Access</p>
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.95rem", color: "var(--ink-soft)" }}>
            Restricted to allowlisted admin email only.
          </p>
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Recent agent runs</h2>
        {runs.length === 0 ? (
          <p style={{ color: "var(--ink-soft)" }}>
            No runs yet. Trigger manually:{" "}
            <code>npm run agents:run-once</code> or wait for cron.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Agent</th>
                <th>Status</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 20).map((run) => (
                <tr key={`${run.at}-${run.agent}`}>
                  <td>{new Date(run.at).toLocaleString("en-ZA")}</td>
                  <td>{run.agent}</td>
                  <td>
                    <span className={`badge ${run.status}`}>{run.status}</span>
                  </td>
                  <td>{run.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
