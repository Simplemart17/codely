import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { DB_SCHEMA } from './constants';

/**
 * Shared Supabase client factory for the browser and server variants, which
 * differ only in how they obtain the Clerk token. Callers pass an `accessToken`
 * getter; RLS then matches the token's `sub` claim (see supabase/migrations).
 *
 * The key here is the low-privilege PostgREST publishable/anon key — never a
 * secret. The legacy anon key is a migration fallback; set the publishable key
 * in every environment and it can be dropped.
 */
export function makeSupabaseClient(accessToken: () => Promise<string | null>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    db: { schema: DB_SCHEMA },
    accessToken,
  });
}
