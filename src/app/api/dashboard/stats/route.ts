import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/lib/services/user-service';
import { SupabaseDatabase } from '@/lib/supabase/database';

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

    // Get or create user in database
    const user = await UserService.upsertUser({
      id: authUser.id,
      email: authUser.email!,
      name: authUser.user_metadata?.name || authUser.email!.split('@')[0],
      role: authUser.user_metadata?.role || 'LEARNER',
      avatar: authUser.user_metadata?.avatar_url,
    });

    // Get user statistics using Supabase
    const supabaseClient = await SupabaseDatabase.getServerClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      sessionsCreatedResult,
      sessionsParticipatedResult,
      activeSessionsResult,
      totalParticipantsResult,
      recentSessionsResult,
    ] = await Promise.all([
      // Sessions created by user (if instructor)
      user.role === 'INSTRUCTOR'
        ? supabaseClient
            .from('sessions')
            .select('id', { count: 'exact', head: true })
            .eq('instructor_id', user.id)
        : Promise.resolve({ count: 0 }),

      // Sessions user has participated in
      supabaseClient
        .from('session_participants')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),

      // Currently active sessions
      user.role === 'INSTRUCTOR'
        ? supabaseClient
            .from('sessions')
            .select('id', { count: 'exact', head: true })
            .eq('instructor_id', user.id)
            .eq('status', 'ACTIVE')
        : (async () => {
            const { data: participantSessions } = await supabaseClient
              .from('session_participants')
              .select('session_id')
              .eq('user_id', user.id);
            const sessionIds = participantSessions?.map(p => p.session_id) ?? [];
            let query = supabaseClient
              .from('sessions')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'ACTIVE');
            if (sessionIds.length > 0) {
              query = query.or(`is_public.eq.true,id.in.(${sessionIds.join(',')})`);
            } else {
              query = query.eq('is_public', true);
            }
            return query;
          })(),

      // Total participants across user's sessions (if instructor)
      user.role === 'INSTRUCTOR'
        ? (async () => {
            // First get the session IDs
            const { data: sessionData } = await supabaseClient
              .from('sessions')
              .select('id')
              .eq('instructor_id', user.id);

            const sessionIds = sessionData?.map(s => s.id) || [];

            if (sessionIds.length === 0) {
              return { count: 0 };
            }

            // Then count participants in those sessions
            return supabaseClient
              .from('session_participants')
              .select('id', { count: 'exact', head: true })
              .in('session_id', sessionIds);
          })()
        : Promise.resolve({ count: 0 }),

      // Recent sessions (last 7 days)
      user.role === 'INSTRUCTOR'
        ? supabaseClient
            .from('sessions')
            .select('id', { count: 'exact', head: true })
            .eq('instructor_id', user.id)
            .gte('created_at', sevenDaysAgo)
        : supabaseClient
            .from('session_participants')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('joined_at', sevenDaysAgo),
    ]);

    const sessionsCreated = sessionsCreatedResult.count || 0;
    const sessionsParticipated = sessionsParticipatedResult.count || 0;
    const activeSessions = activeSessionsResult.count || 0;
    const totalParticipants = totalParticipantsResult.count || 0;
    const recentSessions = recentSessionsResult.count || 0;

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
