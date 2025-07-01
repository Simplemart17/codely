/**
 * Operation Broadcasting System
 * 
 * This module implements efficient broadcasting of CRDT operations
 * to multiple users in real-time collaborative sessions.
 */

import { Operation, OperationBatch } from './operations';
// Removed unused import: CollaborativeUser

/**
 * Broadcast target types
 */
export enum BroadcastTarget {
  ALL_USERS = 'all_users',
  SESSION_USERS = 'session_users',
  SPECIFIC_USERS = 'specific_users',
  EXCLUDE_USERS = 'exclude_users'
}

/**
 * Broadcast priority levels
 */
export enum BroadcastPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Broadcast message interface
 */
export interface BroadcastMessage {
  id: string;
  type: 'operation' | 'batch' | 'awareness' | 'state';
  sessionId: string;
  sourceUserId: string;
  target: BroadcastTarget;
  targetUsers?: string[];
  excludeUsers?: string[];
  priority: BroadcastPriority;
  timestamp: number;
  data: unknown;
  retryCount?: number;
  expiresAt?: number;
}

/**
 * Broadcast configuration
 */
export interface BroadcastConfig {
  maxRetries: number;
  retryDelay: number; // milliseconds
  messageTimeout: number; // milliseconds
  batchSize: number;
  batchTimeout: number; // milliseconds
  enableCompression: boolean;
  enableDeduplication: boolean;
  maxQueueSize: number;
}

/**
 * Broadcast statistics
 */
export interface BroadcastStats {
  totalMessages: number;
  successfulBroadcasts: number;
  failedBroadcasts: number;
  retriedMessages: number;
  averageLatency: number;
  queueSize: number;
  activeConnections: number;
}

/**
 * Connection interface for broadcasting
 */
export interface BroadcastConnection {
  userId: string;
  sessionId: string;
  connected: boolean;
  lastActivity: number;
  send(message: unknown): Promise<void>;
  disconnect(): void;
}

/**
 * Operation Broadcaster class for real-time updates
 */
export class OperationBroadcaster {
  private connections: Map<string, BroadcastConnection> = new Map();
  private sessionUsers: Map<string, Set<string>> = new Map();
  private messageQueue: BroadcastMessage[] = [];
  private config: BroadcastConfig;
  private stats: BroadcastStats;
  private batchTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();
  private messageHistory: Map<string, BroadcastMessage> = new Map();

  constructor(config: Partial<BroadcastConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      messageTimeout: 30000,
      batchSize: 50,
      batchTimeout: 100,
      enableCompression: true,
      enableDeduplication: true,
      maxQueueSize: 1000,
      ...config
    };

    this.stats = {
      totalMessages: 0,
      successfulBroadcasts: 0,
      failedBroadcasts: 0,
      retriedMessages: 0,
      averageLatency: 0,
      queueSize: 0,
      activeConnections: 0
    };

