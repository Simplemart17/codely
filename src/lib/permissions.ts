import type { ParticipantRole, UserRole } from '@/types';

// Define available permissions
export enum Permission {
  // Editor permissions
  EDIT_CODE = 'edit_code',
  VIEW_CODE = 'view_code',
  EXECUTE_CODE = 'execute_code',
  
  // Session management
  MANAGE_SESSION = 'manage_session',
  INVITE_PARTICIPANTS = 'invite_participants',
  REMOVE_PARTICIPANTS = 'remove_participants',
  CHANGE_SESSION_STATUS = 'change_session_status',
  
  // Recording and snapshots
  CREATE_RECORDING = 'create_recording',
  MANAGE_RECORDINGS = 'manage_recordings',
  CREATE_SNAPSHOT = 'create_snapshot',
  RESTORE_SNAPSHOT = 'restore_snapshot',
  
  // Moderation
  MUTE_PARTICIPANT = 'mute_participant',
  KICK_PARTICIPANT = 'kick_participant',
  MODERATE_CHAT = 'moderate_chat',
  
  // Analytics
  VIEW_ANALYTICS = 'view_analytics',
  EXPORT_DATA = 'export_data',
}

// Role-based permission mapping
const ROLE_PERMISSIONS: Record<ParticipantRole, Permission[]> = {
  INSTRUCTOR: [
    // Full access to everything
    Permission.EDIT_CODE,
    Permission.VIEW_CODE,
    Permission.EXECUTE_CODE,
    Permission.MANAGE_SESSION,
    Permission.INVITE_PARTICIPANTS,
    Permission.REMOVE_PARTICIPANTS,
    Permission.CHANGE_SESSION_STATUS,
    Permission.CREATE_RECORDING,
    Permission.MANAGE_RECORDINGS,
    Permission.CREATE_SNAPSHOT,
    Permission.RESTORE_SNAPSHOT,
    Permission.MUTE_PARTICIPANT,
    Permission.KICK_PARTICIPANT,
    Permission.MODERATE_CHAT,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA,
  ],
  LEARNER: [
    // Limited editing and viewing permissions
    Permission.EDIT_CODE,
    Permission.VIEW_CODE,
    Permission.EXECUTE_CODE,
    Permission.CREATE_SNAPSHOT, // Can create personal snapshots
  ],
  OBSERVER: [
    // Read-only access
    Permission.VIEW_CODE,
  ],
};

// User role permissions (for session creation, etc.)
const USER_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  INSTRUCTOR: [
    Permission.MANAGE_SESSION,
    Permission.CREATE_RECORDING,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA,
  ],
  LEARNER: [],
};

/**
 * Check if a participant role has a specific permission
 */
export function hasPermission(
  role: ParticipantRole,
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a user role has a specific permission
 */
export function hasUserPermission(
  role: UserRole,
  permission: Permission
): boolean {
  return USER_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Get all permissions for a participant role
 */
export function getRolePermissions(role: ParticipantRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Get all permissions for a user role
 */
export function getUserRolePermissions(role: UserRole): Permission[] {
  return USER_ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Check if a role can edit code
 */
export function canEditCode(role: ParticipantRole): boolean {
  return hasPermission(role, Permission.EDIT_CODE);
}

/**
 * Check if a role can manage the session
 */
export function canManageSession(role: ParticipantRole): boolean {
  return hasPermission(role, Permission.MANAGE_SESSION);
}

/**
 * Check if a role can moderate participants
 */
export function canModerateParticipants(role: ParticipantRole): boolean {
  return hasPermission(role, Permission.MUTE_PARTICIPANT) ||
         hasPermission(role, Permission.KICK_PARTICIPANT);
}

/**
 * Check if a role can create recordings
 */
export function canCreateRecording(role: ParticipantRole): boolean {
  return hasPermission(role, Permission.CREATE_RECORDING);
}

/**
 * Check if a role can create snapshots
 */
export function canCreateSnapshot(role: ParticipantRole): boolean {
  return hasPermission(role, Permission.CREATE_SNAPSHOT);
}

/**
 * Check if a role can restore snapshots
 */
export function canRestoreSnapshot(role: ParticipantRole): boolean {
  return hasPermission(role, Permission.RESTORE_SNAPSHOT);
}

/**
 * Check if a role can view analytics
 */
export function canViewAnalytics(role: ParticipantRole): boolean {
  return hasPermission(role, Permission.VIEW_ANALYTICS);
}

/**
 * Permission context for components
 */
export interface PermissionContext {
  userRole: UserRole;
  participantRole?: ParticipantRole;
  isSessionOwner: boolean;
}

/**
 * Enhanced permission check with context
 */
export function hasPermissionInContext(
  permission: Permission,
  context: PermissionContext
): boolean {
  // Session owner always has full permissions
  if (context.isSessionOwner) {
    return true;
  }

  // Check participant role permissions
  if (context.participantRole) {
    return hasPermission(context.participantRole, permission);
  }

  // Check user role permissions
  return hasUserPermission(context.userRole, permission);
}

/**
 * Get permission level description
 */
export function getPermissionDescription(permission: Permission): string {
  const descriptions: Record<Permission, string> = {
    [Permission.EDIT_CODE]: 'Edit and modify code in the session',
    [Permission.VIEW_CODE]: 'View code in the session',
    [Permission.EXECUTE_CODE]: 'Run and execute code',
    [Permission.MANAGE_SESSION]: 'Manage session settings and status',
    [Permission.INVITE_PARTICIPANTS]: 'Invite new participants to the session',
    [Permission.REMOVE_PARTICIPANTS]: 'Remove participants from the session',
    [Permission.CHANGE_SESSION_STATUS]: 'Change session status (active, paused, ended)',
    [Permission.CREATE_RECORDING]: 'Create and start session recordings',
    [Permission.MANAGE_RECORDINGS]: 'Manage existing recordings',
    [Permission.CREATE_SNAPSHOT]: 'Create code snapshots',
    [Permission.RESTORE_SNAPSHOT]: 'Restore code from snapshots',
    [Permission.MUTE_PARTICIPANT]: 'Mute participants in the session',
    [Permission.KICK_PARTICIPANT]: 'Remove participants from the session',
    [Permission.MODERATE_CHAT]: 'Moderate chat and communications',
    [Permission.VIEW_ANALYTICS]: 'View session analytics and metrics',
    [Permission.EXPORT_DATA]: 'Export session data and reports',
  };

  return descriptions[permission] ?? 'Unknown permission';
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: ParticipantRole): string {
  const displayNames: Record<ParticipantRole, string> = {
    INSTRUCTOR: 'Instructor',
    LEARNER: 'Learner',
    OBSERVER: 'Observer',
  };

  return displayNames[role] ?? role;
}

/**
 * Get role color for UI display
 */
export function getRoleColor(role: ParticipantRole): string {
  const colors: Record<ParticipantRole, string> = {
    INSTRUCTOR: 'bg-blue-100 text-blue-800',
    LEARNER: 'bg-green-100 text-green-800',
    OBSERVER: 'bg-gray-100 text-gray-800',
  };

  return colors[role] ?? 'bg-gray-100 text-gray-800';
}
