import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Session, SessionParticipant } from '@/types';
import {
  createSession as createSessionAction,
  joinSession as joinSessionAction,
  leaveSession as leaveSessionAction,
  updateSession as updateSessionAction,
  deleteSession as deleteSessionAction,
} from '@/lib/actions/session-actions';

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
  updateParticipant: (
    userId: string,
    updates: Partial<SessionParticipant>
  ) => void;

  // Session CRUD operations (via Server Actions)
  createSession: (
    sessionData: Omit<
      Session,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'participants'
      | 'code'
      | 'status'
    >
  ) => Promise<Session>;
  joinSession: (sessionId: string) => Promise<void>;
  leaveSession: (sessionId: string) => Promise<void>;
  updateSession: (
    sessionId: string,
    updates: Partial<Session>
  ) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;

  // Data fetching (still via API routes)
  fetchUserSessions: (userId: string, filter?: string) => Promise<void>;
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

      addParticipant: (participant) =>
        set((state) => ({
          participants: [...state.participants, participant],
        })),

      removeParticipant: (userId) =>
        set((state) => ({
          participants: state.participants.filter((p) => p.userId !== userId),
        })),

      updateParticipant: (userId, updates) =>
        set((state) => ({
          participants: state.participants.map((p) =>
            p.userId === userId ? { ...p, ...updates } : p
          ),
        })),

      // Session CRUD via Server Actions
      createSession: async (sessionData) => {
        set({ isLoading: true, error: null });
        try {
          const result = await createSessionAction({
            title: sessionData.title,
            description: sessionData.description,
            language: sessionData.language,
            maxParticipants: sessionData.maxParticipants,
            isPublic: sessionData.isPublic,
          });

          if (!result.success) {
            throw new Error(result.error);
          }

          set((state) => ({
            userSessions: [...state.userSessions, result.data],
            isLoading: false,
          }));

          return result.data;
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to create session',
            isLoading: false,
          });
          throw error;
        }
      },

      joinSession: async (sessionId) => {
        set({ isLoading: true, error: null });
        try {
          const result = await joinSessionAction(sessionId);

          if (!result.success) {
            throw new Error(result.error);
          }

          get().addParticipant(result.data);
          set({ isLoading: false });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to join session',
            isLoading: false,
          });
          throw error;
        }
      },

      leaveSession: async (sessionId) => {
        set({ isLoading: true, error: null });
        try {
          const result = await leaveSessionAction(sessionId);

          if (!result.success) {
            throw new Error(result.error);
          }

          // We don't have the userId here directly, so we rely on the caller to manage participant state
          set({ isLoading: false });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to leave session',
            isLoading: false,
          });
          throw error;
        }
      },

      updateSession: async (sessionId, updates) => {
        set({ isLoading: true, error: null });
        try {
          const result = await updateSessionAction({
            sessionId,
            title: updates.title,
            description: updates.description,
            language: updates.language,
            status: updates.status,
            maxParticipants: updates.maxParticipants,
            isPublic: updates.isPublic,
            code: updates.code,
          });

          if (!result.success) {
            throw new Error(result.error);
          }

          set((state) => ({
            currentSession:
              state.currentSession?.id === sessionId
                ? result.data
                : state.currentSession,
            userSessions: state.userSessions.map((session) =>
              session.id === sessionId ? result.data : session
            ),
            isLoading: false,
          }));
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to update session',
            isLoading: false,
          });
          throw error;
        }
      },

      deleteSession: async (sessionId) => {
        set({ isLoading: true, error: null });
        try {
          const result = await deleteSessionAction(sessionId);

          if (!result.success) {
            throw new Error(result.error);
          }

          set((state) => ({
            userSessions: state.userSessions.filter(
              (session) => session.id !== sessionId
            ),
            currentSession:
              state.currentSession?.id === sessionId
                ? null
                : state.currentSession,
            isLoading: false,
          }));
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to delete session',
            isLoading: false,
          });
          throw error;
        }
      },

      // Data fetching (still via API routes)
      fetchUserSessions: async (_userId, filter = 'all') => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`/api/sessions?filter=${filter}`);

          if (!response.ok) {
            throw new Error('Failed to fetch sessions');
          }

          const { sessions } = await response.json();
          set({ userSessions: sessions, isLoading: false });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to fetch sessions',
            isLoading: false,
          });
          throw error;
        }
      },

      fetchSession: async (sessionId) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`/api/sessions/${sessionId}`);

          if (!response.ok) {
            throw new Error('Failed to fetch session');
          }

          const { session } = await response.json();
          set({ currentSession: session, isLoading: false });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to fetch session',
            isLoading: false,
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
