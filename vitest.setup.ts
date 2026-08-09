/**
 * Vitest global setup — loads the isolated test DB credentials and enforces
 * the Step-3 safety guard before ANY test runs.
 *
 * This runs once per Vitest worker before the suite. It loads `.env.test.local`
 * (the isolated staging project — never production `.env.local`) and asserts
 * the resolved DATABASE_URL host is not the production project. An accidental
 * repoint to production makes the whole suite fail loudly and immediately.
 */
import { loadTestEnv } from "@/lib/test-env";

export function setup() {
  loadTestEnv();
}
