import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import { DB_SCHEMA } from './constants';

/**
 * Server-side Supabase client authenticated as the current Clerk user.
 *
 * Auth is delegated to Clerk (third-party auth): each request carries the Clerk
 * session JWT via `accessToken`, and Supabase RLS matches its `sub` claim
 * against the text user-id columns (see supabase/migrations). There is no
 * Supabase session or cookie handling anymore.
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Publishable key (new model), falling back to the legacy anon key.
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    db: { schema: DB_SCHEMA },
    accessToken: async () => {
      const { getToken } = await auth();
      return (await getToken()) ?? null;
    },
  });
}