    this.startBatchTimer();
  }

  /**
   * Add connection for broadcasting
   */
  addConnection(connection: BroadcastConnection): void {
    this.connections.set(connection.userId, connection);
    
    // Add user to session
    if (!this.sessionUsers.has(connection.sessionId)) {
      this.sessionUsers.set(connection.sessionId, new Set());
    }
    this.sessionUsers.get(connection.sessionId)!.add(connection.userId);
    
    this.stats.activeConnections = this.connections.size;
    this.emit('connectionAdded', { connection });
  }

  /**
   * Remove connection
   */
  removeConnection(userId: string): void {
    const connection = this.connections.get(userId);
    if (!connection) return;

    // Remove from session
    const sessionUsers = this.sessionUsers.get(connection.sessionId);
    if (sessionUsers) {
      sessionUsers.delete(userId);
      if (sessionUsers.size === 0) {
        this.sessionUsers.delete(connection.sessionId);
      }
    }

    this.connections.delete(userId);
    this.stats.activeConnections = this.connections.size;
    this.emit('connectionRemoved', { userId, connection });
  }

  /**
   * Broadcast operation to users
   */
  async broadcastOperation(
    operation: Operation,
    sessionId: string,
    target: BroadcastTarget = BroadcastTarget.SESSION_USERS,
    options?: {
      targetUsers?: string[];
      excludeUsers?: string[];
      priority?: BroadcastPriority;
    }
  ): Promise<void> {
    const message: BroadcastMessage = {
      id: this.generateMessageId(),
      type: 'operation',
      sessionId,
      sourceUserId: operation.userId,
      target,
      targetUsers: options?.targetUsers,
      excludeUsers: options?.excludeUsers,
      priority: options?.priority || BroadcastPriority.NORMAL,
      timestamp: Date.now(),
      data: { operation }
    };

    await this.queueMessage(message);
  }

  /**
   * Broadcast operation batch
   */
  async broadcastBatch(
    batch: OperationBatch,
    sessionId: string,
    target: BroadcastTarget = BroadcastTarget.SESSION_USERS,
    options?: {
      targetUsers?: string[];
      excludeUsers?: string[];
      priority?: BroadcastPriority;
    }
  ): Promise<void> {
    const message: BroadcastMessage = {
      id: this.generateMessageId(),
      type: 'batch',
      sessionId,
      sourceUserId: batch.userId,
      target,
      targetUsers: options?.targetUsers,
      excludeUsers: options?.excludeUsers,
      priority: options?.priority || BroadcastPriority.NORMAL,
      timestamp: Date.now(),
      data: { batch }
    };

    await this.queueMessage(message);
  }

  /**
   * Broadcast awareness update (cursor, selection, etc.)
   */
  async broadcastAwareness(
    awarenessData: unknown,
    sessionId: string,
    sourceUserId: string,
    target: BroadcastTarget = BroadcastTarget.SESSION_USERS,
    options?: {
      targetUsers?: string[];
      excludeUsers?: string[];
    }
  ): Promise<void> {
    const message: BroadcastMessage = {
      id: this.generateMessageId(),
      type: 'awareness',
      sessionId,
      sourceUserId,
      target,
      targetUsers: options?.targetUsers,
      excludeUsers: options?.excludeUsers,
      priority: BroadcastPriority.LOW, // Awareness updates are low priority
      timestamp: Date.now(),
      data: awarenessData
    };

    // Awareness updates don't need queuing, send immediately
    await this.sendMessage(message);
  }

  /**
   * Broadcast state update
   */
  async broadcastState(
    stateData: unknown,
    sessionId: string,
    sourceUserId: string,
    target: BroadcastTarget = BroadcastTarget.SESSION_USERS
  ): Promise<void> {
    const message: BroadcastMessage = {
      id: this.generateMessageId(),
      type: 'state',
      sessionId,
      sourceUserId,
      target,
      priority: BroadcastPriority.HIGH,
      timestamp: Date.now(),
      data: stateData
    };

    await this.queueMessage(message);
  }

  /**
   * Get users in session
   */
  getSessionUsers(sessionId: string): string[] {
    const users = this.sessionUsers.get(sessionId);
    return users ? Array.from(users) : [];
  }

  /**
   * Get active connections count
   */
  getActiveConnectionsCount(): number {
    return this.connections.size;
  }

  /**
   * Get broadcast statistics
   */
  getStats(): BroadcastStats {
    this.stats.queueSize = this.messageQueue.length;
    return { ...this.stats };
  }

  /**
   * Clear message queue
   */
  clearQueue(): void {
    this.messageQueue = [];
    this.stats.queueSize = 0;
  }

  /**
   * Add event listener
   */
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: (...args: unknown[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Queue message for broadcasting
   */
  private async queueMessage(message: BroadcastMessage): Promise<void> {
    // Check queue size limit
    if (this.messageQueue.length >= this.config.maxQueueSize) {
      // Remove oldest low-priority message
      const oldestLowPriority = this.messageQueue.findIndex(
        msg => msg.priority === BroadcastPriority.LOW
      );
      if (oldestLowPriority !== -1) {
        this.messageQueue.splice(oldestLowPriority, 1);
      } else {
        // Remove oldest message
        this.messageQueue.shift();
      }
    }

    // Check for duplicates if deduplication is enabled
    if (this.config.enableDeduplication && this.isDuplicateMessage(message)) {
      return;
    }

    // Insert message based on priority
    this.insertMessageByPriority(message);
    this.stats.totalMessages++;
    this.stats.queueSize = this.messageQueue.length;

    // Store in history for deduplication
    if (this.config.enableDeduplication) {
      this.messageHistory.set(this.getMessageHash(message), message);
    }
  }

  /**
   * Send message to target users
   */
  private async sendMessage(message: BroadcastMessage): Promise<void> {
    const targetUsers = this.getTargetUsers(message);
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    const sendPromises = targetUsers.map(async (userId) => {
      const connection = this.connections.get(userId);
      if (!connection || !connection.connected) {
        failureCount++;
        return;
      }

      try {
        await connection.send(this.prepareMessageForSending(message));
        successCount++;
      } catch (error) {
        failureCount++;
        this.emit('sendError', { userId, message, error });
      }
    });

    await Promise.allSettled(sendPromises);

    // Update statistics
    const latency = Date.now() - startTime;
    this.updateLatencyStats(latency);

    if (successCount > 0) {
      this.stats.successfulBroadcasts++;
    }
    if (failureCount > 0) {
      this.stats.failedBroadcasts++;
      
      // Retry if configured
      if ((message.retryCount || 0) < this.config.maxRetries) {
        await this.retryMessage(message);
      }
    }

    this.emit('messageSent', { message, successCount, failureCount });
  }

  /**
   * Get target users for message
   */
  private getTargetUsers(message: BroadcastMessage): string[] {
    let targetUsers: string[] = [];

    switch (message.target) {
      case BroadcastTarget.ALL_USERS:
        targetUsers = Array.from(this.connections.keys());
        break;
      
      case BroadcastTarget.SESSION_USERS:
        targetUsers = this.getSessionUsers(message.sessionId);
        break;
      
      case BroadcastTarget.SPECIFIC_USERS:
        targetUsers = message.targetUsers || [];
        break;
      
      case BroadcastTarget.EXCLUDE_USERS:
        const allUsers = this.getSessionUsers(message.sessionId);
        const excludeUsers = message.excludeUsers || [];
        targetUsers = allUsers.filter(userId => !excludeUsers.includes(userId));
        break;
    }

    // Always exclude the source user
    return targetUsers.filter(userId => userId !== message.sourceUserId);
  }

  /**
   * Prepare message for sending
   */
  private prepareMessageForSending(message: BroadcastMessage): unknown {
    let data = message.data;

    // Compress if enabled and beneficial
    if (this.config.enableCompression && this.shouldCompress(data)) {
      data = this.compressData(data);
    }

    return {
      id: message.id,
      type: message.type,
      sessionId: message.sessionId,
      sourceUserId: message.sourceUserId,
      timestamp: message.timestamp,
      data
    };
  }

  /**
   * Check if message should be compressed
   */
  private shouldCompress(data: unknown): boolean {
    const serialized = JSON.stringify(data);
    return serialized.length > 1024; // Compress if larger than 1KB
  }

  /**
   * Compress data (placeholder implementation)
   */
  private compressData(data: unknown): unknown {
    // In a real implementation, you would use a compression library
    return data;
  }

  /**
   * Insert message by priority
   */
  private insertMessageByPriority(message: BroadcastMessage): void {
    let insertIndex = this.messageQueue.length;
    
    // Find insertion point based on priority
    for (let i = 0; i < this.messageQueue.length; i++) {
      if (this.messageQueue[i].priority < message.priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.messageQueue.splice(insertIndex, 0, message);
  }

  /**
   * Check if message is duplicate
   */
  private isDuplicateMessage(message: BroadcastMessage): boolean {
    const hash = this.getMessageHash(message);
    return this.messageHistory.has(hash);
  }

  /**
   * Get message hash for deduplication
   */
  private getMessageHash(message: BroadcastMessage): string {
    const hashData = {
      type: message.type,
      sessionId: message.sessionId,
      sourceUserId: message.sourceUserId,
      data: message.data
    };
    return JSON.stringify(hashData);
  }

  /**
   * Retry failed message
   */
  private async retryMessage(message: BroadcastMessage): Promise<void> {
    const retryMessage = {
      ...message,
      retryCount: (message.retryCount || 0) + 1,
      timestamp: Date.now()
    };

    this.stats.retriedMessages++;

    setTimeout(() => {
      this.sendMessage(retryMessage);
    }, this.config.retryDelay * retryMessage.retryCount);
  }

  /**
   * Start batch processing timer
   */
  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      this.processBatch();
    }, this.config.batchTimeout);
  }

  /**
   * Process message batch
   */
  private async processBatch(): Promise<void> {
    if (this.messageQueue.length === 0) return;

    const batchSize = Math.min(this.config.batchSize, this.messageQueue.length);
    const batch = this.messageQueue.splice(0, batchSize);

    // Process messages in parallel
    const sendPromises = batch.map(message => this.sendMessage(message));
    await Promise.allSettled(sendPromises);

    this.stats.queueSize = this.messageQueue.length;
  }

  /**
   * Update latency statistics
   */
  private updateLatencyStats(latency: number): void {
    if (this.stats.averageLatency === 0) {
      this.stats.averageLatency = latency;
    } else {
      this.stats.averageLatency = (this.stats.averageLatency + latency) / 2;
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `broadcast-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in broadcaster event listener:', error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    this.connections.clear();
    this.sessionUsers.clear();
    this.messageQueue = [];
    this.messageHistory.clear();
    this.eventListeners.clear();
  }
}

/**
 * Create operation broadcaster instance
 */
export function createOperationBroadcaster(config?: Partial<BroadcastConfig>): OperationBroadcaster {
  return new OperationBroadcaster(config);
}
