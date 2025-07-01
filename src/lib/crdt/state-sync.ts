/**
 * State Synchronization Mechanisms
 * 
 * This module implements robust state synchronization for collaborative
 * editing, handling document state, user awareness, and conflict resolution.
 */

import * as Y from 'yjs';
import { Operation } from './operations';
import { DocumentState, CollaborativeUser } from './document';

/**
 * Synchronization state
 */
export enum SyncState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SYNCING = 'syncing',
  SYNCED = 'synced',
  ERROR = 'error'
}

/**
 * Sync event types
 */
export interface SyncEvents {
  stateChanged: (state: SyncState) => void;
  documentSynced: (state: DocumentState) => void;
  operationReceived: (operation: Operation) => void;
  conflictDetected: (conflict: unknown) => void;
  syncError: (error: Error) => void;
  userJoined: (user: CollaborativeUser) => void;
  userLeft: (userId: string) => void;
  awarenessUpdated: (awareness: Map<string, unknown>) => void;
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  syncInterval: number; // milliseconds
  heartbeatInterval: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  enableDeltaSync: boolean;
  enableCompression: boolean;
  maxSyncPayloadSize: number; // bytes
}

/**
 * Sync statistics
 */
export interface SyncStats {
  totalOperations: number;
  syncedOperations: number;
  pendingOperations: number;
  conflictsResolved: number;
  lastSyncTime: number;
  averageSyncTime: number;
  networkLatency: number;
}

/**
 * State Synchronizer class for managing collaborative state
 */
export class StateSynchronizer {
  private ydoc: Y.Doc;
  private state: SyncState = SyncState.DISCONNECTED;
  private config: SyncConfig;
  private eventListeners: Map<keyof SyncEvents, ((...args: unknown[]) => void)[]> = new Map();
  private syncTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pendingOperations: Map<string, Operation> = new Map();
  private acknowledgedOperations: Set<string> = new Set();
  private stats: SyncStats;
  private lastSyncVector: Map<string, number> = new Map();
  private retryCount: number = 0;

  constructor(ydoc: Y.Doc, config: Partial<SyncConfig> = {}) {
    this.ydoc = ydoc;
    this.config = {
      syncInterval: 100,
      heartbeatInterval: 30000,
      maxRetries: 5,
      retryDelay: 1000,
      enableDeltaSync: true,
      enableCompression: true,
      maxSyncPayloadSize: 1024 * 1024, // 1MB
      ...config
    };

    this.stats = {
      totalOperations: 0,
      syncedOperations: 0,
      pendingOperations: 0,
      conflictsResolved: 0,
      lastSyncTime: 0,
      averageSyncTime: 0,
      networkLatency: 0
    };

    this.setupDocumentListeners();
  }

  /**
   * Start synchronization
   */
  start(): void {
    if (this.state !== SyncState.DISCONNECTED) {
      return;
    }

    this.setState(SyncState.CONNECTING);
    this.startSyncTimer();
    this.startHeartbeat();
    this.setState(SyncState.CONNECTED);
  }

  /**
   * Stop synchronization
   */
  stop(): void {
    this.stopSyncTimer();
    this.stopHeartbeat();
    this.setState(SyncState.DISCONNECTED);
  }

  /**
   * Force immediate synchronization
   */
  async forceSync(): Promise<void> {
    if (this.state === SyncState.DISCONNECTED) {
      throw new Error('Cannot sync while disconnected');
    }

    await this.performSync();
  }

  /**
   * Add operation to pending queue
   */
  addPendingOperation(operation: Operation): void {
    const operationId = this.generateOperationId(operation);
    this.pendingOperations.set(operationId, operation);
    this.stats.pendingOperations = this.pendingOperations.size;
    this.stats.totalOperations++;
  }

  /**
   * Acknowledge operation as synced
   */
  acknowledgeOperation(operationId: string): void {
    if (this.pendingOperations.has(operationId)) {
      this.pendingOperations.delete(operationId);
      this.acknowledgedOperations.add(operationId);
      this.stats.syncedOperations++;
      this.stats.pendingOperations = this.pendingOperations.size;
    }
  }

  /**
   * Get current sync state
   */
  getState(): SyncState {
    return this.state;
  }

  /**
   * Get sync statistics
   */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * Get pending operations count
   */
  getPendingOperationsCount(): number {
    return this.pendingOperations.size;
  }

  /**
   * Check if document is fully synced
   */
  isSynced(): boolean {
    return this.state === SyncState.SYNCED && this.pendingOperations.size === 0;
  }

