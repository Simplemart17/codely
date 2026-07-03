import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { DB_SCHEMA } from './constants';

/**
 * Service-role Supabase client that BYPASSES RLS.
 *
 * SERVER-ONLY — never import this into client code, and never expose
 * SUPABASE_SERVICE_ROLE_KEY to the browser. Its only use is the Clerk webhook,
 * which must sync codely.users without a per-user JWT (there is no user session
 * on a server-to-server webhook call).
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Missing admin env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'
    );
  }

  return createSupabaseClient(supabaseUrl, serviceKey, {
    db: { schema: DB_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
