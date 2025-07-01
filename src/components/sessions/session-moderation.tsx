'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  UserX,
  Mic,
  MicOff,
  Eye,
  EyeOff,
  Crown,
  Settings,
  Clock,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions, WithPermission } from '@/hooks/use-permissions';
import { Permission, getRoleDisplayName, getRoleColor } from '@/lib/permissions';
import type { SessionParticipant, ParticipantRole } from '@/types';

interface SessionModerationProps {
  sessionId: string;
  participants: SessionParticipant[];
  onKickParticipant?: (participantId: string) => void;
  onMuteParticipant?: (participantId: string, muted: boolean) => void;
  onChangeParticipantRole?: (participantId: string, role: ParticipantRole) => void;
  onToggleParticipantVisibility?: (participantId: string, visible: boolean) => void;
  className?: string;
}

export function SessionModeration({
  sessionId: _sessionId,
  participants,
  onKickParticipant,
  onMuteParticipant,
  onChangeParticipantRole,
  onToggleParticipantVisibility,
  className
}: SessionModerationProps) {
  const { canModerate } = usePermissions();

  if (!canModerate) {
    return null;
  }

  const handleKickParticipant = (participantId: string) => {
    if (onKickParticipant) {
      onKickParticipant(participantId);
    }
  };

  const handleMuteParticipant = (participantId: string, muted: boolean) => {
    if (onMuteParticipant) {
      onMuteParticipant(participantId, muted);
    }
  };

  const handleChangeRole = (participantId: string, role: ParticipantRole) => {
    if (onChangeParticipantRole) {
      onChangeParticipantRole(participantId, role);
    }
  };

  const handleToggleVisibility = (participantId: string, visible: boolean) => {
    if (onToggleParticipantVisibility) {
      onToggleParticipantVisibility(participantId, visible);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Session Moderation</h3>
        <Badge variant="outline" className="text-xs">
          {participants.length} participants
        </Badge>
      </div>

      <div className="grid gap-4">
        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <WithPermission permission={Permission.MUTE_PARTICIPANT}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    participants.forEach(p => handleMuteParticipant(p.id, true));
                  }}
                  className="flex items-center gap-2"
                >
                  <MicOff className="h-4 w-4" />
                  Mute All
                </Button>
              </WithPermission>

              <WithPermission permission={Permission.MUTE_PARTICIPANT}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    participants.forEach(p => handleMuteParticipant(p.id, false));
                  }}
                  className="flex items-center gap-2"
                >
                  <Mic className="h-4 w-4" />
                  Unmute All
                </Button>
              </WithPermission>

              <WithPermission permission={Permission.MODERATE_CHAT}>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Session Settings
                </Button>
              </WithPermission>
            </div>
          </CardContent>
        </Card>

        {/* Participant Management */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Participant Management</CardTitle>
            <CardDescription>
              Manage individual participant permissions and actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {participants.map((participant) => (
              <ParticipantModerationCard
                key={participant.id}
                participant={participant}
                onKick={handleKickParticipant}
                onMute={handleMuteParticipant}
                onChangeRole={handleChangeRole}
                onToggleVisibility={handleToggleVisibility}
              />
            ))}
          </CardContent>
        </Card>

        {/* Session Statistics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Session Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                <span>Active: {participants.filter(p => p.isActive).length}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>Avg. Session Time: 45m</span>
              </div>
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-500" />
                <span>Instructors: {participants.filter(p => p.role === 'INSTRUCTOR').length}</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-gray-500" />
                <span>Observers: {participants.filter(p => p.role === 'OBSERVER').length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface ParticipantModerationCardProps {
  participant: SessionParticipant;
  onKick: (participantId: string) => void;
  onMute: (participantId: string, muted: boolean) => void;
  onChangeRole: (participantId: string, role: ParticipantRole) => void;
  onToggleVisibility: (participantId: string, visible: boolean) => void;
}

function ParticipantModerationCard({
  participant,
  onKick,
  onMute,
  onChangeRole,
  onToggleVisibility,
}: ParticipantModerationCardProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const handleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    onMute(participant.id, newMutedState);
  };

  const handleToggleVisibility = () => {
    const newVisibleState = !isVisible;
    setIsVisible(newVisibleState);
    onToggleVisibility(participant.id, newVisibleState);
  };

  const handleRoleChange = (role: ParticipantRole) => {
    onChangeRole(participant.id, role);
    setShowRoleMenu(false);
  };

  const joinedTime = new Date(participant.joinedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative">
          <div
            className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
              participant.role === 'INSTRUCTOR' ? 'bg-blue-500' : 
              participant.role === 'LEARNER' ? 'bg-green-500' : 'bg-gray-500'
            )}
          >
            {participant.userId?.charAt(0).toUpperCase() || 'U'}
          </div>
          
          {/* Status indicators */}
          <div className="absolute -bottom-1 -right-1 flex gap-1">
            {!participant.isActive && (
              <div className="h-3 w-3 bg-gray-400 rounded-full border border-white" />
            )}
            {isMuted && (
              <div className="h-3 w-3 bg-red-400 rounded-full border border-white" />
            )}
          </div>
        </div>

        {/* Participant info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {participant.userId || 'Unknown User'}
            </span>
            <Badge 
              className={cn('text-xs', getRoleColor(participant.role))}
              variant="outline"
            >
              {getRoleDisplayName(participant.role)}
            </Badge>
            {!participant.isActive && (
              <Badge variant="outline" className="text-xs text-gray-500">
                Inactive
              </Badge>
            )}
          </div>
          <div className="text-xs text-gray-500">
            Joined at {joinedTime}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <WithPermission permission={Permission.MUTE_PARTICIPANT}>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleMute}
            className={cn(
              'h-8 w-8 p-0',
              isMuted && 'text-red-600'
            )}
            title={isMuted ? 'Unmute participant' : 'Mute participant'}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        </WithPermission>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleToggleVisibility}
          className={cn(
            'h-8 w-8 p-0',
            !isVisible && 'text-gray-400'
          )}
          title={isVisible ? 'Hide from others' : 'Show to others'}
        >
          {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </Button>

        <div className="relative">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="h-8 w-8 p-0"
            title="Change role"
          >
            <Settings className="h-4 w-4" />
          </Button>

          {showRoleMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-32">
              <div className="py-1">
                {(['INSTRUCTOR', 'LEARNER', 'OBSERVER'] as ParticipantRole[]).map((role) => (
                  <button
                    key={role}
                    onClick={() => handleRoleChange(role)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-gray-50',
                      participant.role === role && 'bg-blue-50 text-blue-600'
                    )}
                  >
                    {getRoleDisplayName(role)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <WithPermission permission={Permission.KICK_PARTICIPANT}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onKick(participant.id)}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
            title="Remove participant"
          >
            <UserX className="h-4 w-4" />
          </Button>
        </WithPermission>
      </div>
    </div>
  );
}
