import { auth } from "@/lib/auth";
import { getAgentRuns, agentsEnabled, getEnv } from "@/lib/store";
import { DashboardHeader } from "@/components/dashboard-shell";
import { runContentAgentAction, runPublishAgentAction, runBlogAgentAction } from "@/app/actions/drafts";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const session = await auth();
  const runs = getAgentRuns();

  const cronJobs = [
    { name: "Signal", expr: getEnv("SIGNAL_CRON", "0 6 * * 1"), desc: "GSC + topic briefs" },
    { name: "Content", expr: getEnv("CONTENT_CRON", "0 7 * * 1"), desc: "Social drafts → review queue" },
    { name: "Blog", expr: getEnv("BLOG_CRON", "0 9 * * *"), desc: "Trending → Ghost publish + backlinks + image" },
    { name: "Publish", expr: getEnv("PUBLISH_CRON", "0 8 * * *"), desc: "Approved/due → Buffer" },
    { name: "Analytics", expr: getEnv("ANALYTICS_CRON", "0 6 * * 5"), desc: "Weekly report" },
    { name: "Daily tip", expr: getEnv("DAILY_TIP_CRON", "0 12 * * *"), desc: "Short post slot" },
  ];

  return (
    <main>
      <DashboardHeader current="/agents" email={session?.user?.email} />

      <section className="grid grid-2" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Agent status</h2>
          <p className="stat-value">{agentsEnabled() ? "Enabled" : "Disabled"}</p>
          <p className="muted">Cron jobs run via Next.js instrumentation on server start.</p>
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Run now</h2>
          <div className="inline-actions">
            <form action={runContentAgentAction}>
              <button type="submit" className="btn btn-primary btn-sm">Content agent</button>
            </form>
            <form action={runPublishAgentAction}>
              <button type="submit" className="btn btn-sm">Publish agent</button>
            </form>
            <form action={runBlogAgentAction}>
              <button type="submit" className="btn btn-sm">Blog cron (Ghost)</button>
            </form>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Cron schedule</h2>
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Cron</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {cronJobs.map((job) => (
              <tr key={job.name}>
                <td>{job.name}</td>
                <td><code>{job.expr}</code></td>
                <td className="muted">{job.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Run history</h2>
        {runs.length === 0 ? (
          <p className="muted">No runs logged yet.</p>
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
        )}
      </section>
    </main>
  );
}
