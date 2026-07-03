import { auth, currentUser } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user-service';
import type { User, UserRole } from '@/types';

/** The current user's app-level identity, sourced from Clerk. */
export interface AuthUser {
  id: string; // Clerk user id (also the codely.users PK and the JWT `sub`)
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
}

/**
 * The current Clerk user id, or null when unauthenticated. Cheap — reads the
 * verified JWT with no network call. Use for the common "who is calling" check.
 */
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * The full current-user profile from Clerk, for creating the codely.users row.
 * Heavier than getUserId (fetches the Clerk user), so only call it when the row
 * may need to be created. `role` comes from Clerk publicMetadata (defaults
 * LEARNER) — set it there to provision an instructor.
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
  const role: UserRole =
    (user.publicMetadata?.role as string | undefined)?.toUpperCase() ===
    'INSTRUCTOR'
      ? 'INSTRUCTOR'
      : 'LEARNER';

  return { id: user.id, email, name, avatar: user.imageUrl, role };
}

/**
 * Return the current user's codely.users row, creating it from Clerk if it
 * doesn't exist yet. This is the single entry point every authenticated
 * server path uses, so a brand-new user is provisioned on first touch even if
 * the Clerk webhook isn't configured or hasn't fired.
 *
 * Fast path (row exists): one JWT read + one indexed lookup, no Clerk fetch and
 * no write. Creation is idempotent — codely.users.email is not unique, so a
 * concurrent insert or an email clash can't 500 the request.
 */
export async function ensureUser(): Promise<User | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const existing = await UserService.getUserById(userId);
  if (existing) return existing;

  const authUser = await getAuthUser();
  if (!authUser) return null;

  return UserService.upsertUser({
    id: authUser.id,
    email: authUser.email,
    name: authUser.name,
    role: authUser.role,
    avatar: authUser.avatar,
  });
}
