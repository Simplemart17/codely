/**
 * Offline/Online State Handling System
 * 
 * This module handles graceful transitions between offline and online states,
 * ensuring data persistence and synchronization when connectivity is restored.
 */

import * as Y from 'yjs';
import { Operation, OperationBatch } from './operations';
import { DocumentState } from './document';

/**
 * Connection states
 */
export enum ConnectionState {
  ONLINE = 'online',
  OFFLINE = 'offline',
  RECONNECTING = 'reconnecting',
  UNSTABLE = 'unstable'
}

/**
 * Offline storage interface
 */
export interface OfflineStorage {
  save(key: string, data: unknown): Promise<void>;
  load(key: string): Promise<unknown>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * Offline configuration
 */
export interface OfflineConfig {
  enableOfflineMode: boolean;
  maxOfflineOperations: number;
  syncRetryInterval: number; // milliseconds
  maxRetryAttempts: number;
  persistenceKey: string;
  autoSaveInterval: number; // milliseconds
  conflictResolutionStrategy: 'last-write-wins' | 'manual' | 'merge';
}

/**
 * Offline events
 */
export interface OfflineEvents {
  connectionChanged: (state: ConnectionState) => void;
  offlineOperationStored: (operation: Operation) => void;
  syncStarted: () => void;
  syncCompleted: (syncedOperations: number) => void;
  syncFailed: (error: Error) => void;
  conflictDetected: (conflicts: unknown[]) => void;
  dataRestored: (documentState: DocumentState) => void;
}

/**
 * Offline statistics
 */
export interface OfflineStats {
  offlineOperations: number;
  lastSyncTime: number;
  totalOfflineTime: number;
  syncAttempts: number;
  successfulSyncs: number;
  failedSyncs: number;
}

/**
 * Offline Handler class for managing offline/online transitions
 */
export class OfflineHandler {
  private ydoc: Y.Doc;
  private config: OfflineConfig;
  private storage: OfflineStorage;
  private connectionState: ConnectionState = ConnectionState.ONLINE;
  private offlineOperations: Operation[] = [];
  private eventListeners: Map<keyof OfflineEvents, ((...args: unknown[]) => void)[]> = new Map();
  private syncTimer: NodeJS.Timeout | null = null;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private stats: OfflineStats;
  private lastOnlineTime: number = Date.now();
  private retryAttempts: number = 0;

  constructor(
    ydoc: Y.Doc,
    storage: OfflineStorage,
    config: Partial<OfflineConfig> = {}
  ) {
    this.ydoc = ydoc;
    this.storage = storage;
    this.config = {
      enableOfflineMode: true,
      maxOfflineOperations: 1000,
      syncRetryInterval: 5000,
      maxRetryAttempts: 10,
      persistenceKey: 'crdt-offline-data',
      autoSaveInterval: 30000,
      conflictResolutionStrategy: 'last-write-wins',
      ...config
    };

    this.stats = {
      offlineOperations: 0,
      lastSyncTime: Date.now(),
      totalOfflineTime: 0,
      syncAttempts: 0,
      successfulSyncs: 0,
      failedSyncs: 0
    };

    this.setupNetworkListeners();
    this.setupDocumentListeners();
    this.startAutoSave();
    this.restoreOfflineData();
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    return this.connectionState === ConnectionState.OFFLINE;
  }

  /**
   * Check if offline mode is enabled
   */
  isOfflineModeEnabled(): boolean {
    return this.config.enableOfflineMode;
  }

  /**
   * Manually set connection state
   */
  setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      const previousState = this.connectionState;
      this.connectionState = state;

