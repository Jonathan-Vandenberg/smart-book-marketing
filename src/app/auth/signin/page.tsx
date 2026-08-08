import { signIn } from "@/lib/auth";

export default function SignInPage() {
  return (
    <main style={{ maxWidth: "24rem", margin: "4rem auto", padding: "0 1.25rem" }}>
      <div className="card">
        <p className="badge">Smart Book Marketing</p>
        <h1 style={{ margin: "0.75rem 0 0.5rem", fontSize: "1.5rem" }}>Sign in</h1>
        <p style={{ color: "var(--ink-soft)", marginBottom: "1.5rem" }}>
          Admin access only. Authorized Google account required.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              border: "1px solid rgba(33,28,21,0.15)",
              borderRadius: "6px",
              background: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
