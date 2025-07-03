import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/lib/services/user-service';

interface SessionSnapshot {
  id: string;
  sessionId: string;
  title: string;
  description?: string;
  code: string;
  metadata: Record<string, any>;
  createdBy: string;
  createdAt: Date;
}

/**
 * GET /api/sessions/[id]/snapshots - Get snapshots for a session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const sessionId = params.id;

    // For now, return empty array since snapshots aren't implemented in the database yet
    // This prevents the UI from showing mock data
    const snapshots: SessionSnapshot[] = [];

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
  { params }: { params: { id: string } }
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

    const sessionId = params.id;
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.code) {
      return NextResponse.json(
        { error: 'Title and code are required' },
        { status: 400 }
      );
    }

    // For now, return a mock response since snapshots aren't implemented in the database yet
    // In a real implementation, you would save to the database here
    const snapshot: SessionSnapshot = {
      id: `snap_${Date.now()}`,
      sessionId,
      title: body.title,
      description: body.description,
      code: body.code,
      metadata: {
        ...body.metadata,
        lineCount: body.code.split('\n').length,
        characterCount: body.code.length,
        createdAt: new Date().toISOString(),
      },
      createdBy: user.id,
      createdAt: new Date(),
    };

    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error('Error creating session snapshot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
