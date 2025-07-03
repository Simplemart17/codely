'use client';

import React, { createContext, useContext, useMemo } from 'react';
import {
  Permission,
  hasPermissionInContext,
  getRolePermissions,
  canEditCode,
  canManageSession,
  canModerateParticipants,
  canCreateRecording,
  canCreateSnapshot,
  canRestoreSnapshot,
  canViewAnalytics
} from '@/lib/permissions';
import type { PermissionContext } from '@/lib/permissions';
import type { UserRole, ParticipantRole } from '@/types';

interface PermissionProviderProps {
  children: React.ReactNode;
  userRole: UserRole;
  participantRole?: ParticipantRole;
  isSessionOwner: boolean;
}

interface PermissionHookReturn {
  // Permission context
  context: PermissionContext;
  
  // General permission check
  hasPermission: (permission: Permission) => boolean;
  
  // Specific permission checks
  canEdit: boolean;
  canManage: boolean;
  canModerate: boolean;
  canRecord: boolean;
  canSnapshot: boolean;
  canRestore: boolean;
  canAnalyze: boolean;
  
  // Role information
  userRole: UserRole;
  participantRole?: ParticipantRole;
  isOwner: boolean;
  permissions: Permission[];
}

const PermissionContext = createContext<PermissionHookReturn | null>(null);

export function PermissionProvider({ 
  children, 
  userRole, 
  participantRole, 
  isSessionOwner 
}: PermissionProviderProps) {
  const value = useMemo<PermissionHookReturn>(() => {
    const context: PermissionContext = {
      userRole,
      participantRole,
      isSessionOwner,
    };

    const hasPermissionCheck = (permission: Permission) =>
      hasPermissionInContext(permission, context);

    return {
      context,
      hasPermission: hasPermissionCheck,
      
      // Specific permission checks
      canEdit: participantRole ? canEditCode(participantRole) : false,
      canManage: participantRole ? canManageSession(participantRole) : false,
      canModerate: participantRole ? canModerateParticipants(participantRole) : false,
      canRecord: participantRole ? canCreateRecording(participantRole) : false,
      canSnapshot: participantRole ? canCreateSnapshot(participantRole) : false,
      canRestore: participantRole ? canRestoreSnapshot(participantRole) : false,
      canAnalyze: participantRole ? canViewAnalytics(participantRole) : false,
      
      // Role information
      userRole,
      participantRole,
      isOwner: isSessionOwner,
      permissions: participantRole ? getRolePermissions(participantRole) : [],
    };
  }, [userRole, participantRole, isSessionOwner]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions(): PermissionHookReturn {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}

// Convenience hooks for specific permissions
export function useCanEdit(): boolean {
  const { canEdit } = usePermissions();
  return canEdit;
}

export function useCanManage(): boolean {
  const { canManage } = usePermissions();
  return canManage;
}

export function useCanModerate(): boolean {
  const { canModerate } = usePermissions();
  return canModerate;
}

export function useCanRecord(): boolean {
  const { canRecord } = usePermissions();
  return canRecord;
}

export function useCanSnapshot(): boolean {
  const { canSnapshot } = usePermissions();
  return canSnapshot;
}

export function useCanRestore(): boolean {
  const { canRestore } = usePermissions();
  return canRestore;
}

export function useCanAnalyze(): boolean {
  const { canAnalyze } = usePermissions();
  return canAnalyze;
}

// Higher-order component for permission-based rendering
interface WithPermissionProps {
  permission: Permission;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function WithPermission({ permission, fallback = null, children }: WithPermissionProps) {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

// Component for role-based rendering
interface WithRoleProps {
  roles: ParticipantRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function WithRole({ roles, fallback = null, children }: WithRoleProps) {
  const { participantRole } = usePermissions();
  
  if (!participantRole || !roles.includes(participantRole)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

// Component for owner-only rendering
interface WithOwnerProps {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function WithOwner({ fallback = null, children }: WithOwnerProps) {
  const { isOwner } = usePermissions();
  
  if (!isOwner) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}
