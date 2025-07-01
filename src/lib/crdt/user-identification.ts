/**
 * User Identification and Color Coding System
 * 
 * This module handles user identification, color assignment, and visual
 * representation for collaborative editing sessions.
 */

import { CollaborativeUser } from './document';

/**
 * User role types
 */
export enum UserRole {
  INSTRUCTOR = 'instructor',
  STUDENT = 'student',
  OBSERVER = 'observer',
  ADMIN = 'admin'
}

/**
 * User status types
 */
export enum UserStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline'
}

/**
 * Extended user information
 */
export interface ExtendedUser extends CollaborativeUser {
  role: UserRole;
  status: UserStatus;
  joinedAt: number;
  lastActivity: number;
  permissions: UserPermissions;
  metadata?: Record<string, unknown>;
}

/**
 * User permissions
 */
export interface UserPermissions {
  canEdit: boolean;
  canComment: boolean;
  canShare: boolean;
  canManageUsers: boolean;
  canExecuteCode: boolean;
  canChangeSettings: boolean;
}

/**
 * Color palette for user identification
 */
export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

/**
 * User identification configuration
 */
export interface UserIdentificationConfig {
  colorPalettes: ColorPalette[];
  defaultRole: UserRole;
  defaultPermissions: UserPermissions;
  maxUsersPerSession: number;
  enableAvatars: boolean;
  enableStatusIndicators: boolean;
}

/**
 * User Manager class for handling user identification and management
 */
export class UserManager {
  private users: Map<string, ExtendedUser> = new Map();
  private colorAssignments: Map<string, ColorPalette> = new Map();
  private config: UserIdentificationConfig;
  private usedColors: Set<number> = new Set();

  constructor(config: UserIdentificationConfig) {
    this.config = config;
  }

  /**
   * Add or update user
   */
  addUser(user: Partial<ExtendedUser> & { id: string; name: string }): ExtendedUser {
    const existingUser = this.users.get(user.id);
    
    const extendedUser: ExtendedUser = {
      id: user.id,
      name: user.name,
      color: user.color || this.assignUserColor(user.id),
      avatar: user.avatar,
      role: user.role || this.config.defaultRole,
      status: user.status || UserStatus.ONLINE,
      joinedAt: existingUser?.joinedAt || Date.now(),
      lastActivity: Date.now(),
      permissions: user.permissions || { ...this.config.defaultPermissions },
      metadata: user.metadata || {}
    };

    this.users.set(user.id, extendedUser);
    
    // Assign color palette if not already assigned
    if (!this.colorAssignments.has(user.id)) {
      const palette = this.generateColorPalette(extendedUser.color);
      this.colorAssignments.set(user.id, palette);
    }

    return extendedUser;
  }

  /**
   * Remove user
   */
  removeUser(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    this.users.delete(userId);
    this.colorAssignments.delete(userId);
    
    // Free up color for reuse
    const colorIndex = this.getColorIndex(user.color);
    if (colorIndex !== -1) {
      this.usedColors.delete(colorIndex);
    }

    return true;
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): ExtendedUser | null {
    return this.users.get(userId) || null;
  }

  /**
   * Get all users
   */
  getAllUsers(): ExtendedUser[] {
    return Array.from(this.users.values());
  }

  /**
   * Get users by role
   */
  getUsersByRole(role: UserRole): ExtendedUser[] {
    return this.getAllUsers().filter(user => user.role === role);
  }

  /**
   * Get online users
   */
  getOnlineUsers(): ExtendedUser[] {
    return this.getAllUsers().filter(user => user.status === UserStatus.ONLINE);
  }

