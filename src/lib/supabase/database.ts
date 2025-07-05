import { createClient } from '@/lib/supabase/server';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import type {
  User,
  Session,
  SessionParticipant,
  Operation,
  SessionInvitation,
  SessionRecording,
  SessionSnapshot,
  UserRole,
  Language,
  SessionStatus,
  OperationType,
  ParticipantRole,
  InvitationStatus,
  UserPreferences
} from '@/types';

// Database types that match Supabase schema
export interface DatabaseUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  preferences: UserPreferences;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSession {
  id: string;
  title: string;
  description?: string;
  instructor_id: string;
  language: Language;
  status: SessionStatus;
  max_participants: number;
  is_public: boolean;
  code: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSessionParticipant {
  id: string;
  user_id: string;
  session_id: string;
  role: ParticipantRole;
  joined_at: string;
  left_at?: string;
  is_active: boolean;
  cursor_position?: {
    line: number;
    column: number;
  } | null;
}

export interface DatabaseOperation {
  id: string;
  session_id: string;
  user_id: string;
  type: OperationType;
  position: number;
  content?: string;
  length?: number;
  timestamp: string;
  vector_clock: Record<string, number>;
}

export interface DatabaseSessionInvitation {
  id: string;
  session_id: string;
  sender_id: string;
  recipient_id: string;
  email: string;
  status: InvitationStatus;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSessionRecording {
  id: string;
  session_id: string;
  title: string;
  description?: string;
  duration: number;
  file_url: string;
  thumbnail_url?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSessionSnapshot {
  id: string;
  session_id: string;
  title: string;
  description?: string;
  code: string;
  metadata: Record<string, string | number | boolean>;
  created_by: string;
  created_at: string;
}

/**
 * Database service for Supabase operations
 * Provides a clean interface for database operations
 */
export class SupabaseDatabase {
  /**
   * Get Supabase client (server-side)
   */
  static async getServerClient() {
    return await createClient();
  }

  /**
   * Get Supabase client (client-side)
   */
  static getBrowserClient() {
    return createBrowserClient();
  }

  /**
   * Transform database user to application user type
   */
  static transformUser(dbUser: DatabaseUser): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      avatar: dbUser.avatar,
      preferences: dbUser.preferences,
      createdAt: new Date(dbUser.created_at),
      updatedAt: new Date(dbUser.updated_at),
    };
  }

  /**
   * Transform database session to application session type
   */
  static transformSession(dbSession: DatabaseSession, participants: SessionParticipant[] = []): Session {
    return {
      id: dbSession.id,
      title: dbSession.title,
      description: dbSession.description,
      instructorId: dbSession.instructor_id,
      language: dbSession.language,
      status: dbSession.status,
      maxParticipants: dbSession.max_participants,
      isPublic: dbSession.is_public,
      code: dbSession.code,
      participants,
      createdAt: new Date(dbSession.created_at),
      updatedAt: new Date(dbSession.updated_at),
    };
  }

  /**
   * Transform database session participant to application type
   */
  static transformSessionParticipant(dbParticipant: DatabaseSessionParticipant): SessionParticipant {
    return {
      id: dbParticipant.id,
      userId: dbParticipant.user_id,
      sessionId: dbParticipant.session_id,
      role: dbParticipant.role,
      joinedAt: new Date(dbParticipant.joined_at),
      leftAt: dbParticipant.left_at ? new Date(dbParticipant.left_at) : undefined,
      isActive: dbParticipant.is_active,
      cursorPosition: dbParticipant.cursor_position,
    };
  }

  /**
   * Transform database operation to application type
   */
  static transformOperation(dbOperation: DatabaseOperation): Operation {
    return {
      id: dbOperation.id,
      sessionId: dbOperation.session_id,
      userId: dbOperation.user_id,
      type: dbOperation.type,
      position: dbOperation.position,
      content: dbOperation.content,
      length: dbOperation.length,
      timestamp: new Date(dbOperation.timestamp),
      vectorClock: dbOperation.vector_clock,
    };
  }

  /**
   * Transform database session invitation to application type
   */
  static transformSessionInvitation(dbInvitation: DatabaseSessionInvitation): SessionInvitation {
    return {
      id: dbInvitation.id,
      sessionId: dbInvitation.session_id,
      senderId: dbInvitation.sender_id,
      recipientId: dbInvitation.recipient_id,
      email: dbInvitation.email,
      status: dbInvitation.status,
      expiresAt: dbInvitation.expires_at ? new Date(dbInvitation.expires_at) : undefined,
      createdAt: new Date(dbInvitation.created_at),
      updatedAt: new Date(dbInvitation.updated_at),
    };
  }

  /**
   * Transform database session recording to application type
   */
  static transformSessionRecording(dbRecording: DatabaseSessionRecording): SessionRecording {
    return {
      id: dbRecording.id,
      sessionId: dbRecording.session_id,
      title: dbRecording.title,
      description: dbRecording.description,
      duration: dbRecording.duration,
      fileUrl: dbRecording.file_url,
      thumbnailUrl: dbRecording.thumbnail_url,
      isPublic: dbRecording.is_public,
      createdAt: new Date(dbRecording.created_at),
      updatedAt: new Date(dbRecording.updated_at),
    };
  }

  /**
   * Transform database session snapshot to application type
   */
  static transformSessionSnapshot(dbSnapshot: DatabaseSessionSnapshot): SessionSnapshot {
    return {
      id: dbSnapshot.id,
      sessionId: dbSnapshot.session_id,
      title: dbSnapshot.title,
      description: dbSnapshot.description,
      code: dbSnapshot.code,
      metadata: dbSnapshot.metadata,
      createdBy: dbSnapshot.created_by,
      createdAt: new Date(dbSnapshot.created_at),
    };
  }

  /**
   * Handle Supabase errors and convert to application errors
   */
  static handleError(error: unknown): never {
    console.error('Database error:', error);

    // Type guard for error objects
    if (error && typeof error === 'object' && 'code' in error) {
      const dbError = error as { code: string; message?: string };

      if (dbError.code === 'PGRST116') {
        throw new Error('Record not found');
      }

      if (dbError.code === '23505') {
        throw new Error('Record already exists');
      }

      if (dbError.code === '23503') {
        throw new Error('Referenced record not found');
      }

      throw new Error(dbError.message || 'Database operation failed');
    }

    // Handle string errors
    if (typeof error === 'string') {
      throw new Error(error);
    }

    throw new Error('Unknown database error occurred');
  }
}
