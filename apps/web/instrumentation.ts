/**
 * Next.js server/edge instrumentation. Initializes Sentry for SSR, Route
 * Handlers, and Server Components when SENTRY_DSN is set — a no-op otherwise, so
 * local dev and unconfigured deploys are unaffected. Client errors are handled
 * by error.tsx / global-error.tsx and the client init in providers.tsx.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    });
  }
}
