'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/lib/services/user-service';
import { SessionService } from '@/lib/services/session-service';
import type { ActionResult } from './user-actions';

const CreateSnapshotSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(500).optional(),
  code: z.string().min(1, 'Code is required'),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export async function createSnapshot(
  input: z.infer<typeof CreateSnapshotSchema>
): Promise<ActionResult<unknown>> {
  try {
    const parsed = CreateSnapshotSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await UserService.getUserById(authUser.id);
    if (!user) return { success: false, error: 'User not found' };

    // Check access
    const canAccess = await SessionService.canUserAccessSession(
      parsed.data.sessionId,
      user.id
    );
    if (!canAccess) {
      return { success: false, error: 'Access denied' };
    }

    const snapshot = await SessionService.createSessionSnapshot({
      sessionId: parsed.data.sessionId,
      title: parsed.data.title,
      description: parsed.data.description,
      code: parsed.data.code,
      metadata: parsed.data.metadata,
      createdBy: user.id,
    });

    return { success: true, data: snapshot };
  } catch {
    return { success: false, error: 'Failed to create snapshot' };
  }
}
