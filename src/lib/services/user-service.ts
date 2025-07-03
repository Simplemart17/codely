import { prisma } from '@/lib/prisma';
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
 * User service for database operations
 */
export class UserService {
  /**
   * Create a new user in the database
   */
  static async createUser(data: CreateUserData): Promise<User> {
    const defaultPreferences: UserPreferences = {
      theme: 'light',
      fontSize: 14,
      keyBindings: 'vscode',
    };

    const user = await prisma.user.create({
      data: {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        avatar: data.avatar,
        preferences: {
          ...defaultPreferences,
          ...data.preferences,
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      avatar: user.avatar || undefined,
      preferences: user.preferences as UserPreferences,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      avatar: user.avatar || undefined,
      preferences: user.preferences as UserPreferences,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      avatar: user.avatar || undefined,
      preferences: user.preferences as UserPreferences,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Update user data
   */
  static async updateUser(id: string, data: UpdateUserData): Promise<User> {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.preferences !== undefined) {
      // Merge with existing preferences
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { preferences: true },
      });

      updateData.preferences = {
        ...(existingUser?.preferences as UserPreferences || {}),
        ...data.preferences,
      };
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      avatar: user.avatar || undefined,
      preferences: user.preferences as UserPreferences,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Check if user exists
   */
  static async userExists(id: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    return !!user;
  }

  /**
   * Delete user (soft delete by updating status if needed)
   */
  static async deleteUser(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Get user statistics
   */
  static async getUserStats(id: string) {
    const [sessionsCreated, sessionsParticipated] = await Promise.all([
      prisma.session.count({
        where: { instructorId: id },
      }),
      prisma.sessionParticipant.count({
        where: { userId: id },
      }),
    ]);

    return {
      sessionsCreated,
      sessionsParticipated,
    };
  }

  /**
   * Create or update user (upsert operation)
   * Useful for handling OAuth logins where user might already exist
   */
  static async upsertUser(data: CreateUserData): Promise<User> {
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
  }
}
