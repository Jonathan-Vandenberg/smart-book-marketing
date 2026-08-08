export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.AGENTS_ENABLED === "true") {
    import("./lib/scheduler").then(({ startScheduler }) => {
      startScheduler();
    });
  }
}
