import { io, Socket } from 'socket.io-client';

export interface CodeChangeEvent {
  sessionId: string;
  userId: string;
  code: string;
  language: string;
  timestamp: Date;
  cursorPosition?: {
    lineNumber: number;
    column: number;
  };
}

export interface UserPresenceEvent {
  sessionId: string;
  userId: string;
  userName: string;
  isActive: boolean;
  cursorPosition?: {
    lineNumber: number;
    column: number;
  };
}

export interface LanguageChangeEvent {
  sessionId: string;
  userId: string;
  language: string;
  timestamp: Date;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private sessionId: string | null = null;
  private userId: string | null = null;

  constructor() {
    // Initialize socket connection
    this.socket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001', {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  connect() {
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    }
  }

  disconnect() {
    if (this.socket && this.socket.connected) {
      this.socket.disconnect();
    }
  }

  joinSession(sessionId: string, userId: string) {
    if (!this.socket) return;

    this.sessionId = sessionId;
    this.userId = userId;

    this.socket.emit('join-session', { sessionId, userId });
  }

  leaveSession() {
    if (!this.socket || !this.sessionId || !this.userId) return;

    this.socket.emit('leave-session', { 
      sessionId: this.sessionId, 
      userId: this.userId 
    });

    this.sessionId = null;
    this.userId = null;
  }

  sendCodeChange(code: string, language: string, cursorPosition?: { lineNumber: number; column: number }) {
    if (!this.socket || !this.sessionId || !this.userId) return;

    const event: CodeChangeEvent = {
      sessionId: this.sessionId,
      userId: this.userId,
      code,
      language,
      timestamp: new Date(),
      cursorPosition,
    };

    this.socket.emit('code-change', event);
  }

  sendLanguageChange(language: string) {
    if (!this.socket || !this.sessionId || !this.userId) return;

    const event: LanguageChangeEvent = {
      sessionId: this.sessionId,
      userId: this.userId,
      language,
      timestamp: new Date(),
    };

    this.socket.emit('language-change', event);
  }

  sendUserPresence(isActive: boolean, cursorPosition?: { lineNumber: number; column: number }) {
    if (!this.socket || !this.sessionId || !this.userId) return;

    const event: UserPresenceEvent = {
      sessionId: this.sessionId,
      userId: this.userId,
      userName: '', // Will be filled by the server
      isActive,
      cursorPosition,
    };

    this.socket.emit('user-presence', event);
  }

  onCodeChange(callback: (event: CodeChangeEvent) => void) {
    if (!this.socket) return;
    this.socket.on('code-change', callback);
  }

  onLanguageChange(callback: (event: LanguageChangeEvent) => void) {
    if (!this.socket) return;
    this.socket.on('language-change', callback);
  }

  onUserPresence(callback: (event: UserPresenceEvent) => void) {
    if (!this.socket) return;
    this.socket.on('user-presence', callback);
  }

  onUserJoined(callback: (event: { sessionId: string; userId: string; userName: string }) => void) {
    if (!this.socket) return;
    this.socket.on('user-joined', callback);
  }

  onUserLeft(callback: (event: { sessionId: string; userId: string }) => void) {
    if (!this.socket) return;
    this.socket.on('user-left', callback);
  }

  // Remove event listeners
  offCodeChange(callback?: (event: CodeChangeEvent) => void) {
    if (!this.socket) return;
    this.socket.off('code-change', callback);
  }

  offLanguageChange(callback?: (event: LanguageChangeEvent) => void) {
    if (!this.socket) return;
    this.socket.off('language-change', callback);
  }

  offUserPresence(callback?: (event: UserPresenceEvent) => void) {
    if (!this.socket) return;
    this.socket.off('user-presence', callback);
  }

  offUserJoined(callback?: (event: { sessionId: string; userId: string; userName: string }) => void) {
    if (!this.socket) return;
    this.socket.off('user-joined', callback);
  }

  offUserLeft(callback?: (event: { sessionId: string; userId: string }) => void) {
    if (!this.socket) return;
    this.socket.off('user-left', callback);
  }

  // Get connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Get current session info
  getCurrentSession(): { sessionId: string | null; userId: string | null } {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
    };
  }
}

// Create a singleton instance
export const webSocketService = new WebSocketService();
