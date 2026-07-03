import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth/current-user';
import { SessionService } from '@/lib/services/session-service';

/**
 * GET /api/sessions/[id] - Get a single session by ID with participants
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const session = await SessionService.getSessionById(id);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if user can access this session
    const canAccess = await SessionService.canUserAccessSession(id, userId);

    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      session,
      participants: session.participants ?? [],
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
