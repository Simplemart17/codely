import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { DB_SCHEMA } from './constants';

/**
 * Browser Supabase client authenticated as the current Clerk user.
 *
 * Clerk is exposed on `window.Clerk` once <ClerkProvider> has mounted; its
 * session JWT is injected via `accessToken` and Supabase RLS matches the `sub`
 * claim. Components that only run DB queries need no changes — the token is
 * attached automatically. (Auth actions like sign-in/out use Clerk's hooks.)
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    db: { schema: DB_SCHEMA },
    accessToken: async () => {
      const clerk = (
        window as unknown as {
          Clerk?: { session?: { getToken: () => Promise<string | null> } };
        }
      ).Clerk;
      return (await clerk?.session?.getToken()) ?? null;
    },
  });
}