      this.handleConnectionStateChange(previousState, state);
      this.emit('connectionChanged', state);
    }
  }

  /**
   * Add operation to offline queue
   */
  addOfflineOperation(operation: Operation): boolean {
    if (!this.config.enableOfflineMode) {
      return false;
    }

    if (this.offlineOperations.length >= this.config.maxOfflineOperations) {
      // Remove oldest operation to make space
      this.offlineOperations.shift();
    }

    this.offlineOperations.push(operation);
    this.stats.offlineOperations = this.offlineOperations.length;

    this.emit('offlineOperationStored', operation);
    this.saveOfflineData();

    return true;
  }

  /**
   * Get offline operations
   */
  getOfflineOperations(): Operation[] {
    return [...this.offlineOperations];
  }

  /**
   * Clear offline operations
   */
  clearOfflineOperations(): void {
    this.offlineOperations = [];
    this.stats.offlineOperations = 0;
    this.saveOfflineData();
  }

  /**
   * Sync offline operations when back online
   */
  async syncOfflineOperations(): Promise<void> {
    if (this.isOffline() || this.offlineOperations.length === 0) {
      return;
    }

    this.emit('syncStarted');
    this.stats.syncAttempts++;

    try {
      // Group operations into batches
      const batches = this.createOperationBatches(this.offlineOperations);
      let syncedCount = 0;

      for (const batch of batches) {
        await this.syncBatch(batch);
        syncedCount += batch.operations.length;
      }

      // Clear synced operations
      this.clearOfflineOperations();
      this.stats.successfulSyncs++;
      this.stats.lastSyncTime = Date.now();
      this.retryAttempts = 0;

      this.emit('syncCompleted', syncedCount);
    } catch (error) {
      this.stats.failedSyncs++;
      this.retryAttempts++;

      if (this.retryAttempts < this.config.maxRetryAttempts) {
        // Schedule retry
        this.scheduleSyncRetry();
      }

      this.emit('syncFailed', error as Error);
      throw error;
    }
  }

  /**
   * Get offline statistics
   */
  getStats(): OfflineStats {
    return { ...this.stats };
  }

  /**
   * Export offline data for backup
   */
  async exportOfflineData(): Promise<unknown> {
    const documentState = Y.encodeStateAsUpdate(this.ydoc);
    
    return {
      documentState: Array.from(documentState),
      offlineOperations: this.offlineOperations,
      stats: this.stats,
      timestamp: Date.now()
    };
  }

  /**
   * Import offline data from backup
   */
  async importOfflineData(data: unknown): Promise<void> {
    try {
      const dataObj = data as {
        documentState?: number[];
        offlineOperations?: Operation[];
        stats?: Partial<OfflineStats>
      };

      if (dataObj.documentState) {
        const update = new Uint8Array(dataObj.documentState);
        Y.applyUpdate(this.ydoc, update);
      }

      if (dataObj.offlineOperations) {
        this.offlineOperations = dataObj.offlineOperations;
        this.stats.offlineOperations = this.offlineOperations.length;
      }

      if (dataObj.stats) {
        this.stats = { ...this.stats, ...dataObj.stats };
      }

      await this.saveOfflineData();
      
      const documentState = this.getDocumentState();
      this.emit('dataRestored', documentState);
    } catch (error) {
      console.error('Failed to import offline data:', error);
      throw error;
    }
  }

  /**
   * Add event listener
   */
  on<K extends keyof OfflineEvents>(event: K, callback: OfflineEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback as (...args: unknown[]) => void);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof OfflineEvents>(event: K, callback: OfflineEvents[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback as (...args: unknown[]) => void);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Setup network connectivity listeners
   */
  private setupNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.setConnectionState(ConnectionState.ONLINE);
      });

      window.addEventListener('offline', () => {
        this.setConnectionState(ConnectionState.OFFLINE);
      });

      // Initial state
      this.setConnectionState(
        navigator.onLine ? ConnectionState.ONLINE : ConnectionState.OFFLINE
      );
    }
  }

  /**
   * Setup document event listeners
   */
  private setupDocumentListeners(): void {
    this.ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote' && this.isOffline()) {
        // Local update while offline, store it
        const operation = this.createOperationFromUpdate(update);
        if (operation) {
          this.addOfflineOperation(operation);
        }
      }
    });
  }

  /**
   * Handle connection state changes
   */
  private handleConnectionStateChange(
    previousState: ConnectionState,
    newState: ConnectionState
  ): void {
    if (previousState === ConnectionState.OFFLINE && newState === ConnectionState.ONLINE) {
      // Coming back online
      this.stats.totalOfflineTime += Date.now() - this.lastOnlineTime;
      this.syncOfflineOperations().catch(error => {
        console.error('Failed to sync offline operations:', error);
      });
    } else if (previousState === ConnectionState.ONLINE && newState === ConnectionState.OFFLINE) {
      // Going offline
      this.lastOnlineTime = Date.now();
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(() => {
      this.saveOfflineData();
    }, this.config.autoSaveInterval);
  }

  /**
   * Save offline data to storage
   */
  private async saveOfflineData(): Promise<void> {
    try {
      const data = await this.exportOfflineData();
      await this.storage.save(this.config.persistenceKey, data);
    } catch (error) {
      console.error('Failed to save offline data:', error);
    }
  }

  /**
   * Restore offline data from storage
   */
  private async restoreOfflineData(): Promise<void> {
    try {
      const data = await this.storage.load(this.config.persistenceKey);
      if (data) {
        await this.importOfflineData(data);
      }
    } catch (error) {
      console.error('Failed to restore offline data:', error);
    }
  }

  /**
   * Create operation batches for syncing
   */
  private createOperationBatches(operations: Operation[]): OperationBatch[] {
    const batches: OperationBatch[] = [];
    const batchSize = 50; // Operations per batch

    for (let i = 0; i < operations.length; i += batchSize) {
      const batchOps = operations.slice(i, i + batchSize);
      const batch: OperationBatch = {
        operations: batchOps,
        timestamp: Date.now(),
        userId: batchOps[0]?.userId || 'unknown',
        sessionId: batchOps[0]?.sessionId || 'unknown'
      };
      batches.push(batch);
    }

    return batches;
  }

  /**
   * Sync a single batch of operations
   */
  private async syncBatch(_batch: OperationBatch): Promise<void> {
    // This would send the batch to the server or apply to CRDT
    // For now, we'll simulate the sync process
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          resolve();
        } else {
          reject(new Error('Sync failed'));
        }
      }, 100);
    });
  }

  /**
   * Schedule sync retry
   */
  private scheduleSyncRetry(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    const delay = this.config.syncRetryInterval * Math.pow(2, this.retryAttempts - 1);
    
    this.syncTimer = setTimeout(() => {
      this.syncOfflineOperations().catch(error => {
        console.error('Retry sync failed:', error);
      });
    }, delay);
  }

  /**
   * Create operation from Yjs update
   */
  private createOperationFromUpdate(_update: Uint8Array): Operation | null {
    // Simplified operation creation - returning null for placeholder
    return null;
  }

  /**
   * Get current document state
   */
  private getDocumentState(): DocumentState {
    return {
      content: this.ydoc.getText('monaco').toString(),
      language: 'javascript',
      cursors: new Map(),
      users: new Map(),
      lastModified: Date.now()
    };
  }

  /**
   * Emit event
   */
  private emit<K extends keyof OfflineEvents>(
    event: K,
    ...args: Parameters<OfflineEvents[K]>
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error('Error in offline event listener:', error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.eventListeners.clear();
  }
}

