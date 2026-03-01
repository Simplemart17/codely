import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { User, UserPreferences } from '@/types';
import { updateUser as updateUserAction } from '@/lib/actions/user-actions';

interface UserState {
  // User data
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // User actions
  setUser: (user: User | null) => void;
  loadUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  logout: () => void;

  // UI state
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        // User actions
        setUser: (user) =>
          set({
            user,
            isAuthenticated: !!user,
            error: null,
          }),

        // loadUser still uses API route (GET /api/users)
        loadUser: async () => {
          set({ isLoading: true, error: null });
          try {
            const response = await fetch('/api/users');

            if (response.ok) {
              const { user } = await response.json();
              set({
                user,
                isAuthenticated: true,
                isLoading: false,
              });
            } else if (response.status === 404) {
              set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
              });
            } else {
              throw new Error('Failed to load user');
            }
          } catch (error) {
            set({
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load user',
              isLoading: false,
              user: null,
              isAuthenticated: false,
            });
          }
        },

        // updateUser uses Server Action
        updateUser: async (updates) => {
          const currentUser = get().user;
          if (!currentUser) {
            throw new Error('No user to update');
          }

          set({ isLoading: true, error: null });
          try {
            const result = await updateUserAction({
              name: updates.name,
              role: updates.role,
              avatar: updates.avatar,
            });

            if (!result.success) {
              throw new Error(result.error);
            }

            set({
              user: result.data,
              isLoading: false,
            });
          } catch (error) {
            set({
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to update user',
              isLoading: false,
            });
            throw error;
          }
        },

        // updatePreferences uses Server Action
        updatePreferences: async (preferences) => {
          const currentUser = get().user;
          if (!currentUser) {
            throw new Error('No user to update preferences for');
          }

          set({ isLoading: true, error: null });
          try {
            const result = await updateUserAction({ preferences });

            if (!result.success) {
              throw new Error(result.error);
            }

            set({
              user: result.data,
              isLoading: false,
            });
          } catch (error) {
            set({
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to update preferences',
              isLoading: false,
            });
            throw error;
          }
        },

        logout: () => {
          set({
            user: null,
            isAuthenticated: false,
            error: null,
          });
          localStorage.removeItem('user-store');
        },

        // UI state management
        setLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),
        clearError: () => set({ error: null }),
      }),
      {
        name: 'user-store',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    {
      name: 'user-store',
    }
  )
);
