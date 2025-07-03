'use client';

import { useState, useEffect } from 'react';
import { webSocketService } from '@/lib/services/websocket-service';
import type { UserPresenceEvent } from '@/lib/services/websocket-service';
import { useUserStore } from '@/stores/user-store';

interface ActiveUser {
  userId: string;
  userName: string;
  isActive: boolean;
  cursorPosition?: {
    lineNumber: number;
    column: number;
  };
}

interface UserPresenceProps {
  sessionId: string;
}

export function UserPresence({ sessionId }: UserPresenceProps) {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const { user } = useUserStore();

  useEffect(() => {
    if (!sessionId || !user) return;

    // Handle user presence updates
    const handleUserPresence = (event: UserPresenceEvent) => {
      setActiveUsers(prev => {
        const existingIndex = prev.findIndex(u => u.userId === event.userId);
        
        if (existingIndex >= 0) {
          // Update existing user
          const updated = [...prev];
          updated[existingIndex] = {
            userId: event.userId,
            userName: event.userName,
            isActive: event.isActive,
            cursorPosition: event.cursorPosition,
          };
          return updated;
        } else if (event.isActive) {
          // Add new active user
          return [...prev, {
            userId: event.userId,
            userName: event.userName,
            isActive: event.isActive,
            cursorPosition: event.cursorPosition,
          }];
        }
        
        return prev;
      });
    };

    // Handle user joined
    const handleUserJoined = (event: { sessionId: string; userId: string; userName: string }) => {
      if (event.sessionId === sessionId && event.userId !== user.id) {
        setActiveUsers(prev => {
          const exists = prev.some(u => u.userId === event.userId);
          if (!exists) {
            return [...prev, {
              userId: event.userId,
              userName: event.userName,
              isActive: true,
            }];
          }
          return prev;
        });
      }
    };

    // Handle user left
    const handleUserLeft = (event: { sessionId: string; userId: string }) => {
      if (event.sessionId === sessionId) {
        setActiveUsers(prev => prev.filter(u => u.userId !== event.userId));
      }
    };

    // Set up event listeners
    webSocketService.onUserPresence(handleUserPresence);
    webSocketService.onUserJoined(handleUserJoined);
    webSocketService.onUserLeft(handleUserLeft);

    // Send initial presence
    webSocketService.sendUserPresence(true);

    // Cleanup
    return () => {
      webSocketService.offUserPresence(handleUserPresence);
      webSocketService.offUserJoined(handleUserJoined);
      webSocketService.offUserLeft(handleUserLeft);
      webSocketService.sendUserPresence(false);
    };
  }, [sessionId, user]);

  // Filter out current user and inactive users
  const otherActiveUsers = activeUsers.filter(u => u.userId !== user?.id && u.isActive);

  if (otherActiveUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
      <span>👥</span>
      <span>
        {otherActiveUsers.length === 1 
          ? `${otherActiveUsers[0].userName} is editing`
          : `${otherActiveUsers.length} users are editing`
        }
      </span>
      <div className="flex -space-x-1">
        {otherActiveUsers.slice(0, 3).map((activeUser) => (
          <div
            key={activeUser.userId}
            className="w-6 h-6 bg-primary/10 border-2 border-background rounded-full flex items-center justify-center"
            title={`${activeUser.userName} is editing`}
          >
            <span className="text-primary font-semibold text-xs">
              {activeUser.userName.charAt(0).toUpperCase()}
            </span>
          </div>
        ))}
        {otherActiveUsers.length > 3 && (
          <div className="w-6 h-6 bg-muted border-2 border-background rounded-full flex items-center justify-center">
            <span className="text-muted-foreground font-semibold text-xs">
              +{otherActiveUsers.length - 3}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
