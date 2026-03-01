import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/lib/services/user-service';

/**
 * GET /api/users - Get current user data
 * Mutations (create/update) moved to Server Actions in src/lib/actions/user-actions.ts
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create user in database
    const user = await UserService.upsertUser({
      id: authUser.id,
      email: authUser.email!,
      name:
        authUser.user_metadata?.name ||
        authUser.email!.split('@')[0],
      role: authUser.user_metadata?.role || 'LEARNER',
      avatar: authUser.user_metadata?.avatar_url,
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
