import { init } from "@sentry/nextjs";
import type { ErrorEvent } from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

init({
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 0,
  environment: process.env.NODE_ENV ?? "development",

  beforeSendTransaction(event) {
    const name = event.transaction ?? "";
    if (name.includes("getOrderStatus") || name.includes("/api/health")) {
      return null;
    }
    return event;
  },

  beforeSend(event) {
    return scrubPII(event);
  },
});

const REDACT_FIELDS = [
  "pin",
  "password",
  "secret",
  "token",
  "customer_name",
  "customer_name_ar",
  "customer_phone",
  "phone",
  "pin_hash",
  "auth_user_id",
  "supabase_service_role_key",
  "database_url",
];

function scrubPII(event: ErrorEvent | null): ErrorEvent | null {
  if (!event) return event;

  const record = event as unknown as Record<string, unknown>;

  for (const key of Object.keys(event)) {
    const lower = key.toLowerCase();
    if (REDACT_FIELDS.some((f) => lower.includes(f))) {
      record[key] = "[REDACTED]";
    } else if (typeof record[key] === "object" && record[key] !== null) {
      scrubNested(record[key] as Record<string, unknown>);
    }
  }

  return event;
}

function scrubNested(obj: Record<string, unknown>): void {
  for (const k of Object.keys(obj)) {
    const lower = k.toLowerCase();
    if (REDACT_FIELDS.some((f) => lower.includes(f))) {
      obj[k] = "[REDACTED]";
    }
  }
}
