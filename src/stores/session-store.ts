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
          // TODO: Replace with actual API call
          const newSession: Session = {
            id: `session_${Date.now()}`,
            ...sessionData,
            code: '',
            status: 'ACTIVE',
            participants: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
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
          // TODO: Replace with actual API call
          const participant: SessionParticipant = {
            id: `participant_${Date.now()}`,
            userId,
            sessionId,
            role: 'LEARNER',
            joinedAt: new Date(),
            isActive: true,
            cursorPosition: null,
          };
          
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
          // TODO: Replace with actual API call
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
          // TODO: Replace with actual API call
          set((state) => ({
            currentSession: state.currentSession?.id === sessionId 
              ? { ...state.currentSession, ...updates, updatedAt: new Date() }
              : state.currentSession,
            userSessions: state.userSessions.map(session =>
              session.id === sessionId 
                ? { ...session, ...updates, updatedAt: new Date() }
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
          // TODO: Replace with actual API call
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
      fetchUserSessions: async (userId) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Replace with actual API call
          // For now, return mock data
          const mockSessions: Session[] = [
            {
              id: 'session_1',
              title: 'JavaScript Basics',
              description: 'Learning JavaScript fundamentals',
              instructorId: userId,
              language: 'JAVASCRIPT',
              status: 'ACTIVE',
              maxParticipants: 10,
              isPublic: true,
              code: '// Welcome to JavaScript basics\nconsole.log("Hello, World!");',
              participants: [],
              createdAt: new Date(Date.now() - 86400000), // 1 day ago
              updatedAt: new Date(),
            },
          ];
          
          set({ userSessions: mockSessions, isLoading: false });
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
          // TODO: Replace with actual API call
          const mockSession: Session = {
            id: sessionId,
            title: 'Sample Session',
            description: 'A sample coding session',
            instructorId: 'user_1',
            language: 'JAVASCRIPT',
            status: 'ACTIVE',
            maxParticipants: 10,
            isPublic: true,
            code: '// Sample code\nconsole.log("Hello from session!");',
            participants: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          set({ currentSession: mockSession, isLoading: false });
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
