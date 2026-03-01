'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/lib/services/user-service';
import type { User, UserRole } from '@/types';

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const CreateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  role: z.enum(['INSTRUCTOR', 'LEARNER'] as const),
  avatar: z.string().url().optional(),
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['INSTRUCTOR', 'LEARNER'] as const).optional(),
  avatar: z.string().url().nullable().optional(),
  preferences: z
    .object({
      theme: z.enum(['light', 'dark']).optional(),
      fontSize: z.number().min(10).max(32).optional(),
      keyBindings: z.enum(['vscode', 'vim', 'emacs']).optional(),
    })
    .optional(),
});

export async function createUser(
  input: z.infer<typeof CreateUserSchema>
): Promise<ActionResult<User>> {
  try {
    const parsed = CreateUserSchema.safeParse(input);
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

    // Check if user already exists
    const existingUser = await UserService.getUserById(authUser.id);
    if (existingUser) {
      return { success: false, error: 'User already exists' };
    }

    const user = await UserService.createUser({
      id: authUser.id,
      email: authUser.email!,
      name: parsed.data.name,
      role: parsed.data.role as UserRole,
      avatar: parsed.data.avatar,
    });

    return { success: true, data: user };
  } catch {
    return { success: false, error: 'Failed to create user' };
  }
}

export async function updateUser(
  input: z.infer<typeof UpdateUserSchema>
): Promise<ActionResult<User>> {
  try {
    const parsed = UpdateUserSchema.safeParse(input);
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

    const user = await UserService.updateUser(authUser.id, {
      name: parsed.data.name,
      role: parsed.data.role as UserRole | undefined,
      avatar: parsed.data.avatar ?? undefined,
      preferences: parsed.data.preferences,
    });

    return { success: true, data: user };
  } catch {
    return { success: false, error: 'Failed to update user' };
  }
}
