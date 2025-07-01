'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Lock, 
  Unlock, 
  Eye, 
  Edit3, 
  Play, 
  AlertCircle,
  Shield,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions, WithPermission } from '@/hooks/use-permissions';
import { Permission, getRoleDisplayName, getRoleColor } from '@/lib/permissions';

interface PermissionAwareEditorProps {
  code: string;
  language: string;
  onChange?: (code: string) => void;
  onExecute?: () => void;
  isExecuting?: boolean;
  className?: string;
}

export function PermissionAwareEditor({
  code,
  language,
  onChange,
  onExecute,
  isExecuting = false,
  className,
}: PermissionAwareEditorProps) {
  const { 
    canEdit, 
    participantRole, 
    hasPermission,
    permissions 
  } = usePermissions();
  
  const [localCode, setLocalCode] = useState(code);
  const [showPermissionInfo, setShowPermissionInfo] = useState(false);

  useEffect(() => {
    setLocalCode(code);
  }, [code]);

  const handleCodeChange = (newCode: string) => {
    if (!canEdit) {
      return; // Silently ignore changes if user can't edit
    }
    
    setLocalCode(newCode);
    if (onChange) {
      onChange(newCode);
    }
  };

  const handleExecute = () => {
    if (hasPermission(Permission.EXECUTE_CODE) && onExecute) {
      onExecute();
    }
  };

  const canView = hasPermission(Permission.VIEW_CODE);

  if (!canView) {
    return (
      <Card className={cn('', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Lock className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Access Restricted
          </h3>
          <p className="text-gray-500 text-center">
            You don't have permission to view the code in this session.
          </p>
          {participantRole && (
            <Badge 
              className={cn('mt-3', getRoleColor(participantRole))}
              variant="outline"
            >
              {getRoleDisplayName(participantRole)}
            </Badge>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Permission Status Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {canEdit ? (
                  <Edit3 className="h-4 w-4 text-green-600" />
                ) : (
                  <Eye className="h-4 w-4 text-blue-600" />
                )}
                <span className="text-sm font-medium">
                  {canEdit ? 'Edit Mode' : 'View Only'}
                </span>
              </div>
              
              {participantRole && (
                <Badge 
                  className={cn('text-xs', getRoleColor(participantRole))}
                  variant="outline"
                >
                  {getRoleDisplayName(participantRole)}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowPermissionInfo(!showPermissionInfo)}
                className="h-8 w-8 p-0"
              >
                <Info className="h-4 w-4" />
              </Button>

              <WithPermission permission={Permission.EXECUTE_CODE}>
                <Button
                  size="sm"
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  {isExecuting ? 'Running...' : 'Run Code'}
                </Button>
              </WithPermission>
            </div>
          </div>

          {showPermissionInfo && (
            <div className="mt-3 pt-3 border-t">
              <PermissionInfo permissions={permissions} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Code Editor */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Code Editor</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {language.toUpperCase()}
              </Badge>
              {!canEdit && (
                <Badge variant="outline" className="text-xs text-orange-600">
                  <Lock className="h-3 w-3 mr-1" />
                  Read Only
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <textarea
              value={localCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              readOnly={!canEdit}
              className={cn(
                'w-full h-96 p-4 font-mono text-sm border rounded-lg resize-none',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                !canEdit && 'bg-gray-50 cursor-not-allowed'
              )}
              placeholder={canEdit ? 'Start coding...' : 'Code will appear here...'}
            />
            
            {!canEdit && (
              <div className="absolute inset-0 bg-gray-50 bg-opacity-50 flex items-center justify-center rounded-lg">
                <div className="bg-white p-4 rounded-lg shadow-sm border flex items-center gap-2">
                  <Lock className="h-5 w-5 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    Editing disabled for your role
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Permission Warnings */}
      {!canEdit && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-orange-800">Limited Access</h4>
                <p className="text-sm text-orange-700 mt-1">
                  Your current role ({participantRole && getRoleDisplayName(participantRole)}) 
                  has view-only access to the code editor. Contact the session instructor 
                  if you need editing permissions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface PermissionInfoProps {
  permissions: Permission[];
}

function PermissionInfo({ permissions }: PermissionInfoProps) {
  const permissionGroups = {
    'Editor': [
      Permission.VIEW_CODE,
      Permission.EDIT_CODE,
      Permission.EXECUTE_CODE,
    ],
    'Session Management': [
      Permission.MANAGE_SESSION,
      Permission.INVITE_PARTICIPANTS,
      Permission.REMOVE_PARTICIPANTS,
      Permission.CHANGE_SESSION_STATUS,
    ],
    'Recording & Snapshots': [
      Permission.CREATE_RECORDING,
      Permission.MANAGE_RECORDINGS,
      Permission.CREATE_SNAPSHOT,
      Permission.RESTORE_SNAPSHOT,
    ],
    'Moderation': [
      Permission.MUTE_PARTICIPANT,
      Permission.KICK_PARTICIPANT,
      Permission.MODERATE_CHAT,
    ],
    'Analytics': [
      Permission.VIEW_ANALYTICS,
      Permission.EXPORT_DATA,
    ],
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium">Your Permissions</span>
      </div>
      
      <div className="grid gap-3">
        {Object.entries(permissionGroups).map(([group, groupPermissions]) => {
          const hasAnyPermission = groupPermissions.some(p => permissions.includes(p));
          
          if (!hasAnyPermission) return null;
          
          return (
            <div key={group} className="space-y-2">
              <h5 className="text-xs font-medium text-gray-700">{group}</h5>
              <div className="grid grid-cols-1 gap-1">
                {groupPermissions.map((permission) => {
                  const hasPermission = permissions.includes(permission);
                  
                  return (
                    <div
                      key={permission}
                      className={cn(
                        'flex items-center gap-2 text-xs p-2 rounded',
                        hasPermission 
                          ? 'bg-green-50 text-green-700' 
                          : 'bg-gray-50 text-gray-500'
                      )}
                    >
                      {hasPermission ? (
                        <Unlock className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      <span className={cn(!hasPermission && 'line-through')}>
                        {permission.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
