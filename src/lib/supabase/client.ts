import { makeSupabaseClient } from './create-client';

/**
 * Browser Supabase client authenticated as the current Clerk user.
 *
 * Clerk is exposed on `window.Clerk` once <ClerkProvider> has mounted; its
 * session JWT is injected via `accessToken` and Supabase RLS matches the `sub`
 * claim. Components that only run DB queries need no changes — the token is
 * attached automatically. (Auth actions like sign-in/out use Clerk's hooks.)
 */
export function createClient() {
  return makeSupabaseClient(async () => {
    const clerk = (
      window as unknown as {
        Clerk?: {
          load?: () => Promise<unknown>;
          session?: { getToken: () => Promise<string | null> };
        };
      }
    ).Clerk;
    if (!clerk) return null;
    // Wait for Clerk to finish loading its session, so an early query on a cold
    // page load doesn't run unauthenticated (which RLS silently denies).
    if (typeof clerk.load === 'function') {
      try {
        await clerk.load();
      } catch {
        // already loaded, or load failed — fall through to getToken()
      }
    }
    return (await clerk.session?.getToken()) ?? null;
  });
}
