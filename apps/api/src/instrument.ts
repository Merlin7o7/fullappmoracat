/**
 * Sentry initialization — MUST be imported before anything else in main.ts so the
 * SDK can instrument the runtime. No-op unless SENTRY_DSN is set, so local dev and
 * unconfigured environments are unaffected; in production with a DSN it captures
 * unhandled errors, performance traces, and release/environment context.
 */
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? undefined,
    // Sample a slice of traces for performance visibility without heavy overhead.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Never ship PII to Sentry — Moracat holds Saudi PDPL-scoped data.
    sendDefaultPii: false,
  });
}

export const sentryEnabled = Boolean(dsn);
