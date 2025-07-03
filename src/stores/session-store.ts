import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Session, SessionParticipant } from '@/types';

interface SessionState {
  // Current session data
  currentSession: Session | null;
  participants: SessionParticipant[];
  isLoading: boolean;
  error: string | null;

  // User sessions
  userSessions: Session[];
  
  // Session management actions
  setCurrentSession: (session: Session | null) => void;
  setParticipants: (participants: SessionParticipant[]) => void;
  addParticipant: (participant: SessionParticipant) => void;
  removeParticipant: (userId: string) => void;
  updateParticipant: (userId: string, updates: Partial<SessionParticipant>) => void;
  
  // Session CRUD operations
  createSession: (sessionData: Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'participants' | 'code' | 'status'>) => Promise<Session>;
  joinSession: (sessionId: string, userId: string) => Promise<void>;
  leaveSession: (sessionId: string, userId: string) => Promise<void>;
  updateSession: (sessionId: string, updates: Partial<Session>) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  
  // Data fetching
  fetchUserSessions: (userId: string) => Promise<void>;
  fetchSession: (sessionId: string) => Promise<void>;
  
  // UI state
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useSessionStore = create<SessionState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentSession: null,
      participants: [],
      isLoading: false,
      error: null,
      userSessions: [],

      // Session management actions
      setCurrentSession: (session) => set({ currentSession: session }),
      
      setParticipants: (participants) => set({ participants }),
      
      addParticipant: (participant) => set((state) => ({
        participants: [...state.participants, participant]
      })),
      
      removeParticipant: (userId) => set((state) => ({
        participants: state.participants.filter(p => p.userId !== userId)
      })),
      
      updateParticipant: (userId, updates) => set((state) => ({
        participants: state.participants.map(p => 
          p.userId === userId ? { ...p, ...updates } : p
        )
      })),

      // Session CRUD operations
      createSession: async (sessionData) => {
        set({ isLoading: true, error: null });
        try {
          // Call API to create session (with role-based authorization)
          const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(sessionData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create session');
          }

          const { session: newSession } = await response.json();

          set((state) => ({
            userSessions: [...state.userSessions, newSession],
            isLoading: false
          }));

          return newSession;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create session',
            isLoading: false
          });
          throw error;
        }
      },

      joinSession: async (sessionId, userId) => {
        set({ isLoading: true, error: null });
        try {
          // Call API to join session
          const response = await fetch(`/api/sessions/${sessionId}/join`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to join session');
          }

          const { participant } = await response.json();
          get().addParticipant(participant);
          set({ isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to join session',
            isLoading: false
          });
          throw error;
        }
      },

      leaveSession: async (sessionId, userId) => {
        set({ isLoading: true, error: null });
        try {
          // Call API to leave session
          const response = await fetch(`/api/sessions/${sessionId}/leave`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to leave session');
          }

          get().removeParticipant(userId);
          set({ isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to leave session',
            isLoading: false
          });
          throw error;
        }
      },

      updateSession: async (sessionId, updates) => {
        set({ isLoading: true, error: null });
        try {
          // Call API to update session
          const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update session');
          }

          const { session: updatedSession } = await response.json();

          set((state) => ({
            currentSession: state.currentSession?.id === sessionId
              ? updatedSession
              : state.currentSession,
            userSessions: state.userSessions.map(session =>
              session.id === sessionId
                ? updatedSession
                : session
            ),
            isLoading: false
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update session',
            isLoading: false
          });
          throw error;
        }
      },

      deleteSession: async (sessionId) => {
        set({ isLoading: true, error: null });
        try {
          // Call API to delete session
          const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete session');
          }

          set((state) => ({
            userSessions: state.userSessions.filter(session => session.id !== sessionId),
            currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
            isLoading: false
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete session',
            isLoading: false
          });
          throw error;
        }
      },

      // Data fetching
      fetchUserSessions: async (userId, filter = 'all') => {
        set({ isLoading: true, error: null });
        try {
          // Call API to fetch sessions with filter
          const response = await fetch(`/api/sessions?filter=${filter}`);

          if (!response.ok) {
            throw new Error('Failed to fetch sessions');
          }

          const { sessions } = await response.json();

          set({ userSessions: sessions, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch sessions',
            isLoading: false
          });
          throw error;
        }
      },

      fetchSession: async (sessionId) => {
        set({ isLoading: true, error: null });
        try {
          // Call API to fetch specific session
          const response = await fetch(`/api/sessions/${sessionId}`);

          if (!response.ok) {
            throw new Error('Failed to fetch session');
          }

          const { session } = await response.json();

          set({ currentSession: session, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch session',
            isLoading: false
          });
          throw error;
        }
      },

      // UI state management
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'session-store',
    }
  )
);
