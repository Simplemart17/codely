import { auth, currentUser } from '@clerk/nextjs/server';

/** The current user's app-level identity, sourced from Clerk. */
export interface AuthUser {
  id: string; // Clerk user id (also the codely.users PK and the JWT `sub`)
  email: string;
  name: string;
  avatar?: string;
}

/**
 * The current Clerk user id, or null when unauthenticated. Cheap — use this for
 * the common "who is calling" check in server actions and route handlers.
 */
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * The full current-user profile from Clerk, for syncing into codely.users.
 * Heavier than getUserId (fetches the Clerk user), so only call it when you
 * actually need email/name/avatar.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const user = await currentUser();
  if (!user) return null;

  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    '';
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.username ||
    (email ? email.split('@')[0] : 'User');

  return { id: user.id, email, name, avatar: user.imageUrl };
}
