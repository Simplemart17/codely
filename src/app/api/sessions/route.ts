import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/lib/services/user-service';
import { prisma } from '@/lib/prisma';
import type { Language, CreateSessionData } from '@/types';

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
    const session = await prisma.session.create({
      data: {
        title,
        description: description || null,
        instructorId: user.id,
        language: language as Language,
        maxParticipants: maxParticipants || 10,
        isPublic: isPublic || false,
        code: '', // Start with empty code
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // Transform to our Session type
    const sessionResponse = {
      id: session.id,
      title: session.title,
      description: session.description,
      instructorId: session.instructorId,
      language: session.language,
      status: session.status,
      maxParticipants: session.maxParticipants,
      isPublic: session.isPublic,
      code: session.code,
      participants: session.participants.map(p => ({
        id: p.id,
        userId: p.userId,
        sessionId: p.sessionId,
        role: p.role,
        joinedAt: p.joinedAt,
        isActive: p.isActive,
        cursorPosition: p.cursorPosition,
      })),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };

    return NextResponse.json({ session: sessionResponse }, { status: 201 });
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

    let whereClause: any = {};

    switch (filter) {
      case 'my-sessions':
        if (user.role === 'INSTRUCTOR') {
          whereClause.instructorId = user.id;
        } else {
          // For learners, show sessions they participate in
          whereClause.participants = {
            some: {
              userId: user.id,
            },
          };
        }
        break;
      case 'public':
        whereClause.isPublic = true;
        break;
      case 'all':
      default:
        // Show all sessions user has access to
        whereClause.OR = [
          { instructorId: user.id }, // Sessions they created
          { isPublic: true }, // Public sessions
          {
            participants: {
              some: {
                userId: user.id,
              },
            },
          }, // Sessions they participate in
        ];
        break;
    }

    const sessions = await prisma.session.findMany({
      where: whereClause,
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Transform to our Session type
    const sessionsResponse = sessions.map(session => ({
      id: session.id,
      title: session.title,
      description: session.description,
      instructorId: session.instructorId,
      language: session.language,
      status: session.status,
      maxParticipants: session.maxParticipants,
      isPublic: session.isPublic,
      code: session.code,
      participants: session.participants.map(p => ({
        id: p.id,
        userId: p.userId,
        sessionId: p.sessionId,
        role: p.role,
        joinedAt: p.joinedAt,
        isActive: p.isActive,
        cursorPosition: p.cursorPosition,
      })),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));

    return NextResponse.json({ sessions: sessionsResponse });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
