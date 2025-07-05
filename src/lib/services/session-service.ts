import { SupabaseDatabase, type DatabaseSession, type DatabaseSessionParticipant } from '@/lib/supabase/database';
import type { Session, SessionParticipant, Language, SessionStatus } from '@/types';

export interface CreateSessionData {
  title: string;
  description?: string;
  instructorId: string;
  language: Language;
  maxParticipants?: number;
  isPublic?: boolean;
}

export interface UpdateSessionData {
  title?: string;
  description?: string;
  language?: Language;
  status?: SessionStatus;
  maxParticipants?: number;
  isPublic?: boolean;
  code?: string;
}

/**
 * Session service for database operations using Supabase
 */
export class SessionService {
  /**
   * Create a new session
   */
  static async createSession(data: CreateSessionData): Promise<Session> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();
      
      const { data: session, error } = await supabase
        .from('sessions')
        .insert({
          title: data.title,
          description: data.description,
          instructor_id: data.instructorId,
          language: data.language,
          max_participants: data.maxParticipants || 10,
          is_public: data.isPublic || false,
          code: '', // Start with empty code
        })
        .select()
        .single();

      if (error) {
        SupabaseDatabase.handleError(error);
      }

      return SupabaseDatabase.transformSession(session as DatabaseSession, []);
    } catch (error) {
      console.error('Error creating session:', error);
      throw new Error('Failed to create session');
    }
  }

  /**
   * Get session by ID with participants
   */
  static async getSessionById(id: string): Promise<Session | null> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();
      
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (sessionError) {
        if (sessionError.code === 'PGRST116') {
          return null; // Session not found
        }
        SupabaseDatabase.handleError(sessionError);
      }

      // Get participants for this session
      const { data: participants, error: participantsError } = await supabase
        .from('session_participants')
        .select(`
          *,
          users (
            id,
            name,
            email,
            role,
            avatar
          )
        `)
        .eq('session_id', id)
        .eq('is_active', true);

      if (participantsError) {
        console.error('Error fetching participants:', participantsError);
        // Continue without participants rather than failing
      }

      const transformedParticipants = participants?.map(p => 
        SupabaseDatabase.transformSessionParticipant(p as DatabaseSessionParticipant)
      ) || [];

      return session ? SupabaseDatabase.transformSession(session as DatabaseSession, transformedParticipants) : null;
    } catch (error) {
      console.error('Error getting session by ID:', error);
      throw new Error('Failed to get session');
    }
  }

  /**
   * Get sessions for a user based on filter
   */
  static async getSessionsForUser(userId: string, userRole: string, filter: string = 'all'): Promise<Session[]> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();
      
      let query = supabase.from('sessions').select(`
        *,
        session_participants!inner (
          *,
          users (
            id,
            name,
            email,
            role,
            avatar
          )
        )
      `);

      switch (filter) {
        case 'my-sessions':
          if (userRole === 'INSTRUCTOR') {
            query = query.eq('instructor_id', userId);
          } else {
            // For learners, show sessions they participate in
            query = query.eq('session_participants.user_id', userId);
          }
          break;
        case 'public':
          query = query.eq('is_public', true);
          break;
        case 'all':
        default:
          // Show all sessions user has access to
          query = query.or(`instructor_id.eq.${userId},is_public.eq.true,session_participants.user_id.eq.${userId}`);
          break;
      }

      const { data: sessions, error } = await query.order('updated_at', { ascending: false });

      if (error) {
        SupabaseDatabase.handleError(error);
      }

      // Transform sessions and group participants
      const sessionMap = new Map<string, Session>();
      
      sessions?.forEach(sessionData => {
        const sessionId = sessionData.id;
        
        if (!sessionMap.has(sessionId)) {
          sessionMap.set(sessionId, SupabaseDatabase.transformSession(sessionData as DatabaseSession, []));
        }
        
        const session = sessionMap.get(sessionId)!;
        
        // Add participants if they exist
        if (sessionData.session_participants) {
          const participant = SupabaseDatabase.transformSessionParticipant(
            sessionData.session_participants as DatabaseSessionParticipant
          );
          
          // Avoid duplicates
          if (!session.participants.some(p => p.id === participant.id)) {
            session.participants.push(participant);
          }
        }
      });

      return Array.from(sessionMap.values());
    } catch (error) {
      console.error('Error getting sessions for user:', error);
      throw new Error('Failed to get sessions');
    }
  }

  /**
   * Update session
   */
  static async updateSession(id: string, data: UpdateSessionData): Promise<Session> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();
      
      const updateData: Record<string, unknown> = {};
      
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.language !== undefined) updateData.language = data.language;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.maxParticipants !== undefined) updateData.max_participants = data.maxParticipants;
      if (data.isPublic !== undefined) updateData.is_public = data.isPublic;
      if (data.code !== undefined) updateData.code = data.code;

      const { data: session, error } = await supabase
        .from('sessions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        SupabaseDatabase.handleError(error);
      }

      return SupabaseDatabase.transformSession(session as DatabaseSession, []);
    } catch (error) {
      console.error('Error updating session:', error);
      throw new Error('Failed to update session');
    }
  }

  /**
   * Delete session
   */
  static async deleteSession(id: string): Promise<void> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();
      
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', id);

      if (error) {
        SupabaseDatabase.handleError(error);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      throw new Error('Failed to delete session');
    }
  }

  /**
   * Join a session (add participant)
   */
  static async joinSession(sessionId: string, userId: string, role: 'INSTRUCTOR' | 'PARTICIPANT' = 'PARTICIPANT'): Promise<SessionParticipant> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();
      
      const { data: participant, error } = await supabase
        .from('session_participants')
        .insert({
          session_id: sessionId,
          user_id: userId,
          role: role,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        SupabaseDatabase.handleError(error);
      }

      return SupabaseDatabase.transformSessionParticipant(participant as DatabaseSessionParticipant);
    } catch (error) {
      console.error('Error joining session:', error);
      throw new Error('Failed to join session');
    }
  }

  /**
   * Leave a session (update participant status)
   */
  static async leaveSession(sessionId: string, userId: string): Promise<void> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();
      
      const { error } = await supabase
        .from('session_participants')
        .update({
          is_active: false,
          left_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId)
        .eq('user_id', userId);

      if (error) {
        SupabaseDatabase.handleError(error);
      }
    } catch (error) {
      console.error('Error leaving session:', error);
      throw new Error('Failed to leave session');
    }
  }

  /**
   * Check if user can access session
   */
  static async canUserAccessSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();

      const { data: session } = await supabase
        .from('sessions')
        .select('instructor_id, is_public')
        .eq('id', sessionId)
        .single();

      if (!session) {
        return false;
      }

      // User can access if they are the instructor, session is public, or they are a participant
      if (session.instructor_id === userId || session.is_public) {
        return true;
      }

      const { data: participant } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      return !!participant;
    } catch (error) {
      console.error('Error checking session access:', error);
      return false;
    }
  }

  /**
   * Get snapshots for a session
   */
  static async getSessionSnapshots(sessionId: string): Promise<unknown[]> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();

      const { data: snapshots, error } = await supabase
        .from('session_snapshots')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) {
        SupabaseDatabase.handleError(error);
      }

      return snapshots?.map(snapshot =>
        SupabaseDatabase.transformSessionSnapshot(snapshot)
      ) || [];
    } catch (error) {
      console.error('Error getting session snapshots:', error);
      throw new Error('Failed to get session snapshots');
    }
  }

  /**
   * Create a session snapshot
   */
  static async createSessionSnapshot(data: {
    sessionId: string;
    title: string;
    description?: string;
    code: string;
    metadata?: Record<string, string | number | boolean>;
    createdBy: string;
  }): Promise<unknown> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();

      const { data: snapshot, error } = await supabase
        .from('session_snapshots')
        .insert({
          session_id: data.sessionId,
          title: data.title,
          description: data.description,
          code: data.code,
          metadata: {
            ...data.metadata,
            lineCount: data.code.split('\n').length,
            characterCount: data.code.length,
          },
          created_by: data.createdBy,
        })
        .select()
        .single();

      if (error) {
        SupabaseDatabase.handleError(error);
      }

      return SupabaseDatabase.transformSessionSnapshot(snapshot);
    } catch (error) {
      console.error('Error creating session snapshot:', error);
      throw new Error('Failed to create session snapshot');
    }
  }
}
