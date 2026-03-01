'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/lib/services/user-service';
import { SessionService } from '@/lib/services/session-service';
import type { Session, SessionParticipant, Language } from '@/types';
import type { ActionResult } from './user-actions';

const CreateSessionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(500).optional(),
  language: z.enum(['JAVASCRIPT', 'PYTHON', 'CSHARP'] as const),
  maxParticipants: z.number().min(2).max(50).default(10),
  isPublic: z.boolean().default(false),
});

const UpdateSessionSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  language: z.enum(['JAVASCRIPT', 'PYTHON', 'CSHARP'] as const).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'ENDED'] as const).optional(),
  maxParticipants: z.number().min(2).max(50).optional(),
  isPublic: z.boolean().optional(),
  code: z.string().optional(),
});

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) return null;

  const user = await UserService.getUserById(authUser.id);
  return user;
}

export async function createSession(
  input: z.infer<typeof CreateSessionSchema>
): Promise<ActionResult<Session>> {
  try {
    const parsed = CreateSessionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (user.role !== 'INSTRUCTOR') {
      return { success: false, error: 'Only instructors can create sessions' };
    }

    const session = await SessionService.createSession({
      title: parsed.data.title,
      description: parsed.data.description,
      instructorId: user.id,
      language: parsed.data.language as Language,
      maxParticipants: parsed.data.maxParticipants,
      isPublic: parsed.data.isPublic,
    });

    return { success: true, data: session };
  } catch {
    return { success: false, error: 'Failed to create session' };
  }
}

export async function updateSession(
  input: z.infer<typeof UpdateSessionSchema>
): Promise<ActionResult<Session>> {
  try {
    const parsed = UpdateSessionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { sessionId, ...updates } = parsed.data;

    const session = await SessionService.updateSession(sessionId, {
      title: updates.title,
      description: updates.description,
      language: updates.language as Language | undefined,
      status: updates.status,
      maxParticipants: updates.maxParticipants,
      isPublic: updates.isPublic,
      code: updates.code,
    });

    return { success: true, data: session };
  } catch {
    return { success: false, error: 'Failed to update session' };
  }
}

export async function deleteSession(
  sessionId: string
): Promise<ActionResult<void>> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    await SessionService.deleteSession(sessionId);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Failed to delete session' };
  }
}

export async function joinSession(
  sessionId: string
): Promise<ActionResult<SessionParticipant>> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const participant = await SessionService.joinSession(sessionId, user.id);
    return { success: true, data: participant };
  } catch {
    return { success: false, error: 'Failed to join session' };
  }
}

export async function leaveSession(
  sessionId: string
): Promise<ActionResult<void>> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    await SessionService.leaveSession(sessionId, user.id);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Failed to leave session' };
  }
}