/**
 * IndexedDB storage implementation
 */
export class IndexedDBStorage implements OfflineStorage {
  private dbName: string;
  private version: number;
  private db: IDBDatabase | null = null;

  constructor(dbName: string = 'crdt-offline', version: number = 1) {
    this.dbName = dbName;
    this.version = version;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('offline-data')) {
          db.createObjectStore('offline-data');
        }
      };
    });
  }

  async save(key: string, data: unknown): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline-data'], 'readwrite');
      const store = transaction.objectStore('offline-data');
      const request = store.put(data, key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async load(key: string): Promise<unknown> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline-data'], 'readonly');
      const store = transaction.objectStore('offline-data');
      const request = store.get(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async remove(key: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline-data'], 'readwrite');
      const store = transaction.objectStore('offline-data');
      const request = store.delete(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline-data'], 'readwrite');
      const store = transaction.objectStore('offline-data');
      const request = store.clear();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async keys(): Promise<string[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline-data'], 'readonly');
      const store = transaction.objectStore('offline-data');
      const request = store.getAllKeys();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }
}

/**
 * Create offline handler instance
 */
export function createOfflineHandler(
  ydoc: Y.Doc,
  storage?: OfflineStorage,
  config?: Partial<OfflineConfig>
): OfflineHandler {
  const defaultStorage = storage || new IndexedDBStorage();
  return new OfflineHandler(ydoc, defaultStorage, config);
}
