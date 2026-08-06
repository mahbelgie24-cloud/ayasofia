/**
 * T-D3 — lightweight Sentry observability for abuse/` failure surfaces.
 *
 * Adds breadcrumbs + a counter-style message when a public endpoint is
 * rate-limited/throttled or a checkout fails. All calls are wrapped in
 * try/catch so observability can never break the control path, and @sentry/nextjs
 * is a no-op when no DSN is configured (e.g. in unit tests).
 */
import { addBreadcrumb, captureMessage } from "@sentry/nextjs";

function safe(fn: () => void): void {
  try {
    fn();
  } catch {
    /* never let observability break the request */
  }
}

/** A request was rejected by the per-IP / per-key throttle. */
export function captureThrottled(surface: string, key: string): void {
  safe(() => {
    addBreadcrumb({
      category: "rate-limit",
      level: "warning",
      message: `${surface} throttled`,
      data: { key },
    });
    captureMessage(`${surface}.throttled`, "warning");
  });
}

/** A checkout did not succeed (validation error, transaction error, or throw). */
export function captureCheckoutFailure(error: string): void {
  safe(() => {
    addBreadcrumb({
      category: "checkout",
      level: "error",
      message: `checkout failed: ${error}`,
    });
    captureMessage(`checkout.failed: ${error}`, "error");
  });
}