  /**
   * Get document state vector
   */
  getStateVector(): Uint8Array {
    return Y.encodeStateVector(this.ydoc);
  }

  /**
   * Apply state vector update
   */
  applyStateVector(stateVector: Uint8Array): Uint8Array | null {
    try {
      const update = Y.encodeStateAsUpdate(this.ydoc, stateVector);
      return update.length > 0 ? update : null;
    } catch (error) {
      this.emit('syncError', error as Error);
      return null;
    }
  }

  /**
   * Apply document update
   */
  applyUpdate(update: Uint8Array): void {
    try {
      Y.applyUpdate(this.ydoc, update);
      this.stats.lastSyncTime = Date.now();
    } catch (error) {
      this.emit('syncError', error as Error);
    }
  }

  /**
   * Get document delta since last sync
   */
  getDocumentDelta(): Uint8Array | null {
    if (!this.config.enableDeltaSync) {
      return Y.encodeStateAsUpdate(this.ydoc);
    }

    try {
      const currentVector = this.getStateVector();
      const lastVector = this.vectorMapToUint8Array(this.lastSyncVector);
      
      if (lastVector) {
        const delta = Y.encodeStateAsUpdate(this.ydoc, lastVector);
        this.lastSyncVector = this.uint8ArrayToVectorMap(currentVector);
        return delta.length > 0 ? delta : null;
      }

      return Y.encodeStateAsUpdate(this.ydoc);
    } catch (error) {
      this.emit('syncError', error as Error);
      return null;
    }
  }

  /**
   * Handle incoming sync message
   */
  handleSyncMessage(message: unknown): void {
    try {
      const msgObj = message as { type: string; [key: string]: unknown };
      switch (msgObj.type) {
        case 'stateVector':
          this.handleStateVectorMessage(msgObj);
          break;
        case 'update':
          this.handleUpdateMessage(msgObj);
          break;
        case 'ack':
          this.handleAckMessage(msgObj);
          break;
        case 'conflict':
          this.handleConflictMessage(msgObj);
          break;
        default:
          console.warn('Unknown sync message type:', msgObj.type);
      }
    } catch (error) {
      this.emit('syncError', error as Error);
    }
  }

  /**
   * Add event listener
   */
  on<K extends keyof SyncEvents>(event: K, callback: SyncEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback as (...args: unknown[]) => void);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof SyncEvents>(event: K, callback: SyncEvents[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback as (...args: unknown[]) => void);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Set synchronization state
   */
  private setState(newState: SyncState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.emit('stateChanged', newState);
    }
  }

