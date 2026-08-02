import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client initialised with the service-role key.
 * Must only be used in Server Actions and Route Handlers — never
 * imported in a Client Component or a file that leaks to the bundle.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
