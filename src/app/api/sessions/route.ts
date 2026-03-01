import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/lib/services/user-service';
import { SessionService } from '@/lib/services/session-service';
import type { Language } from '@/types';

/**
 * POST /api/sessions - Create a new session
 * Only instructors can create sessions
 */
export async function POST(request: NextRequest) {
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

    // Get user from database to check role
    const user = await UserService.getUserById(authUser.id);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is an instructor
    if (user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { error: 'Only instructors can create sessions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, description, language, maxParticipants, isPublic } = body;

    // Validate required fields
    if (!title || !language) {
      return NextResponse.json(
        { error: 'Title and language are required' },
        { status: 400 }
      );
    }

    // Validate language
    if (!['JAVASCRIPT', 'PYTHON', 'CSHARP'].includes(language)) {
      return NextResponse.json(
        { error: 'Invalid language. Must be JAVASCRIPT, PYTHON, or CSHARP' },
        { status: 400 }
      );
    }

    // Create session in database
    const session = await SessionService.createSession({
      title,
      description,
      instructorId: user.id,
      language: language as Language,
      maxParticipants: maxParticipants || 10,
      isPublic: isPublic || false,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sessions - Get sessions for current user
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';

    // Get sessions using the SessionService
    const sessions = await SessionService.getSessionsForUser(user.id, user.role, filter);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
