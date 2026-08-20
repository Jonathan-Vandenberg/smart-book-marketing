import { auth } from "@/lib/auth";
import { getAgentRuns, agentsEnabled } from "@/lib/store";
import { getDashboardStats, listDrafts } from "@/lib/drafts";
import { DashboardHeader } from "@/components/dashboard-shell";
import { BlogArticleActions } from "@/components/blog-article-actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const stats = getDashboardStats();
  const pending = listDrafts("draft").slice(0, 5);
  const runs = getAgentRuns().slice(0, 5);

  return (
    <main>
      <DashboardHeader current="/" email={session?.user?.email} />

      <section className="grid grid-3" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <p className="badge">Pending review</p>
          <p className="stat-value">{stats.pendingReview}</p>
          <Link href="/drafts">Review drafts →</Link>
        </div>
        <div className="card">
          <p className="badge">Scheduled</p>
          <p className="stat-value">{stats.scheduledCount}</p>
          <Link href="/calendar">View calendar →</Link>
        </div>
        <div className="card">
          <p className="badge">Platforms</p>
          <p className="stat-value">{stats.platformCount}</p>
          <Link href="/platforms">Manage platforms →</Link>
        </div>
      </section>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Ghost blog</h2>
        <BlogArticleActions compact />
      </section>

      <section className="grid grid-2" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Drafts awaiting approval</h2>
          {pending.length === 0 ? (
            <p className="muted">No drafts waiting. Run the content agent from the Agents page.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {pending.map((d) => (
                <li key={d.id} style={{ marginBottom: "0.5rem" }}>
                  <strong>{d.platformName}</strong> — {d.title ?? "Untitled"}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Agents</h2>
          <p className="muted">Status: {agentsEnabled() ? "Enabled" : "Disabled"}</p>
          <p className="muted">Published: {stats.publishedCount} · Total drafts: {stats.draftCount}</p>
          <Link href="/agents">Agent console →</Link>
        </div>
      </section>

      {runs.length > 0 && (
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Recent agent runs</h2>
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
              {runs.map((run) => (
                <tr key={`${run.at}-${run.agent}`}>
                  <td>{new Date(run.at).toLocaleString("en-ZA")}</td>
                  <td>{run.agent}</td>
                  <td><span className={`badge ${run.status}`}>{run.status}</span></td>
                  <td>{run.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
