import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. SERVER ONLY. Bypasses RLS.
 * Used for guest token routes (after validating the token) and storage signing.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
