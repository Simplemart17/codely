import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Session, SessionParticipant } from '@/types';
import { toDate } from '@/lib/utils';
import { useUserStore } from './user-store';
import {
  createSession as createSessionAction,
  joinSession as joinSessionAction,
  leaveSession as leaveSessionAction,
  updateSession as updateSessionAction,
  deleteSession as deleteSessionAction,
} from '@/lib/actions/session-actions';

function hydrateSession(s: Record<string, unknown>): Session {
  return {
    ...s,
    createdAt: toDate(s.createdAt),
    updatedAt: toDate(s.updatedAt),
  } as Session;
}

function hydrateParticipant(
  p: Record<string, unknown>
): SessionParticipant {
  return {
    ...p,
    joinedAt: toDate(p.joinedAt),
    leftAt: p.leftAt ? toDate(p.leftAt) : undefined,
  } as SessionParticipant;
}

/**
 * Handle 401 responses by attempting to re-authenticate.
 * Only logs out if re-authentication also fails.
 * Returns true if the response was a 401.
 */
async function handleAuthError(response: Response): Promise<boolean> {
  if (response.status === 401) {
    // Don't immediately logout — try to re-verify auth first.
    // The token may have been refreshed by middleware but the
    // API call used stale cookies.
    try {
      await useUserStore.getState().loadUser();
      // If loadUser succeeded, the user is still authenticated.
      // The original request failed but the session is valid.
      return true;
    } catch {
      // Re-auth also failed — truly unauthenticated
      useUserStore.getState().logout();
      return true;
    }
  }
  return false;
}

interface SessionState {
  // Current session data
  currentSession: Session | null;
  participants: SessionParticipant[];
  isLoading: boolean;
  isFetching: boolean;
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
      isFetching: false,
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

          const session = hydrateSession(
            result.data as unknown as Record<string, unknown>
          );
          set((state) => ({
            userSessions: [...state.userSessions, session],
            isLoading: false,
          }));

          return session;
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

          const participant = hydrateParticipant(
            result.data as unknown as Record<string, unknown>
          );
          get().addParticipant(participant);
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

          const updated = hydrateSession(
            result.data as unknown as Record<string, unknown>
          );
          set((state) => ({
            currentSession:
              state.currentSession?.id === sessionId
                ? updated
                : state.currentSession,
            userSessions: state.userSessions.map((session) =>
              session.id === sessionId ? updated : session
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

      // Data fetching (via API routes) — uses isFetching to avoid
      // conflicts with mutation isLoading
      fetchUserSessions: async (_userId, filter = 'all') => {
        set({ isFetching: true, error: null });
        try {
          const response = await fetch(`/api/sessions?filter=${filter}`);

          if (await handleAuthError(response)) return;

          if (!response.ok) {
            throw new Error('Failed to fetch sessions');
          }

          const { sessions } = await response.json();
          const hydrated = (sessions as Record<string, unknown>[]).map(
            hydrateSession
          );
          set({ userSessions: hydrated, isFetching: false });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to fetch sessions',
            isFetching: false,
          });
        }
      },

      fetchSession: async (sessionId) => {
        set({ isFetching: true, error: null });
        try {
          const response = await fetch(`/api/sessions/${sessionId}`);

          if (await handleAuthError(response)) return;

          if (!response.ok) {
            throw new Error('Failed to fetch session');
          }

          const { session, participants } = await response.json();
          const hydratedParticipants = Array.isArray(participants)
            ? (participants as Record<string, unknown>[]).map(
                hydrateParticipant
              )
            : [];
          set({
            currentSession: hydrateSession(session),
            participants: hydratedParticipants,
            isFetching: false,
          });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to fetch session',
            isFetching: false,
          });
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
