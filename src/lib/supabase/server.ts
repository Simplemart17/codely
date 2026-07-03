import { auth } from '@clerk/nextjs/server';
import { makeSupabaseClient } from './create-client';

/**
 * Server-side Supabase client authenticated as the current Clerk user.
 *
 * Auth is delegated to Clerk (third-party auth): each request carries the Clerk
 * session JWT via `accessToken`, and Supabase RLS matches its `sub` claim
 * against the text user-id columns (see supabase/migrations). There is no
 * Supabase session or cookie handling anymore.
 */
export async function createClient() {
  return makeSupabaseClient(async () => {
    const { getToken } = await auth();
    return (await getToken()) ?? null;
  });
}