  /**
   * Update user status
   */
  updateUserStatus(userId: string, status: UserStatus): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    user.status = status;
    user.lastActivity = Date.now();
    return true;
  }

  /**
   * Update user activity
   */
  updateUserActivity(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    user.lastActivity = Date.now();
    return true;
  }

  /**
   * Update user permissions
   */
  updateUserPermissions(userId: string, permissions: Partial<UserPermissions>): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    user.permissions = { ...user.permissions, ...permissions };
    return true;
  }

  /**
   * Get user color palette
   */
  getUserColorPalette(userId: string): ColorPalette | null {
    return this.colorAssignments.get(userId) || null;
  }

  /**
   * Check if user has permission
   */
  hasPermission(userId: string, permission: keyof UserPermissions): boolean {
    const user = this.users.get(userId);
    return user ? user.permissions[permission] : false;
  }

  /**
   * Get user count
   */
  getUserCount(): number {
    return this.users.size;
  }

  /**
   * Check if session is at capacity
   */
  isAtCapacity(): boolean {
    return this.users.size >= this.config.maxUsersPerSession;
  }

  /**
   * Assign unique color to user
   */
  private assignUserColor(userId: string): string {
    const predefinedColors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#AED6F1', '#F1948A', '#D7BDE2',
      '#A9DFBF', '#F9E79F', '#FAD7A0', '#D5A6BD', '#A3E4D7'
    ];

    // Find first unused color
    for (let i = 0; i < predefinedColors.length; i++) {
      if (!this.usedColors.has(i)) {
        this.usedColors.add(i);
        return predefinedColors[i];
      }
    }

    // If all predefined colors are used, generate a unique color
    return this.generateUniqueColor(userId);
  }

  /**
   * Generate unique color based on user ID
   */
  private generateUniqueColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Generate HSL color for better distribution
    const hue = Math.abs(hash) % 360;
    const saturation = 60 + (Math.abs(hash) % 30); // 60-90%
    const lightness = 45 + (Math.abs(hash) % 20); // 45-65%

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  /**
   * Get color index from predefined colors
   */
  private getColorIndex(color: string): number {
    const predefinedColors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#AED6F1', '#F1948A', '#D7BDE2',
      '#A9DFBF', '#F9E79F', '#FAD7A0', '#D5A6BD', '#A3E4D7'
    ];

    return predefinedColors.indexOf(color);
  }

  /**
   * Generate color palette from primary color
   */
  private generateColorPalette(primaryColor: string): ColorPalette {
    // Convert hex to HSL for manipulation
    const hsl = this.hexToHsl(primaryColor);
    
    return {
      primary: primaryColor,
      secondary: this.hslToHex(hsl.h, Math.max(0, hsl.s - 20), Math.min(100, hsl.l + 20)),
      accent: this.hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l),
      background: this.hslToHex(hsl.h, Math.max(0, hsl.s - 40), Math.min(100, hsl.l + 40)),
      text: hsl.l > 50 ? '#2C3E50' : '#FFFFFF'
    };
  }

  /**
   * Convert hex color to HSL
   */
  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    // Remove # if present
    hex = hex.replace('#', '');
    
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  /**
   * Convert HSL to hex color
   */
  private hslToHex(h: number, s: number, l: number): string {
    h /= 360;
    s /= 100;
    l /= 100;

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    const toHex = (c: number) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Clear all users
   */
  clearAllUsers(): void {
    this.users.clear();
    this.colorAssignments.clear();
    this.usedColors.clear();
  }
}

/**
 * Default user identification configuration
 */
export const defaultUserIdentificationConfig: UserIdentificationConfig = {
  colorPalettes: [],
  defaultRole: UserRole.STUDENT,
  defaultPermissions: {
    canEdit: true,
    canComment: true,
    canShare: false,
    canManageUsers: false,
    canExecuteCode: true,
    canChangeSettings: false
  },
  maxUsersPerSession: 50,
  enableAvatars: true,
  enableStatusIndicators: true
};

/**
 * Create user manager with configuration
 */
export function createUserManager(
  config?: Partial<UserIdentificationConfig>
): UserManager {
  const finalConfig = { ...defaultUserIdentificationConfig, ...config };
  return new UserManager(finalConfig);
}

/**
 * Generate avatar URL from user name
 */
export function generateAvatarUrl(name: string, size: number = 40): string {
  const initials = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2);
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=${size}&background=random&color=fff&bold=true`;
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case UserRole.INSTRUCTOR:
      return 'Instructor';
    case UserRole.STUDENT:
      return 'Student';
    case UserRole.OBSERVER:
      return 'Observer';
    case UserRole.ADMIN:
      return 'Admin';
    default:
      return 'User';
  }
}

/**
 * Get status display name
 */
export function getStatusDisplayName(status: UserStatus): string {
  switch (status) {
    case UserStatus.ONLINE:
      return 'Online';
    case UserStatus.AWAY:
      return 'Away';
    case UserStatus.BUSY:
      return 'Busy';
    case UserStatus.OFFLINE:
      return 'Offline';
    default:
      return 'Unknown';
  }
}

/**
 * Get status color
 */
export function getStatusColor(status: UserStatus): string {
  switch (status) {
    case UserStatus.ONLINE:
      return '#4CAF50';
    case UserStatus.AWAY:
      return '#FF9800';
    case UserStatus.BUSY:
      return '#F44336';
    case UserStatus.OFFLINE:
      return '#9E9E9E';
    default:
      return '#9E9E9E';
  }
}
