import Link from "next/link";

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main style={{ maxWidth: "28rem", margin: "4rem auto", padding: "0 1.25rem" }}>
      <div className="card">
        <p className="badge error">Access denied</p>
        <h1 style={{ margin: "0.75rem 0 0.5rem", fontSize: "1.5rem" }}>Not authorized</h1>
        <p style={{ color: "var(--ink-soft)" }}>
          This marketing dashboard is restricted to approved admin accounts only.
          If you used the wrong Google account, sign out of Google and try again.
        </p>
        <p style={{ marginTop: "1.25rem" }}>
          <Link href="/auth/signin">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
