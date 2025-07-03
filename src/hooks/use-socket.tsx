'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import socketClient, { ParticipantInfo } from '@/lib/socket-client';

export interface SocketContextType {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  
  // Session state
  currentSessionId: string | null;
  participants: ParticipantInfo[];
  
  // Methods
  connect: () => Promise<void>;
  disconnect: () => void;
  joinSession: (sessionId: string, userInfo: ParticipantInfo) => Promise<void>;
  leaveSession: () => void;
  updateCursor: (line: number, column: number) => void;
  updateActivityStatus: (isActive: boolean) => void;
  
  // Event handlers
  onUserJoined: (callback: (data: { user: ParticipantInfo; participants: ParticipantInfo[] }) => void) => void;
  onUserLeft: (callback: (data: { userId: string; user: ParticipantInfo; participants: ParticipantInfo[] }) => void) => void;
  onCursorMoved: (callback: (data: { userId: string; cursor: { line: number; column: number } }) => void) => void;
  onUserActivityChanged: (callback: (data: { userId: string; isActive: boolean }) => void) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Check if we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Event callback refs
  const eventCallbacks = React.useRef<{
    onUserJoined?: (data: { user: ParticipantInfo; participants: ParticipantInfo[] }) => void;
    onUserLeft?: (data: { userId: string; user: ParticipantInfo; participants: ParticipantInfo[] }) => void;
    onCursorMoved?: (data: { userId: string; cursor: { line: number; column: number } }) => void;
    onUserActivityChanged?: (data: { userId: string; isActive: boolean }) => void;
  }>({});

  const connect = useCallback(async () => {
    if (!isClient || isConnected || isConnecting) return;

    setIsConnecting(true);
    setConnectionError(null);

    try {
      await socketClient.connect();
      setIsConnected(true);
      setConnectionError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
      setConnectionError(errorMessage);
      console.error('Socket connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [isClient, isConnected, isConnecting]);

  const disconnect = useCallback(() => {
    socketClient.disconnect();
    setIsConnected(false);
    setIsConnecting(false);
    setCurrentSessionId(null);
    setParticipants([]);
    setConnectionError(null);
  }, []);

  const joinSession = useCallback(async (sessionId: string, userInfo: ParticipantInfo) => {
    if (!isConnected) {
      await connect();
    }

    socketClient.joinSession(sessionId, userInfo);
    setCurrentSessionId(sessionId);
  }, [isConnected, connect]);

  const leaveSession = useCallback(() => {
    if (isConnected && currentSessionId) {
      socketClient.leaveSession();
      setCurrentSessionId(null);
      setParticipants([]);
    }
  }, [isConnected, currentSessionId]);

  const updateCursor = useCallback((line: number, column: number) => {
    if (isConnected && currentSessionId) {
      socketClient.updateCursor(line, column);
    }
  }, [isConnected, currentSessionId]);

  const updateActivityStatus = useCallback((isActive: boolean) => {
    if (isConnected && currentSessionId) {
      socketClient.updateActivityStatus(isActive);
    }
  }, [isConnected, currentSessionId]);

  // Event handler setters
  const onUserJoined = useCallback((callback: (data: { user: ParticipantInfo; participants: ParticipantInfo[] }) => void) => {
    eventCallbacks.current.onUserJoined = callback;
  }, []);

  const onUserLeft = useCallback((callback: (data: { userId: string; user: ParticipantInfo; participants: ParticipantInfo[] }) => void) => {
    eventCallbacks.current.onUserLeft = callback;
  }, []);

  const onCursorMoved = useCallback((callback: (data: { userId: string; cursor: { line: number; column: number } }) => void) => {
    eventCallbacks.current.onCursorMoved = callback;
  }, []);

  const onUserActivityChanged = useCallback((callback: (data: { userId: string; isActive: boolean }) => void) => {
    eventCallbacks.current.onUserActivityChanged = callback;
  }, []);

  // Set up socket event listeners
  useEffect(() => {
    if (!isConnected) return;

    // Session joined
    socketClient.on('session-joined', (data) => {
      setParticipants(data.participants);
    });

    // User joined
    socketClient.on('user-joined', (data) => {
      setParticipants(data.participants);
      eventCallbacks.current.onUserJoined?.(data);
    });

    // User left
    socketClient.on('user-left', (data) => {
      setParticipants(data.participants);
      eventCallbacks.current.onUserLeft?.(data);
    });

    // Cursor moved
    socketClient.on('cursor-moved', (data) => {
      eventCallbacks.current.onCursorMoved?.(data);
    });

    // User activity changed
    socketClient.on('user-activity-changed', (data) => {
      eventCallbacks.current.onUserActivityChanged?.(data);
    });

    // Error handling
    socketClient.on('error', (data) => {
      setConnectionError(data.message);
      console.error('Socket error:', data.message);
    });

    // Cleanup function
    return () => {
      socketClient.off('session-joined');
      socketClient.off('user-joined');
      socketClient.off('user-left');
      socketClient.off('cursor-moved');
      socketClient.off('user-activity-changed');
      socketClient.off('error');
    };
  }, [isConnected]);

  // Monitor connection status
  useEffect(() => {
    if (!isClient) return;

    const checkConnection = () => {
      const connected = socketClient.connected;
      if (connected !== isConnected) {
        setIsConnected(connected);
        if (!connected) {
          setCurrentSessionId(null);
          setParticipants([]);
        }
      }
    };

    const interval = setInterval(checkConnection, 1000);
    return () => clearInterval(interval);
  }, [isClient, isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentSessionId) {
        leaveSession();
      }
    };
  }, [currentSessionId, leaveSession]);

  const value: SocketContextType = {
    isConnected,
    isConnecting,
    connectionError,
    currentSessionId,
    participants,
    connect,
    disconnect,
    joinSession,
    leaveSession,
    updateCursor,
    updateActivityStatus,
    onUserJoined,
    onUserLeft,
    onCursorMoved,
    onUserActivityChanged,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextType {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

// Additional hooks for specific functionality
export function useSessionParticipants() {
  const { participants } = useSocket();
  return participants;
}

export function useConnectionStatus() {
  const { isConnected, isConnecting, connectionError } = useSocket();
  return { isConnected, isConnecting, connectionError };
}
