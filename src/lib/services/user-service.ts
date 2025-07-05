import { SupabaseDatabase, type DatabaseUser } from '@/lib/supabase/database';
import type { User, UserRole, UserPreferences } from '@/types';

export interface CreateUserData {
  id: string; // Supabase user ID
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  preferences?: Partial<UserPreferences>;
}

export interface UpdateUserData {
  name?: string;
  role?: UserRole;
  avatar?: string;
  preferences?: Partial<UserPreferences>;
}

/**
 * User service for database operations using Supabase
 */
export class UserService {
  /**
   * Create a new user in the database
   */
  static async createUser(data: CreateUserData): Promise<User> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();
      
      const defaultPreferences: UserPreferences = {
        theme: 'light',
        fontSize: 14,
        keyBindings: 'vscode',
      };

      const { data: user, error } = await supabase
        .from('users')
        .insert({
          id: data.id,
          email: data.email,
          name: data.name,
          role: data.role,
          avatar: data.avatar,
          preferences: {
            ...defaultPreferences,
            ...data.preferences,
          },
        })
        .select()
        .single();

      if (error) {
        SupabaseDatabase.handleError(error);
      }

      return SupabaseDatabase.transformUser(user as DatabaseUser);
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string): Promise<User | null> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();
      
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // User not found
        }
        SupabaseDatabase.handleError(error);
      }

      return user ? SupabaseDatabase.transformUser(user as DatabaseUser) : null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw new Error('Failed to get user');
    }
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();
      
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // User not found
        }
        SupabaseDatabase.handleError(error);
      }

      return user ? SupabaseDatabase.transformUser(user as DatabaseUser) : null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw new Error('Failed to get user');
    }
  }

  /**
   * Update user data
   */
  static async updateUser(id: string, data: UpdateUserData): Promise<User> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();
      
      const updateData: Record<string, unknown> = {};

      if (data.name !== undefined) updateData.name = data.name;
      if (data.role !== undefined) updateData.role = data.role;
      if (data.avatar !== undefined) updateData.avatar = data.avatar;
      
      if (data.preferences !== undefined) {
        // Get existing preferences to merge
        const { data: existingUser } = await supabase
          .from('users')
          .select('preferences')
          .eq('id', id)
          .single();

        updateData.preferences = {
          ...(existingUser?.preferences || {}),
          ...data.preferences,
        };
      }

      const { data: user, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        SupabaseDatabase.handleError(error);
      }

      return SupabaseDatabase.transformUser(user as DatabaseUser);
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  /**
   * Check if user exists
   */
  static async userExists(id: string): Promise<boolean> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();
      
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        SupabaseDatabase.handleError(error);
      }

      return !!data;
    } catch (error) {
      console.error('Error checking if user exists:', error);
      return false;
    }
  }

  /**
   * Delete user
   */
  static async deleteUser(id: string): Promise<void> {
    try {
      const supabase = await SupabaseDatabase.getServerClient();
      
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        SupabaseDatabase.handleError(error);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(id: string) {
    try {
      const supabase = await SupabaseDatabase.getServerClient();
      
      const [sessionsCreatedResult, sessionsParticipatedResult] = await Promise.all([
        supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .eq('instructor_id', id),
        supabase
          .from('session_participants')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', id),
      ]);

      return {
        sessionsCreated: sessionsCreatedResult.count || 0,
        sessionsParticipated: sessionsParticipatedResult.count || 0,
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw new Error('Failed to get user statistics');
    }
  }

  /**
   * Create or update user (upsert operation)
   * Useful for handling OAuth logins where user might already exist
   */
  static async upsertUser(data: CreateUserData): Promise<User> {
    try {
      const existingUser = await this.getUserById(data.id);

      if (existingUser) {
        // Update existing user with new data
        return this.updateUser(data.id, {
          name: data.name,
          avatar: data.avatar,
          preferences: data.preferences,
        });
      } else {
        // Create new user
        return this.createUser(data);
      }
    } catch (error) {
      console.error('Error upserting user:', error);
      throw new Error('Failed to create or update user');
    }
  }
}
