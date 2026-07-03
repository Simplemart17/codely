import { NextResponse } from 'next/server';
import { ensureUser } from '@/lib/auth/current-user';

/**
 * GET /api/users - Get current user data
 * Mutations (create/update) moved to Server Actions in src/lib/actions/user-actions.ts
 */
export async function GET() {
  try {
    const user = await ensureUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
