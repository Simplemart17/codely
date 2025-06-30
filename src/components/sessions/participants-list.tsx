'use client';

import React, { useEffect, useState } from 'react';
import { useSocket, useSessionParticipants } from '@/hooks/use-socket';
import { ParticipantInfo } from '@/lib/socket-client';
import { Users, Crown, User, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ParticipantsListProps {
  className?: string;
  showHeader?: boolean;
  maxVisible?: number;
}

export function ParticipantsList({ 
  className, 
  showHeader = true, 
  maxVisible = 10 
}: ParticipantsListProps) {
  const participants = useSessionParticipants();
  const { onUserJoined, onUserLeft, onUserActivityChanged } = useSocket();
  const [recentActivity, setRecentActivity] = useState<Set<string>>(new Set());

  // Handle real-time participant updates
  useEffect(() => {
    onUserJoined((data) => {
      console.log('User joined:', data.user.name);
      // Add visual feedback for new user
      setRecentActivity(prev => new Set(prev).add(data.user.id));
      setTimeout(() => {
        setRecentActivity(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.user.id);
          return newSet;
        });
      }, 3000);
    });

    onUserLeft((data) => {
      console.log('User left:', data.user.name);
    });

    onUserActivityChanged((data) => {
      console.log('User activity changed:', data.userId, data.isActive);
    });
  }, [onUserJoined, onUserLeft, onUserActivityChanged]);

  const visibleParticipants = participants.slice(0, maxVisible);
  const hiddenCount = Math.max(0, participants.length - maxVisible);

  if (participants.length === 0) {
    return (
      <div className={cn('p-4 text-center text-gray-500', className)}>
        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No participants yet</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {showHeader && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
          <Users className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            Participants ({participants.length})
          </span>
        </div>
      )}

      <div className="space-y-2">
        {visibleParticipants.map((participant) => (
          <ParticipantItem
            key={participant.id}
            participant={participant}
            isRecentlyJoined={recentActivity.has(participant.id)}
          />
        ))}

        {hiddenCount > 0 && (
          <div className="px-3 py-2 text-sm text-gray-500 text-center">
            +{hiddenCount} more participant{hiddenCount > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

interface ParticipantItemProps {
  participant: ParticipantInfo;
  isRecentlyJoined?: boolean;
}

function ParticipantItem({ participant, isRecentlyJoined }: ParticipantItemProps) {
  const isInstructor = participant.role === 'instructor';
  const joinedTime = new Date(participant.joinedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-all duration-300',
        isRecentlyJoined && 'bg-green-50 border-green-200 shadow-sm',
        !isRecentlyJoined && 'bg-white border-gray-200 hover:bg-gray-50',
        !participant.isActive && 'opacity-60'
      )}
    >
      {/* Avatar */}
      <div className="relative">
        <div
          className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
            isInstructor ? 'bg-blue-500' : 'bg-gray-500'
          )}
        >
          {participant.name.charAt(0).toUpperCase()}
        </div>
        
        {/* Activity indicator */}
        <div
          className={cn(
            'absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white',
            participant.isActive ? 'bg-green-400' : 'bg-gray-400'
          )}
        />
      </div>

      {/* Participant info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 truncate">
            {participant.name}
          </span>
          {isInstructor && (
            <Crown className="h-3 w-3 text-yellow-500" title="Instructor" />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{participant.role}</span>
          <Circle className="h-1 w-1 fill-current" />
          <span>Joined {joinedTime}</span>
        </div>
      </div>

      {/* Cursor indicator */}
      {participant.cursor && participant.isActive && (
        <div className="text-xs text-gray-400" title="Current cursor position">
          L{participant.cursor.line}:C{participant.cursor.column}
        </div>
      )}
    </div>
  );
}

interface ParticipantAvatarsProps {
  className?: string;
  maxVisible?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function ParticipantAvatars({ 
  className, 
  maxVisible = 5, 
  size = 'md' 
}: ParticipantAvatarsProps) {
  const participants = useSessionParticipants();
  const visibleParticipants = participants.slice(0, maxVisible);
  const hiddenCount = Math.max(0, participants.length - maxVisible);

  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
  };

  if (participants.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center', className)}>
      <div className="flex -space-x-2">
        {visibleParticipants.map((participant, index) => (
          <div
            key={participant.id}
            className={cn(
              'rounded-full border-2 border-white flex items-center justify-center text-white font-medium',
              sizeClasses[size],
              participant.role === 'instructor' ? 'bg-blue-500' : 'bg-gray-500',
              !participant.isActive && 'opacity-60'
            )}
            style={{ zIndex: visibleParticipants.length - index }}
            title={`${participant.name} (${participant.role})`}
          >
            {participant.name.charAt(0).toUpperCase()}
          </div>
        ))}
        
        {hiddenCount > 0 && (
          <div
            className={cn(
              'rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-gray-600 font-medium',
              sizeClasses[size]
            )}
            title={`+${hiddenCount} more participant${hiddenCount > 1 ? 's' : ''}`}
          >
            +{hiddenCount}
          </div>
        )}
      </div>
    </div>
  );
}
