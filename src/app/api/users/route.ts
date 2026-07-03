import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/current-user';
import { UserService } from '@/lib/services/user-service';

/**
 * GET /api/users - Get current user data
 * Mutations (create/update) moved to Server Actions in src/lib/actions/user-actions.ts
 */
export async function GET() {
  try {
    const authUser = await getAuthUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create user in database (role stays as-is for existing users)
    const user = await UserService.upsertUser({
      id: authUser.id,
      email: authUser.email,
      name: authUser.name,
      role: 'LEARNER',
      avatar: authUser.avatar,
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
