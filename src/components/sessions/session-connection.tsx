'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/use-socket';
import { ParticipantInfo } from '@/lib/socket-client';
import { Button } from '@/components/ui/button';
import { ConnectionStatus } from '@/components/ui/connection-status';
import { Loader2, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SessionConnectionProps {
  sessionId: string;
  userInfo: ParticipantInfo;
  onConnectionChange?: (isConnected: boolean) => void;
  className?: string;
}

export function SessionConnection({ 
  sessionId, 
  userInfo, 
  onConnectionChange,
  className 
}: SessionConnectionProps) {
  const {
    isConnected,
    isConnecting,
    currentSessionId,
    connect,
    disconnect,
    joinSession,
    leaveSession,
  } = useSocket();

  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);

  const isInSession = currentSessionId === sessionId;

  // Auto-connect when component mounts
  useEffect(() => {
    if (!autoConnectAttempted && !isConnected && !isConnecting) {
      setAutoConnectAttempted(true);
      handleConnect();
    }
  }, [autoConnectAttempted, isConnected, isConnecting]);

  // Auto-join session when connected
  useEffect(() => {
    if (isConnected && !isInSession && !isJoining && autoConnectAttempted) {
      handleJoinSession();
    }
  }, [isConnected, isInSession, isJoining, autoConnectAttempted]);

  // Notify parent of connection changes
  useEffect(() => {
    onConnectionChange?.(isInSession);
  }, [isInSession, onConnectionChange]);

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleJoinSession = async () => {
    if (!isConnected || isJoining) return;

    setIsJoining(true);
    try {
      await joinSession(sessionId, userInfo);
    } catch (error) {
      console.error('Failed to join session:', error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveSession = async () => {
    if (!isInSession || isLeaving) return;

    setIsLeaving(true);
    try {
      leaveSession();
    } catch (error) {
      console.error('Failed to leave session:', error);
    } finally {
      setIsLeaving(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setAutoConnectAttempted(false);
  };

  const getConnectionStatus = () => {
    if (isJoining) return 'Joining session...';
    if (isLeaving) return 'Leaving session...';
    if (isInSession) return 'Connected to session';
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Connected, ready to join';
    return 'Disconnected';
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <ConnectionStatus showText={true} />
        <div className="text-sm text-gray-600">
          {getConnectionStatus()}
        </div>
      </div>

      {/* Session Actions */}
      <div className="flex items-center gap-2">
        {!isConnected && (
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            variant="outline"
            size="sm"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" />
                Connect
              </>
            )}
          </Button>
        )}

        {isConnected && !isInSession && (
          <Button
            onClick={handleJoinSession}
            disabled={isJoining}
            size="sm"
          >
            {isJoining ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" />
                Join Session
              </>
            )}
          </Button>
        )}

        {isInSession && (
          <Button
            onClick={handleLeaveSession}
            disabled={isLeaving}
            variant="outline"
            size="sm"
          >
            {isLeaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Leaving...
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4 mr-2" />
                Leave Session
              </>
            )}
          </Button>
        )}

        {isConnected && (
          <Button
            onClick={handleDisconnect}
            variant="ghost"
            size="sm"
          >
            Disconnect
          </Button>
        )}
      </div>

      {/* Session Info */}
      {isInSession && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-green-800">
              Connected to session
            </span>
          </div>
          <div className="text-xs text-green-600 mt-1">
            Session ID: {sessionId}
          </div>
        </div>
      )}
    </div>
  );
}

interface QuickConnectProps {
  sessionId: string;
  userInfo: ParticipantInfo;
  onConnected?: () => void;
  className?: string;
}

export function QuickConnect({ 
  sessionId, 
  userInfo, 
  onConnected,
  className 
}: QuickConnectProps) {
  const { isConnected, currentSessionId, connect, joinSession } = useSocket();
  const [isConnecting, setIsConnecting] = useState(false);

  const isInSession = currentSessionId === sessionId;

  const handleQuickConnect = async () => {
    setIsConnecting(true);
    try {
      if (!isConnected) {
        await connect();
      }
      if (!isInSession) {
        await joinSession(sessionId, userInfo);
      }
      onConnected?.();
    } catch (error) {
      console.error('Quick connect failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  if (isInSession) {
    return (
      <div className={cn('text-sm text-green-600', className)}>
        ✓ Connected to session
      </div>
    );
  }

  return (
    <Button
      onClick={handleQuickConnect}
      disabled={isConnecting}
      className={className}
    >
      {isConnecting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Connecting...
        </>
      ) : (
        'Join Session'
      )}
    </Button>
  );
}
