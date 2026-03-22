import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { User, UserPreferences } from '@/types';
import { toDate } from '@/lib/utils';
import { updateUser as updateUserAction } from '@/lib/actions/user-actions';

function hydrateUser(u: Record<string, unknown>): User {
  return {
    ...u,
    createdAt: toDate(u.createdAt),
    updatedAt: toDate(u.updatedAt),
  } as User;
}

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
          // Prevent concurrent loads but allow re-auth attempts
          // after a brief delay
          if (get().isLoading) return;

          set({ isLoading: true, error: null });
          try {
            const response = await fetch('/api/users');

            if (response.ok) {
              const data = await response.json();
              set({
                user: hydrateUser(data.user),
                isAuthenticated: true,
                isLoading: false,
              });
            } else if (
              response.status === 401 ||
              response.status === 404
            ) {
              set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
              });
            } else {
              throw new Error('Failed to load user');
            }
          } catch (error) {
            // On network error, keep existing user from persisted store
            const currentUser = get().user;
            set({
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load user',
              isLoading: false,
              user: currentUser,
              isAuthenticated: !!currentUser,
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
              user: hydrateUser(
                result.data as unknown as Record<string, unknown>
              ),
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
              user: hydrateUser(
                result.data as unknown as Record<string, unknown>
              ),
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
        onRehydrateStorage: () => (state) => {
          if (state?.user) {
            state.user = hydrateUser(
              state.user as unknown as Record<string, unknown>
            );
          }
        },
      }
    ),
    {
      name: 'user-store',
    }
  )
);
