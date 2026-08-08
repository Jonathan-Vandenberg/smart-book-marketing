import Link from "next/link";

const links = [
  { href: "/", label: "Overview" },
  { href: "/drafts", label: "Drafts" },
  { href: "/calendar", label: "Calendar" },
  { href: "/platforms", label: "Platforms" },
  { href: "/analytics", label: "Analytics" },
  { href: "/agents", label: "Agents" },
];

export function DashboardNav({ current }: { current: string }) {
  return (
    <nav className="dash-nav">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={current === link.href ? "dash-nav-link active" : "dash-nav-link"}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export async function DashboardHeader({
  current,
  email,
}: {
  current: string;
  email?: string | null;
}) {
  return (
    <header className="dash-header">
      <div>
        <p className="badge">Smart Book Planner</p>
        <h1 className="dash-title">Marketing Command Center</h1>
      </div>
      <div className="dash-header-right">
        {email && <p className="dash-email">{email}</p>}
        <form
          action={async () => {
            "use server";
            const { signOut } = await import("@/lib/auth");
            await signOut({ redirectTo: "/auth/signin" });
          }}
        >
          <button type="submit" className="link-button">
            Sign out
          </button>
        </form>
      </div>
      <DashboardNav current={current} />
    </header>
  );
}
