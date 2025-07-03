import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { User, UserPreferences } from '@/types';

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
        setUser: (user) => set({
          user,
          isAuthenticated: !!user,
          error: null
        }),

        loadUser: async () => {
          set({ isLoading: true, error: null });
          try {
            // Call API to get current user from database
            const response = await fetch('/api/users');

            if (response.ok) {
              const { user } = await response.json();
              set({
                user,
                isAuthenticated: true,
                isLoading: false
              });
            } else if (response.status === 404) {
              // User not found in database, clear state
              set({
                user: null,
                isAuthenticated: false,
                isLoading: false
              });
            } else {
              throw new Error('Failed to load user');
            }
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to load user',
              isLoading: false,
              user: null,
              isAuthenticated: false
            });
          }
        },

        updateUser: async (updates) => {
          const currentUser = get().user;
          if (!currentUser) {
            throw new Error('No user to update');
          }

          set({ isLoading: true, error: null });
          try {
            // Call API to update user in database
            const response = await fetch('/api/users', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(updates),
            });

            if (!response.ok) {
              throw new Error('Failed to update user');
            }

            const { user: updatedUser } = await response.json();

            set({
              user: updatedUser,
              isLoading: false
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to update user',
              isLoading: false
            });
            throw error;
          }
        },

        updatePreferences: async (preferences) => {
          const currentUser = get().user;
          if (!currentUser) {
            throw new Error('No user to update preferences for');
          }

          set({ isLoading: true, error: null });
          try {
            // Call API to update user preferences in database
            const response = await fetch('/api/users', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ preferences }),
            });

            if (!response.ok) {
              throw new Error('Failed to update preferences');
            }

            const { user: updatedUser } = await response.json();

            set({
              user: updatedUser,
              isLoading: false
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to update preferences',
              isLoading: false
            });
            throw error;
          }
        },

        logout: () => set({ 
          user: null, 
          isAuthenticated: false,
          error: null 
        }),

        // UI state management
        setLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),
        clearError: () => set({ error: null }),
      }),
      {
        name: 'user-store',
        partialize: (state) => ({ 
          user: state.user,
          isAuthenticated: state.isAuthenticated 
        }),
      }
    ),
    {
      name: 'user-store',
    }
  )
);
