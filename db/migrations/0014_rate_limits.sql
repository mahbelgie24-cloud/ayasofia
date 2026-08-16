-- Durable rate-limit state (WEB-SEC-004): the PIN lockout and the public
-- endpoint throttles keep their counters here so the caps hold globally
-- across instances instead of per-process. Default-deny like every other
-- table (0013 posture): RLS enabled + FORCED, no policies — the anon and
-- authenticated PostgREST roles see nothing; the app's own pools connect
-- as roles that bypass RLS (rolbypassrls).

CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone,
	"locked_until" timestamp with time zone,
	"lockout_multiplier" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "rate_limits" FORCE ROW LEVEL SECURITY;
