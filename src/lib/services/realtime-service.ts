import { createClient } from '@/lib/supabase/client';
import { DB_SCHEMA } from '@/lib/supabase/constants';
import type { OutputStream } from '@/lib/code-execution';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface CodeChangeEvent {
  sessionId: string;
  userId: string;
  code: string;
  language: string;
  timestamp: Date;
  cursorPosition?: {
    lineNumber: number;
    column: number;
  };
}

export interface UserPresenceEvent {
  sessionId: string;
  userId: string;
  userName: string;
  isActive: boolean;
  cursorPosition?: {
    lineNumber: number;
    column: number;
  };
}

export interface LanguageChangeEvent {
  sessionId: string;
  userId: string;
  language: string;
  timestamp: Date;
}

export interface UserJoinedEvent {
  sessionId: string;
  userId: string;
  userName: string;
  avatar?: string;
}

export interface UserLeftEvent {
  sessionId: string;
  userId: string;
}

export interface SessionStatusChangeEvent {
  sessionId: string;
  status: string;
}

export interface ExecutionOutputEvent {
  sessionId: string;
  userId: string;
  userName: string;
  language: string;
  success: boolean;
  streams: OutputStream[];
  error?: string;
  timestamp: Date;
}

/**
 * Realtime service using Supabase Realtime for collaborative features
 * Replaces Socket.io with Supabase Realtime channels
 */
export class RealtimeService {
  private supabase = createClient();
  private channels: Map<string, RealtimeChannel> = new Map();
  private sessionId: string | null = null;
  private userId: string | null = null;
  private userName: string | null = null;
  private tokenRefreshTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Join a session and set up realtime subscriptions
   */
  async joinSession(sessionId: string, userId: string, userName: string): Promise<void> {
    try {
      this.sessionId = sessionId;
      this.userId = userId;
      this.userName = userName;

      // Create channel for this session
      const channelName = `session:${sessionId}`;
      const channel = this.supabase.channel(channelName);

      // Subscribe to presence (user join/leave)
      channel.on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((presence: Record<string, unknown>) => {
          if (presence.userId !== this.userId) {
            this.triggerUserJoined({
              sessionId,
              userId: presence.userId as string,
              userName: presence.userName as string,
              avatar: presence.avatar as string | undefined,
            });
          }
        });
      });

      channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((presence: Record<string, unknown>) => {
          if (presence.userId !== this.userId) {
            this.triggerUserLeft({
              sessionId,
              userId: presence.userId as string,
            });
          }
        });
      });

      // Subscribe to broadcast events for real-time collaboration
      channel.on('broadcast', { event: 'code-change' }, ({ payload }) => {
        if (payload.userId !== this.userId) {
          this.triggerCodeChange(payload as CodeChangeEvent);
        }
      });

      // Forward every language change (no self-filter): broadcast is
      // `self: false`, so we never get our own, and filtering by userId would
      // drop changes from another connection on the same account. See the
      // execution-output handler below for the full rationale.
      channel.on('broadcast', { event: 'language-change' }, ({ payload }) => {
        this.triggerLanguageChange(payload as LanguageChangeEvent);
      });

      channel.on('broadcast', { event: 'user-presence' }, ({ payload }) => {
        if (payload.userId !== this.userId) {
          this.triggerUserPresence(payload as UserPresenceEvent);
        }
      });

      // Execution output is broadcast so every participant sees the same run
      // result. The runner executes once on the clicker's machine; everyone
      // else just renders the broadcast (no double execution).
      //
      // No self-filter here: Supabase broadcast defaults to `self: false`, so
      // the sender never receives its own message (it already rendered the
      // output locally). Filtering by `payload.userId` would additionally drop
      // runs coming from another connection signed in as the SAME user — e.g.
      // the same account open in two tabs, or an instructor + learner sharing a
      // login while testing — which is exactly when output failed to appear on
      // the other side. Forward every execution-output we receive.
      channel.on('broadcast', { event: 'execution-output' }, ({ payload }) => {
        this.triggerExecutionOutput(payload as ExecutionOutputEvent);
      });

      // Subscribe to database changes for session updates
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: DB_SCHEMA,
          table: 'sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const newRecord = payload.new as Record<string, unknown> | undefined;
          if (newRecord?.status) {
            this.triggerSessionStatusChange({
              sessionId,
              status: newRecord.status as string,
            });
          }
        }
      );

      // Subscribe to participant changes
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: DB_SCHEMA,
          table: 'session_participants',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          // Handle participant join/leave from database (no-op for now)
        }
      );

      // Subscribe to the channel
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track presence
          await channel.track({
            userId,
            userName,
            joinedAt: new Date().toISOString(),
            isActive: true,
          });

          // Update participant status in database
          await this.updateParticipantStatus(sessionId, userId, true);
        }
      });

      this.channels.set(sessionId, channel);

      // Clerk session tokens are short-lived (~60s) and supabase-js only
      // re-auths the realtime socket on (re)connect. Re-auth periodically so
      // RLS-gated postgres_changes keep flowing on a long-lived connection.
      if (!this.tokenRefreshTimer) {
        this.tokenRefreshTimer = setInterval(() => {
          void this.supabase.realtime.setAuth();
        }, 45_000);
      }
    } catch (error) {
      console.error('Error joining session:', error);
      throw new Error('Failed to join session');
    }
  }

  /**
   * Leave the current session
   */
  async leaveSession(): Promise<void> {
    if (!this.sessionId || !this.userId) return;

    try {
      const channel = this.channels.get(this.sessionId);
      if (channel) {
        // Untrack presence
        await channel.untrack();
        
        // Unsubscribe from channel
        await this.supabase.removeChannel(channel);
        this.channels.delete(this.sessionId);
      }

      // Stop refreshing the realtime token once no channels remain.
      if (this.channels.size === 0 && this.tokenRefreshTimer) {
        clearInterval(this.tokenRefreshTimer);
        this.tokenRefreshTimer = null;
      }

      // Update participant status in database
      await this.updateParticipantStatus(this.sessionId, this.userId, false);

      this.sessionId = null;
      this.userId = null;
      this.userName = null;
    } catch (error) {
      console.error('Error leaving session:', error);
    }
  }

  /**
   * Send code change to other participants
   */
  async sendCodeChange(code: string, language: string, cursorPosition?: { lineNumber: number; column: number }): Promise<void> {
    if (!this.sessionId || !this.userId) return;

    const channel = this.channels.get(this.sessionId);
    if (!channel) return;

    const event: CodeChangeEvent = {
      sessionId: this.sessionId,
      userId: this.userId,
      code,
      language,
      timestamp: new Date(),
      cursorPosition,
    };

    await channel.send({
      type: 'broadcast',
      event: 'code-change',
      payload: event,
    });

    // Also update the session in the database
    await this.updateSessionCode(this.sessionId, code);
  }

  /**
   * Send language change to other participants
   */
  async sendLanguageChange(language: string): Promise<void> {
    if (!this.sessionId || !this.userId) return;

    const channel = this.channels.get(this.sessionId);
    if (!channel) return;

    const event: LanguageChangeEvent = {
      sessionId: this.sessionId,
      userId: this.userId,
      language,
      timestamp: new Date(),
    };

    await channel.send({
      type: 'broadcast',
      event: 'language-change',
      payload: event,
    });

    // Also update the session in the database
    await this.updateSessionLanguage(this.sessionId, language);
  }

  /**
   * Send user presence update
   */
  async sendUserPresence(isActive: boolean, cursorPosition?: { lineNumber: number; column: number }): Promise<void> {
    if (!this.sessionId || !this.userId || !this.userName) return;

    const channel = this.channels.get(this.sessionId);
    if (!channel) return;

    const event: UserPresenceEvent = {
      sessionId: this.sessionId,
      userId: this.userId,
      userName: this.userName,
      isActive,
      cursorPosition,
    };

    await channel.send({
      type: 'broadcast',
      event: 'user-presence',
      payload: event,
    });

    // Update presence tracking
    await channel.track({
      userId: this.userId,
      userName: this.userName,
      isActive,
      cursorPosition,
      lastActivity: new Date().toISOString(),
    });
  }

  /**
   * Broadcast the result of a code run to other participants so they see the
   * same output without re-executing the code.
   */
  async sendExecutionOutput(result: {
    language: string;
    success: boolean;
    streams: OutputStream[];
    error?: string;
  }): Promise<void> {
    if (!this.sessionId || !this.userId || !this.userName) return;

    const channel = this.channels.get(this.sessionId);
    if (!channel) return;

    const event: ExecutionOutputEvent = {
      sessionId: this.sessionId,
      userId: this.userId,
      userName: this.userName,
      language: result.language,
      success: result.success,
      streams: result.streams,
      error: result.error,
      timestamp: new Date(),
    };

    await channel.send({
      type: 'broadcast',
      event: 'execution-output',
      payload: event,
    });
  }

  /**
   * Update participant status in database
   */
  private async updateParticipantStatus(sessionId: string, userId: string, isActive: boolean): Promise<void> {
    if (!sessionId || !userId) return;
    try {
      const updateData: Record<string, unknown> = {
        is_active: isActive,
      };

      if (!isActive) {
        updateData.left_at = new Date().toISOString();
      }

      await this.supabase
        .from('session_participants')
        .update(updateData)
        .eq('session_id', sessionId)
        .eq('user_id', userId);
    } catch (error) {
      console.error('Error updating participant status:', error);
    }
  }

  /**
   * Update session code in database
   */
  private async updateSessionCode(sessionId: string, code: string): Promise<void> {
    try {
      await this.supabase
        .from('sessions')
        .update({ code })
        .eq('id', sessionId);
    } catch (error) {
      console.error('Error updating session code:', error);
    }
  }

  /**
   * Update session language in database
   */
  private async updateSessionLanguage(sessionId: string, language: string): Promise<void> {
    try {
      await this.supabase
        .from('sessions')
        .update({ language })
        .eq('id', sessionId);
    } catch (error) {
      console.error('Error updating session language:', error);
    }
  }

  // Event callback storage
  private codeChangeCallbacks: ((event: CodeChangeEvent) => void)[] = [];
  private languageChangeCallbacks: ((event: LanguageChangeEvent) => void)[] = [];
  private userPresenceCallbacks: ((event: UserPresenceEvent) => void)[] = [];
  private userJoinedCallbacks: ((event: UserJoinedEvent) => void)[] = [];
  private userLeftCallbacks: ((event: UserLeftEvent) => void)[] = [];
  private sessionStatusChangeCallbacks: ((event: SessionStatusChangeEvent) => void)[] = [];
  private executionOutputCallbacks: ((event: ExecutionOutputEvent) => void)[] = [];

  // Event listener methods
  onCodeChange(callback: (event: CodeChangeEvent) => void): void {
    this.codeChangeCallbacks.push(callback);
  }

  onLanguageChange(callback: (event: LanguageChangeEvent) => void): void {
    this.languageChangeCallbacks.push(callback);
  }

  onUserPresence(callback: (event: UserPresenceEvent) => void): void {
    this.userPresenceCallbacks.push(callback);
  }

  onUserJoined(callback: (event: UserJoinedEvent) => void): void {
    this.userJoinedCallbacks.push(callback);
  }

  onUserLeft(callback: (event: UserLeftEvent) => void): void {
    this.userLeftCallbacks.push(callback);
  }

  onSessionStatusChange(callback: (event: SessionStatusChangeEvent) => void): void {
    this.sessionStatusChangeCallbacks.push(callback);
  }

  onExecutionOutput(callback: (event: ExecutionOutputEvent) => void): void {
    this.executionOutputCallbacks.push(callback);
  }

  // Event trigger methods
  private triggerCodeChange(event: CodeChangeEvent): void {
    this.codeChangeCallbacks.forEach(callback => callback(event));
  }

  private triggerLanguageChange(event: LanguageChangeEvent): void {
    this.languageChangeCallbacks.forEach(callback => callback(event));
  }

  private triggerUserPresence(event: UserPresenceEvent): void {
    this.userPresenceCallbacks.forEach(callback => callback(event));
  }

  private triggerUserJoined(event: UserJoinedEvent): void {
    this.userJoinedCallbacks.forEach(callback => callback(event));
  }

  private triggerUserLeft(event: UserLeftEvent): void {
    this.userLeftCallbacks.forEach(callback => callback(event));
  }

  private triggerSessionStatusChange(event: SessionStatusChangeEvent): void {
    this.sessionStatusChangeCallbacks.forEach(callback => callback(event));
  }

  private triggerExecutionOutput(event: ExecutionOutputEvent): void {
    this.executionOutputCallbacks.forEach(callback => callback(event));
  }

  // Remove event listeners
  offCodeChange(callback?: (event: CodeChangeEvent) => void): void {
    if (callback) {
      const index = this.codeChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.codeChangeCallbacks.splice(index, 1);
      }
    } else {
      this.codeChangeCallbacks = [];
    }
  }

  offLanguageChange(callback?: (event: LanguageChangeEvent) => void): void {
    if (callback) {
      const index = this.languageChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.languageChangeCallbacks.splice(index, 1);
      }
    } else {
      this.languageChangeCallbacks = [];
    }
  }

  offUserPresence(callback?: (event: UserPresenceEvent) => void): void {
    if (callback) {
      const index = this.userPresenceCallbacks.indexOf(callback);
      if (index > -1) {
        this.userPresenceCallbacks.splice(index, 1);
      }
    } else {
      this.userPresenceCallbacks = [];
    }
  }

  offUserJoined(callback?: (event: UserJoinedEvent) => void): void {
    if (callback) {
      const index = this.userJoinedCallbacks.indexOf(callback);
      if (index > -1) {
        this.userJoinedCallbacks.splice(index, 1);
      }
    } else {
      this.userJoinedCallbacks = [];
    }
  }

  offUserLeft(callback?: (event: UserLeftEvent) => void): void {
    if (callback) {
      const index = this.userLeftCallbacks.indexOf(callback);
      if (index > -1) {
        this.userLeftCallbacks.splice(index, 1);
      }
    } else {
      this.userLeftCallbacks = [];
    }
  }

  offSessionStatusChange(callback?: (event: SessionStatusChangeEvent) => void): void {
    if (callback) {
      const index = this.sessionStatusChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.sessionStatusChangeCallbacks.splice(index, 1);
      }
    } else {
      this.sessionStatusChangeCallbacks = [];
    }
  }

  offExecutionOutput(callback?: (event: ExecutionOutputEvent) => void): void {
    if (callback) {
      const index = this.executionOutputCallbacks.indexOf(callback);
      if (index > -1) {
        this.executionOutputCallbacks.splice(index, 1);
      }
    } else {
      this.executionOutputCallbacks = [];
    }
  }

  // Get connection status
  isConnected(): boolean {
    return this.sessionId !== null && this.channels.has(this.sessionId);
  }

  // Get current session info
  getCurrentSession(): { sessionId: string | null; userId: string | null } {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
    };
  }

  // Cleanup all channels
  async cleanup(): Promise<void> {
    for (const [sessionId, channel] of this.channels.entries()) {
      await this.supabase.removeChannel(channel);
      this.channels.delete(sessionId);
    }
    
    this.sessionId = null;
    this.userId = null;
    this.userName = null;
  }
}

// Create a singleton instance
export const realtimeService = new RealtimeService();
