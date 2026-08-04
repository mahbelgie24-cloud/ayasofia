import { init } from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

init({
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN,
  tracesSampleRate: 0,
  environment: process.env.NODE_ENV ?? "development",
});
