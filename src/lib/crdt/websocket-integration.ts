/**
 * WebSocket Integration for CRDT Operations
 * 
 * This module integrates CRDT operations with the existing WebSocket
 * infrastructure for real-time collaborative editing.
 */

import { io, Socket } from 'socket.io-client';
import { Operation, OperationBatch } from './operations';
import { CRDTDocument, DocumentState, CollaborativeUser } from './document';
import { CRDTManager } from './manager';

/**
 * WebSocket message types
 */
export enum MessageType {
  // Document operations
  OPERATION = 'operation',
  OPERATION_BATCH = 'operation_batch',
  DOCUMENT_UPDATE = 'document_update',
  STATE_VECTOR = 'state_vector',
  
  // User awareness
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  CURSOR_UPDATE = 'cursor_update',
  SELECTION_UPDATE = 'selection_update',
  
  // Session management
  JOIN_SESSION = 'join_session',
  LEAVE_SESSION = 'leave_session',
  SESSION_STATE = 'session_state',
  
  // Synchronization
  SYNC_REQUEST = 'sync_request',
  SYNC_RESPONSE = 'sync_response',
  HEARTBEAT = 'heartbeat',
  
  // Error handling
  ERROR = 'error',
  CONFLICT = 'conflict'
}

/**
 * WebSocket message interface
 */
export interface WebSocketMessage {
  type: MessageType;
  sessionId: string;
  userId: string;
  timestamp: number;
  data: any;
}

/**
 * WebSocket configuration
 */
export interface WebSocketConfig {
  url: string;
  options?: any;
  reconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
  messageTimeout: number;
  enableCompression: boolean;
  maxMessageSize: number;
}

/**
 * Connection statistics
 */
export interface ConnectionStats {
  connected: boolean;
  reconnectAttempts: number;
  lastConnected: number;
  totalMessages: number;
  messagesSent: number;
  messagesReceived: number;
  averageLatency: number;
  errors: number;
}

/**
 * WebSocket Integration class for CRDT operations
 */
export class WebSocketCRDTIntegration {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private crdtManager: CRDTManager;
  private currentUser: CollaborativeUser | null = null;
  private activeSessions: Set<string> = new Set();
  private messageQueue: WebSocketMessage[] = [];
  private stats: ConnectionStats;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Function[]> = new Map();
  private pendingMessages: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();

  constructor(config: WebSocketConfig, crdtManager: CRDTManager) {
    this.config = config;
    this.crdtManager = crdtManager;
    
    this.stats = {
      connected: false,
      reconnectAttempts: 0,
      lastConnected: 0,
      totalMessages: 0,
      messagesSent: 0,
      messagesReceived: 0,
      averageLatency: 0,
      errors: 0
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect(user: CollaborativeUser): Promise<void> {
    this.currentUser = user;
    
    try {
      this.socket = io(this.config.url, {
        ...this.config.options,
        transports: ['websocket'],
        upgrade: true,
        rememberUpgrade: true
      });

      this.setupSocketListeners();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.socket!.on('connect', () => {
          clearTimeout(timeout);
          this.stats.connected = true;
          this.stats.lastConnected = Date.now();
          this.stats.reconnectAttempts = 0;
          
          this.startHeartbeat();
          this.processMessageQueue();
          
          this.emit('connected', { user });
          resolve();
        });

        this.socket!.on('connect_error', (error) => {
          clearTimeout(timeout);
          this.stats.errors++;
          reject(error);
        });
      });
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.stopHeartbeat();
    this.stats.connected = false;
    this.activeSessions.clear();
    
    // Reject all pending messages
    for (const [messageId, pending] of this.pendingMessages) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Disconnected'));
    }
    this.pendingMessages.clear();
    
    this.emit('disconnected');
  }

  /**
   * Join a collaborative session
   */
  async joinSession(sessionId: string): Promise<void> {
    if (!this.socket || !this.currentUser) {
      throw new Error('Not connected or no user set');
    }

    const message: WebSocketMessage = {
      type: MessageType.JOIN_SESSION,
      sessionId,
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data: {
        user: this.currentUser
      }
    };

    await this.sendMessage(message);
    this.activeSessions.add(sessionId);
    
    // Set up CRDT document for this session
    const document = await this.crdtManager.joinSession({
      sessionId,
      websocketUrl: this.config.url,
      user: this.currentUser
    });

    // Connect document events to WebSocket
    this.connectDocumentToWebSocket(document, sessionId);
  }

