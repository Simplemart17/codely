import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Thrown when the current user is not allowed to perform a session action.
 * Server Actions should translate this into an `ActionResult` error.
 */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Verify the current user is the instructor (owner) of a session.
 *
 * This is the server-side source of truth for instructor-only features
 * (e.g. AI lesson notes). The client permission matrix in
 * `src/lib/permissions.ts` is UI-only and must never be trusted on its own —
 * a learner can fake their role client-side, so any instructor-gated mutation
 * or read must call this first.
 *
 * @returns the authenticated user's id (Clerk id) when the check passes
 * @throws {AuthorizationError} when unauthenticated, the session is missing,
 *   or the user is not the session's instructor
 */
export async function assertInstructor(sessionId: string): Promise<string> {
  const { userId } = await auth();

  if (!userId) {
    throw new AuthorizationError('Unauthorized');
  }

  const supabase = await createClient();
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('instructor_id')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    throw new AuthorizationError('Session not found');
  }

  if (session.instructor_id !== userId) {
    throw new AuthorizationError('Forbidden: instructor only');
  }

  return userId;
}
