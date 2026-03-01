import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/lib/services/user-service';
import { SessionService } from '@/lib/services/session-service';

/**
 * GET /api/sessions/[id]/snapshots - Get snapshots for a session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const sessionId = resolvedParams.id;

    // Check if user can access this session
    const canAccess = await SessionService.canUserAccessSession(sessionId, authUser.id);
    if (!canAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get snapshots for the session
    const snapshots = await SessionService.getSessionSnapshots(sessionId);

    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error('Error fetching session snapshots:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions/[id]/snapshots - Create a new snapshot
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await UserService.getUserById(authUser.id);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const resolvedParams = await params;
    const sessionId = resolvedParams.id;
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.code) {
      return NextResponse.json(
        { error: 'Title and code are required' },
        { status: 400 }
      );
    }

    // Check if user can access this session
    const canAccess = await SessionService.canUserAccessSession(sessionId, user.id);
    if (!canAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Create the snapshot
    const snapshot = await SessionService.createSessionSnapshot({
      sessionId,
      title: body.title,
      description: body.description,
      code: body.code,
      metadata: body.metadata,
      createdBy: user.id,
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error('Error creating session snapshot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