  /**
   * Leave a collaborative session
   */
  async leaveSession(sessionId: string): Promise<void> {
    if (!this.socket || !this.currentUser) {
      return;
    }

    const message: WebSocketMessage = {
      type: MessageType.LEAVE_SESSION,
      sessionId,
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data: {}
    };

    await this.sendMessage(message);
    this.activeSessions.delete(sessionId);
    
    // Clean up CRDT document
    await this.crdtManager.leaveSession(sessionId);
  }

  /**
   * Send operation to other users
   */
  async sendOperation(sessionId: string, operation: Operation): Promise<void> {
    if (!this.socket || !this.currentUser) {
      throw new Error('Not connected or no user set');
    }

    const message: WebSocketMessage = {
      type: MessageType.OPERATION,
      sessionId,
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data: { operation }
    };

    await this.sendMessage(message);
  }

  /**
   * Send operation batch
   */
  async sendOperationBatch(sessionId: string, batch: OperationBatch): Promise<void> {
    if (!this.socket || !this.currentUser) {
      throw new Error('Not connected or no user set');
    }

    const message: WebSocketMessage = {
      type: MessageType.OPERATION_BATCH,
      sessionId,
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data: { batch }
    };

    await this.sendMessage(message);
  }

  /**
   * Send cursor update
   */
  async sendCursorUpdate(sessionId: string, position: any): Promise<void> {
    if (!this.socket || !this.currentUser) {
      return;
    }

    const message: WebSocketMessage = {
      type: MessageType.CURSOR_UPDATE,
      sessionId,
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data: { position }
    };

    // Don't wait for cursor updates (fire and forget)
    this.sendMessageNoWait(message);
  }

