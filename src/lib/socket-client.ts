import io from 'socket.io-client';

// Type for the socket instance
type SocketInstance = ReturnType<typeof io>;

export interface ParticipantInfo {
  id: string;
  name: string;
  email: string;
  role: 'instructor' | 'learner';
  joinedAt: Date;
  isActive: boolean;
  cursor?: {
    line: number;
    column: number;
  };
}

export interface SocketEvents {
  // Client to server events
  'join-session': (data: {
    sessionId: string;
    userInfo: ParticipantInfo;
  }) => void;
  'leave-session': () => void;
  'cursor-update': (data: {
    line: number;
    column: number;
  }) => void;
  'activity-status': (data: { isActive: boolean }) => void;

  // Server to client events
  'session-joined': (data: {
    sessionId: string;
    participants: ParticipantInfo[];
  }) => void;
  'user-joined': (data: {
    user: ParticipantInfo;
    participants: ParticipantInfo[];
  }) => void;
  'user-left': (data: {
    userId: string;
    user: ParticipantInfo;
    participants: ParticipantInfo[];
  }) => void;
  'cursor-moved': (data: {
    userId: string;
    cursor: {
      line: number;
      column: number;
    };
  }) => void;
  'user-activity-changed': (data: {
    userId: string;
    isActive: boolean;
  }) => void;
  'error': (data: { message: string }) => void;
}

class SocketClient {
  private socket: SocketInstance | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(): Promise<SocketInstance> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve(this.socket);
        return;
      }

      if (this.isConnecting) {
        // Wait for existing connection attempt
        const checkConnection = () => {
          if (this.socket?.connected) {
            resolve(this.socket);
          } else if (!this.isConnecting) {
            reject(new Error('Connection failed'));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
        return;
      }

      this.isConnecting = true;

      const socketUrl = process.env.NODE_ENV === 'production'
        ? process.env.NEXT_PUBLIC_APP_URL || window.location.origin
        : window.location.origin;

      this.socket = io(socketUrl, {
        path: '/api/socket',
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: false,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
      });

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket?.id);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        resolve(this.socket!);
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('Socket connection error:', error);
        this.isConnecting = false;
        this.reconnectAttempts++;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts`));
        }
      });

      this.socket.on('disconnect', (reason: string) => {
        console.log('Socket disconnected:', reason);
        this.isConnecting = false;

        // Attempt to reconnect if disconnection was unexpected
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, don't reconnect automatically
          console.log('Server disconnected the client');
        } else {
          // Client or network issue, attempt to reconnect
          console.log('Attempting to reconnect...');
        }
      });

      this.socket.on('reconnect', (attemptNumber: number) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts');
        this.reconnectAttempts = 0;
      });

      this.socket.on('reconnect_error', (error: Error) => {
        console.error('Socket reconnection error:', error);
      });

      this.socket.on('reconnect_failed', () => {
        console.error('Socket reconnection failed');
        this.isConnecting = false;
        reject(new Error('Reconnection failed'));
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  emit<K extends keyof SocketEvents>(event: K, data: Parameters<SocketEvents[K]>[0]) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
    }
  }

  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]) {
    if (this.socket) {
      this.socket.on(event as string, callback);
    }
  }

  off<K extends keyof SocketEvents>(event: K, callback?: SocketEvents[K]) {
    if (this.socket) {
      this.socket.off(event as string, callback);
    }
  }

  get connected(): boolean {
    return this.socket?.connected || false;
  }

  get id(): string | undefined {
    return this.socket?.id;
  }

  joinSession(sessionId: string, userInfo: ParticipantInfo) {
    this.emit('join-session', { sessionId, userInfo });
  }

  leaveSession() {
    this.emit('leave-session', undefined);
  }

  updateCursor(line: number, column: number) {
    this.emit('cursor-update', { line, column });
  }

  updateActivityStatus(isActive: boolean) {
    this.emit('activity-status', { isActive });
  }
}

// Singleton instance
const socketClient = new SocketClient();

export default socketClient;
