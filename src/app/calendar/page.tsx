import { auth } from "@/lib/auth";
import { listDraftsInRange } from "@/lib/drafts";
import { DashboardHeader } from "@/components/dashboard-shell";

export const dynamic = "force-dynamic";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function CalendarPage() {
  const session = await auth();
  const start = startOfDay(new Date());
  const days = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    return day;
  });

  const rangeEnd = new Date(days[days.length - 1]);
  rangeEnd.setDate(rangeEnd.getDate() + 1);

  const scheduled = listDraftsInRange(start.toISOString(), rangeEnd.toISOString());

  return (
    <main>
      <DashboardHeader current="/calendar" email={session?.user?.email} />

      <p className="muted" style={{ marginBottom: "1.5rem" }}>
        Next 14 days of scheduled posts.
      </p>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem" }}>
        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const items = scheduled.filter((d) => d.scheduledAt?.slice(0, 10) === key);
          return (
            <div key={key} className="calendar-day">
              <h3>{day.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}</h3>
              {items.length === 0 ? (
                <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>—</p>
              ) : (
                items.map((d) => (
                  <p key={d.id} style={{ margin: "0 0 0.35rem", fontSize: "0.8rem" }}>
                    <strong>{d.platformName}</strong><br />{d.title ?? d.body.slice(0, 40)}…
                  </p>
                ))
              )}
            </div>
          );
        })}
      </section>
    </main>
  );
}