  /**
   * Request session state
   */
  async requestSessionState(sessionId: string): Promise<DocumentState> {
    if (!this.socket || !this.currentUser) {
      throw new Error('Not connected or no user set');
    }

    const message: WebSocketMessage = {
      type: MessageType.SYNC_REQUEST,
      sessionId,
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data: {}
    };

    const response = await this.sendMessage(message);
    return response.data.state;
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.stats.connected && this.socket?.connected === true;
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Setup socket event listeners
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      this.stats.connected = false;
      this.emit('disconnected', { reason });
      
      if (reason === 'io server disconnect') {
        // Server disconnected, don't reconnect automatically
        return;
      }
      
      // Attempt reconnection
      this.attemptReconnection();
    });

    this.socket.on('reconnect', () => {
      this.stats.connected = true;
      this.stats.lastConnected = Date.now();
      this.stats.reconnectAttempts = 0;
      this.emit('reconnected');
    });

    this.socket.on('reconnect_attempt', () => {
      this.stats.reconnectAttempts++;
    });

    this.socket.on('error', (error) => {
      this.stats.errors++;
      this.emit('error', error);
    });

    // Handle incoming messages
    Object.values(MessageType).forEach(messageType => {
      this.socket!.on(messageType, (data) => {
        this.handleIncomingMessage(messageType as MessageType, data);
      });
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleIncomingMessage(type: MessageType, data: any): void {
    this.stats.messagesReceived++;
    this.stats.totalMessages++;

    const message: WebSocketMessage = {
      type,
      sessionId: data.sessionId,
      userId: data.userId,
      timestamp: data.timestamp || Date.now(),
      data: data.data || data
    };

    // Handle message acknowledgments
    if (data.messageId && this.pendingMessages.has(data.messageId)) {
      const pending = this.pendingMessages.get(data.messageId)!;
      clearTimeout(pending.timeout);
      this.pendingMessages.delete(data.messageId);
      pending.resolve(message);
      return;
    }

    // Route message to appropriate handler
    switch (type) {
      case MessageType.OPERATION:
        this.handleOperation(message);
        break;
      case MessageType.OPERATION_BATCH:
        this.handleOperationBatch(message);
        break;
      case MessageType.CURSOR_UPDATE:
        this.handleCursorUpdate(message);
        break;
      case MessageType.USER_JOINED:
        this.handleUserJoined(message);
        break;
      case MessageType.USER_LEFT:
        this.handleUserLeft(message);
        break;
      case MessageType.ERROR:
        this.handleError(message);
        break;
      default:
        this.emit('message', message);
    }
  }

  /**
   * Send message with acknowledgment
   */
  private async sendMessage(message: WebSocketMessage): Promise<WebSocketMessage> {
    if (!this.socket || !this.isConnected()) {
      // Queue message for later
      this.messageQueue.push(message);
      throw new Error('Not connected, message queued');
    }

    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error('Message timeout'));
      }, this.config.messageTimeout);

      this.pendingMessages.set(messageId, { resolve, reject, timeout });

      const messageWithId = { ...message, messageId };
      this.socket!.emit(message.type, messageWithId);
      
      this.stats.messagesSent++;
      this.stats.totalMessages++;
    });
  }

  /**
   * Send message without waiting for acknowledgment
   */
  private sendMessageNoWait(message: WebSocketMessage): void {
    if (!this.socket || !this.isConnected()) {
      return;
    }

    this.socket.emit(message.type, message);
    this.stats.messagesSent++;
    this.stats.totalMessages++;
  }

  /**
   * Connect CRDT document to WebSocket events
   */
  private connectDocumentToWebSocket(document: CRDTDocument, sessionId: string): void {
    // Forward document events to WebSocket
    document.on('textChange', (data) => {
      // Convert to operation and send
      // This would be implemented based on the specific CRDT implementation
    });

    document.on('awarenessChange', (data) => {
      // Send awareness updates
      if (data.added || data.updated) {
        // Send cursor/selection updates
      }
    });
  }

  /**
   * Handle incoming operation
   */
  private handleOperation(message: WebSocketMessage): void {
    const document = this.crdtManager.getDocument(message.sessionId);
    if (document) {
      // Apply operation to document
      // This would be implemented based on the specific CRDT implementation
    }
    
    this.emit('operationReceived', message);
  }

  /**
   * Handle incoming operation batch
   */
  private handleOperationBatch(message: WebSocketMessage): void {
    const document = this.crdtManager.getDocument(message.sessionId);
    if (document) {
      // Apply batch to document
      // This would be implemented based on the specific CRDT implementation
    }
    
    this.emit('batchReceived', message);
  }

  /**
   * Handle cursor update
   */
  private handleCursorUpdate(message: WebSocketMessage): void {
    this.emit('cursorUpdate', message);
  }

  /**
   * Handle user joined
   */
  private handleUserJoined(message: WebSocketMessage): void {
    this.emit('userJoined', message);
  }

  /**
   * Handle user left
   */
  private handleUserLeft(message: WebSocketMessage): void {
    this.emit('userLeft', message);
  }

  /**
   * Handle error message
   */
  private handleError(message: WebSocketMessage): void {
    this.stats.errors++;
    this.emit('error', message.data);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.isConnected()) {
        this.sendMessageNoWait({
          type: MessageType.HEARTBEAT,
          sessionId: '',
          userId: this.currentUser?.id || '',
          timestamp: Date.now(),
          data: {}
        });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift()!;
      this.sendMessageNoWait(message);
    }
  }

  /**
   * Attempt reconnection
   */
  private attemptReconnection(): void {
    if (this.stats.reconnectAttempts >= this.config.reconnectAttempts) {
      this.emit('reconnectFailed');
      return;
    }

    setTimeout(() => {
      if (this.socket && !this.isConnected()) {
        this.socket.connect();
      }
    }, this.config.reconnectDelay * Math.pow(2, this.stats.reconnectAttempts));
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket event listener:', error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disconnect();
    this.eventListeners.clear();
    this.messageQueue = [];
  }
}

/**
 * Create WebSocket CRDT integration instance
 */
export function createWebSocketCRDTIntegration(
  config: WebSocketConfig,
  crdtManager: CRDTManager
): WebSocketCRDTIntegration {
  return new WebSocketCRDTIntegration(config, crdtManager);
}