  /**
   * Setup document event listeners
   */
  private setupDocumentListeners(): void {
    this.ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') {
        // Local update, add to pending operations
        const operation = this.createOperationFromUpdate(update);
        if (operation) {
          this.addPendingOperation(operation);
        }
      }
    });

    this.ydoc.on('destroy', () => {
      this.stop();
    });
  }

  /**
   * Start sync timer
   */
  private startSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.performSync().catch(error => {
        this.emit('syncError', error);
      });
    }, this.config.syncInterval);
  }

  /**
   * Stop sync timer
   */
  private stopSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Perform synchronization
   */
  private async performSync(): Promise<void> {
    if (this.state === SyncState.SYNCING) {
      return; // Already syncing
    }

    this.setState(SyncState.SYNCING);
    const startTime = performance.now();

    try {
      // Get document delta
      const delta = this.getDocumentDelta();
      
      if (delta && delta.length > 0) {
        // Send update to peers
        await this.sendUpdate(delta);
      }

      // Request state vector from peers
      await this.requestStateVector();

      this.setState(SyncState.SYNCED);
      this.retryCount = 0;

      // Update statistics
      const syncTime = performance.now() - startTime;
      this.updateSyncStats(syncTime);

    } catch (error) {
      this.handleSyncError(error as Error);
    }
  }

  /**
   * Send document update
   */
  private async sendUpdate(update: Uint8Array): Promise<void> {
    // Compress if enabled and beneficial
    let payload = update;
    if (this.config.enableCompression && update.length > 1024) {
      payload = this.compressUpdate(update);
    }

    // Check payload size
    if (payload.length > this.config.maxSyncPayloadSize) {
      throw new Error('Sync payload too large');
    }

    // This would send to the WebSocket or network layer
    // For now, we'll emit an event
    this.emit('operationReceived', {
      type: 'update',
      payload,
      timestamp: Date.now()
    } as unknown as Operation);
  }

  /**
   * Request state vector from peers
   */
  private async requestStateVector(): Promise<void> {
    const stateVector = this.getStateVector();
    
    // This would send to the WebSocket or network layer
    this.emit('operationReceived', {
      type: 'stateVectorRequest',
      stateVector,
      timestamp: Date.now()
    } as unknown as Operation);
  }

  /**
   * Send heartbeat
   */
  private sendHeartbeat(): void {
    // This would send to the WebSocket or network layer
    this.emit('operationReceived', {
      type: 'heartbeat',
      timestamp: Date.now()
    } as unknown as Operation);
  }

  /**
   * Handle sync error
   */
  private handleSyncError(error: Error): void {
    this.retryCount++;
    
    if (this.retryCount <= this.config.maxRetries) {
      // Retry after delay
      setTimeout(() => {
        this.performSync().catch(e => this.emit('syncError', e));
      }, this.config.retryDelay * this.retryCount);
    } else {
      this.setState(SyncState.ERROR);
      this.emit('syncError', error);
    }
  }

  /**
   * Handle state vector message
   */
  private handleStateVectorMessage(message: unknown): void {
    const msgObj = message as { stateVector: Uint8Array };
    const update = this.applyStateVector(msgObj.stateVector);
    if (update) {
      this.sendUpdate(update);
    }
  }

  /**
   * Handle update message
   */
  private handleUpdateMessage(message: unknown): void {
    const msgObj = message as { payload: Uint8Array };
    this.applyUpdate(msgObj.payload);
  }

  /**
   * Handle acknowledgment message
   */
  private handleAckMessage(message: unknown): void {
    const msgObj = message as { operationId: string };
    this.acknowledgeOperation(msgObj.operationId);
  }

  /**
   * Handle conflict message
   */
  private handleConflictMessage(message: unknown): void {
    this.stats.conflictsResolved++;
    const msgObj = message as { conflict: unknown };
    this.emit('conflictDetected', msgObj.conflict);
  }

  /**
   * Create operation from Yjs update
   */
  private createOperationFromUpdate(_update: Uint8Array): Operation | null {
    // This is a simplified implementation
    // In practice, you'd decode the update and create proper operations
    // Returning null for now as this is a placeholder
    return null;
  }

  /**
   * Generate operation ID
   */
  private generateOperationId(operation: Operation): string {
    return `${operation.userId}-${operation.timestamp}-${operation.type}-${operation.position}`;
  }

  /**
   * Compress update data
   */
  private compressUpdate(update: Uint8Array): Uint8Array {
    // Simple compression placeholder
    // In practice, you'd use a proper compression algorithm
    return update;
  }

  /**
   * Convert vector map to Uint8Array
   */
  private vectorMapToUint8Array(vectorMap: Map<string, number>): Uint8Array | null {
    if (vectorMap.size === 0) return null;
    
    // Simplified conversion
    const array = new Uint8Array(vectorMap.size * 8);
    let offset = 0;
    
    for (const [_client, clock] of vectorMap) {
      // This is a simplified implementation
      array[offset++] = clock & 0xFF;
    }
    
    return array;
  }

  /**
   * Convert Uint8Array to vector map
   */
  private uint8ArrayToVectorMap(array: Uint8Array): Map<string, number> {
    const map = new Map<string, number>();
    
    // Simplified conversion
    for (let i = 0; i < array.length; i++) {
      map.set(`client-${i}`, array[i]);
    }
    
    return map;
  }

  /**
   * Update sync statistics
   */
  private updateSyncStats(syncTime: number): void {
    this.stats.lastSyncTime = Date.now();
    
    // Update average sync time
    if (this.stats.averageSyncTime === 0) {
      this.stats.averageSyncTime = syncTime;
    } else {
      this.stats.averageSyncTime = (this.stats.averageSyncTime + syncTime) / 2;
    }
  }

  /**
   * Emit event
   */
  private emit<K extends keyof SyncEvents>(event: K, ...args: Parameters<SyncEvents[K]>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error('Error in sync event listener:', error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    this.pendingOperations.clear();
    this.acknowledgedOperations.clear();
    this.eventListeners.clear();
  }
}

/**
 * Create state synchronizer instance
 */
export function createStateSynchronizer(
  ydoc: Y.Doc,
  config?: Partial<SyncConfig>
): StateSynchronizer {
  return new StateSynchronizer(ydoc, config);
}
