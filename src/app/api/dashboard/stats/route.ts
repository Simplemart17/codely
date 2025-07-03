import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/lib/services/user-service';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/dashboard/stats - Get dashboard statistics for current user
 */
export async function GET() {
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

    // Get user statistics
    const [
      sessionsCreated,
      sessionsParticipated,
      activeSessions,
      totalParticipants,
      recentSessions,
    ] = await Promise.all([
      // Sessions created by user (if instructor)
      user.role === 'INSTRUCTOR' 
        ? prisma.session.count({
            where: { instructorId: user.id },
          })
        : 0,
      
      // Sessions user has participated in
      prisma.sessionParticipant.count({
        where: { userId: user.id },
      }),
      
      // Currently active sessions
      user.role === 'INSTRUCTOR'
        ? prisma.session.count({
            where: { 
              instructorId: user.id,
              status: 'ACTIVE',
            },
          })
        : prisma.session.count({
            where: {
              status: 'ACTIVE',
              OR: [
                { isPublic: true },
                {
                  participants: {
                    some: { userId: user.id },
                  },
                },
              ],
            },
          }),
      
      // Total participants across user's sessions (if instructor)
      user.role === 'INSTRUCTOR'
        ? prisma.sessionParticipant.count({
            where: {
              session: {
                instructorId: user.id,
              },
            },
          })
        : 0,
      
      // Recent sessions (last 7 days)
      user.role === 'INSTRUCTOR'
        ? prisma.session.count({
            where: {
              instructorId: user.id,
              createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          })
        : prisma.sessionParticipant.count({
            where: {
              userId: user.id,
              joinedAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          }),
    ]);

    const stats = {
      sessionsCreated,
      sessionsParticipated,
      activeSessions,
      totalParticipants,
      recentSessions,
      userRole: user.role,
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
