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

        updateUser: async (updates) => {
          const currentUser = get().user;
          if (!currentUser) {
            throw new Error('No user to update');
          }

          set({ isLoading: true, error: null });
          try {
            // TODO: Replace with actual API call
            const updatedUser: User = {
              ...currentUser,
              ...updates,
              updatedAt: new Date(),
            };
            
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
            // TODO: Replace with actual API call
            const updatedPreferences: UserPreferences = {
              ...currentUser.preferences,
              ...preferences,
            };

            const updatedUser: User = {
              ...currentUser,
              preferences: updatedPreferences,
              updatedAt: new Date(),
            };
            
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
