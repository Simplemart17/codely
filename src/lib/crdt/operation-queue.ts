/**
 * Operation Queuing and Batching System
 * 
 * This module implements efficient operation queuing, batching, and
 * processing for collaborative editing operations.
 */

import { Operation, OperationBatch, OperationType } from './operations';

/**
 * Queue configuration
 */
export interface QueueConfig {
  maxBatchSize: number;
  batchTimeout: number; // milliseconds
  maxQueueSize: number;
  priorityLevels: number;
  enableCompression: boolean;
  retryAttempts: number;
  retryDelay: number; // milliseconds
}

/**
 * Operation priority levels
 */
export enum OperationPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Queued operation wrapper
 */
export interface QueuedOperation {
  operation: Operation;
  priority: OperationPriority;
  timestamp: number;
  retryCount: number;
  batchId?: string;
}

/**
 * Batch processing result
 */
export interface BatchResult {
  batchId: string;
  success: boolean;
  processedOperations: Operation[];
  failedOperations: Operation[];
  error?: Error;
  processingTime: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  totalOperations: number;
  pendingOperations: number;
  processedOperations: number;
  failedOperations: number;
  averageBatchSize: number;
  averageProcessingTime: number;
  queueUtilization: number;
}

/**
 * Operation Queue class for managing collaborative operations
 */
export class OperationQueue {
  private queues: Map<OperationPriority, QueuedOperation[]> = new Map();
  private processingBatches: Map<string, OperationBatch> = new Map();
  private config: QueueConfig;
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private stats: QueueStats;
  private eventListeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxBatchSize: 50,
      batchTimeout: 100,
      maxQueueSize: 1000,
      priorityLevels: 4,
      enableCompression: true,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };

    this.stats = {
      totalOperations: 0,
      pendingOperations: 0,
      processedOperations: 0,
      failedOperations: 0,
      averageBatchSize: 0,
      averageProcessingTime: 0,
      queueUtilization: 0
    };

    this.initializeQueues();
  }

  /**
   * Add operation to queue
   */
  enqueue(operation: Operation, priority: OperationPriority = OperationPriority.NORMAL): boolean {
    if (this.getTotalQueueSize() >= this.config.maxQueueSize) {
      this.emit('queueFull', { operation, priority });
      return false;
    }

    const queuedOperation: QueuedOperation = {
      operation,
      priority,
      timestamp: Date.now(),
      retryCount: 0
    };

    const queue = this.queues.get(priority)!;
    queue.push(queuedOperation);

    this.stats.totalOperations++;
    this.stats.pendingOperations++;
    this.updateQueueUtilization();

    this.emit('operationEnqueued', queuedOperation);

    // Start batch timer if not already running
    this.startBatchTimer();

    return true;
  }

  /**
   * Process next batch of operations
   */
  async processBatch(): Promise<BatchResult | null> {
    if (this.isProcessing || this.getTotalQueueSize() === 0) {
      return null;
    }

    this.isProcessing = true;
    const startTime = performance.now();

    try {
      // Collect operations for batch
      const operations = this.collectOperationsForBatch();
      
      if (operations.length === 0) {
        this.isProcessing = false;
        return null;
      }

      // Create batch
      const batchId = this.generateBatchId();
      const batch: OperationBatch = {
        operations: operations.map(qo => qo.operation),
        timestamp: Date.now(),
        userId: operations[0].operation.userId,
        sessionId: operations[0].operation.sessionId
      };

      // Mark operations with batch ID
      operations.forEach(qo => qo.batchId = batchId);

      this.processingBatches.set(batchId, batch);

      // Compress batch if enabled
      if (this.config.enableCompression) {
        this.compressBatch(batch);
      }

      // Process batch
      const result = await this.executeBatch(batch);
      
      // Update statistics
      const processingTime = performance.now() - startTime;
      this.updateStats(result, processingTime);

      // Clean up
      this.processingBatches.delete(batchId);
      this.isProcessing = false;

      this.emit('batchProcessed', result);

      return result;
    } catch (error) {
      this.isProcessing = false;
      const result: BatchResult = {
        batchId: 'error',
        success: false,
        processedOperations: [],
        failedOperations: [],
        error: error as Error,
        processingTime: performance.now() - startTime
      };

      this.emit('batchError', result);
      return result;
    }
  }

  /**
   * Retry failed operations
   */
  async retryFailedOperations(operations: Operation[]): Promise<void> {
    for (const operation of operations) {
      const queuedOp = this.findQueuedOperation(operation);
      
      if (queuedOp && queuedOp.retryCount < this.config.retryAttempts) {
        queuedOp.retryCount++;
        
        // Add delay before retry
        setTimeout(() => {
          this.enqueue(operation, OperationPriority.HIGH);
        }, this.config.retryDelay * queuedOp.retryCount);
      } else {
        this.stats.failedOperations++;
        this.emit('operationFailed', operation);
      }
    }
  }

  /**
   * Clear queue for specific priority
   */
  clearQueue(priority?: OperationPriority): number {
    let clearedCount = 0;

    if (priority !== undefined) {
      const queue = this.queues.get(priority);
      if (queue) {
        clearedCount = queue.length;
        queue.length = 0;
      }
    } else {
      // Clear all queues
      for (const queue of this.queues.values()) {
        clearedCount += queue.length;
        queue.length = 0;
      }
    }

    this.stats.pendingOperations -= clearedCount;
    this.updateQueueUtilization();

    this.emit('queueCleared', { priority, clearedCount });

    return clearedCount;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Get queue size for priority level
   */
  getQueueSize(priority: OperationPriority): number {
    return this.queues.get(priority)?.length || 0;
  }

  /**
   * Get total queue size
   */
  getTotalQueueSize(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.getTotalQueueSize() === 0;
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.emit('queuePaused');
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.startBatchTimer();
    this.emit('queueResumed');
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
   * Initialize priority queues
   */
  private initializeQueues(): void {
    for (let i = 0; i < this.config.priorityLevels; i++) {
      this.queues.set(i as OperationPriority, []);
    }
  }

  /**
   * Start batch processing timer
   */
  private startBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.config.batchTimeout);
  }

  /**
   * Collect operations for next batch
   */
  private collectOperationsForBatch(): QueuedOperation[] {
    const operations: QueuedOperation[] = [];
    let remainingBatchSize = this.config.maxBatchSize;

    // Process queues by priority (highest first)
    for (let priority = this.config.priorityLevels - 1; priority >= 0; priority--) {
      const queue = this.queues.get(priority as OperationPriority);
      if (!queue || queue.length === 0) continue;

      while (queue.length > 0 && remainingBatchSize > 0) {
        const operation = queue.shift()!;
        operations.push(operation);
        remainingBatchSize--;
        this.stats.pendingOperations--;
      }

      if (remainingBatchSize === 0) break;
    }

    return operations;
  }

  /**
   * Execute batch of operations
   */
  private async executeBatch(batch: OperationBatch): Promise<BatchResult> {
    const batchId = this.generateBatchId();
    const processedOperations: Operation[] = [];
    const failedOperations: Operation[] = [];

    try {
      // Simulate batch processing
      // In a real implementation, this would send the batch to the server
      // or apply operations to the CRDT document
      
      for (const operation of batch.operations) {
        try {
          // Simulate operation processing
          await this.processOperation(operation);
          processedOperations.push(operation);
        } catch {
          failedOperations.push(operation);
        }
      }

      return {
        batchId,
        success: failedOperations.length === 0,
        processedOperations,
        failedOperations,
        processingTime: 0 // Will be set by caller
      };
    } catch (error) {
      return {
        batchId,
        success: false,
        processedOperations,
        failedOperations: batch.operations,
        error: error as Error,
        processingTime: 0
      };
    }
  }

  /**
   * Process individual operation
   */
  private async processOperation(_operation: Operation): Promise<void> {
    // Simulate operation processing delay
    await new Promise(resolve => setTimeout(resolve, 1));
    
    // Simulate occasional failures
    if (Math.random() < 0.01) { // 1% failure rate
      throw new Error('Simulated operation failure');
    }
  }

  /**
   * Compress batch operations
   */
  private compressBatch(batch: OperationBatch): void {
    // Simple compression: merge consecutive operations of the same type
    const compressed: Operation[] = [];
    let current: Operation | null = null;

    for (const operation of batch.operations) {
      if (current && this.canMergeOperations(current, operation)) {
        current = this.mergeOperations(current, operation);
      } else {
        if (current) {
          compressed.push(current);
        }
        current = operation;
      }
    }

    if (current) {
      compressed.push(current);
    }

    batch.operations = compressed;
  }

  /**
   * Check if two operations can be merged
   */
  private canMergeOperations(op1: Operation, op2: Operation): boolean {
    return (
      op1.type === op2.type &&
      op1.userId === op2.userId &&
      op1.sessionId === op2.sessionId &&
      op1.type === OperationType.INSERT &&
      op2.position === op1.position + ((op1 as { content?: string }).content?.length || 0)
    );
  }

  /**
   * Merge two operations
   */
  private mergeOperations(op1: Operation, op2: Operation): Operation {
    if (op1.type === OperationType.INSERT && op2.type === OperationType.INSERT) {
      return {
        ...op1,
        content: ((op1 as { content?: string }).content || '') + ((op2 as { content?: string }).content || ''),
        timestamp: Math.max(op1.timestamp, op2.timestamp)
      } as unknown as Operation;
    }
    return op2;
  }

  /**
   * Find queued operation
   */
  private findQueuedOperation(operation: Operation): QueuedOperation | null {
    for (const queue of this.queues.values()) {
      const found = queue.find(qo => 
        qo.operation.type === operation.type &&
        qo.operation.position === operation.position &&
        qo.operation.userId === operation.userId &&
        qo.operation.timestamp === operation.timestamp
      );
      if (found) return found;
    }
    return null;
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Update statistics
   */
  private updateStats(result: BatchResult, processingTime: number): void {
    this.stats.processedOperations += result.processedOperations.length;
    this.stats.failedOperations += result.failedOperations.length;
    
    // Update average batch size
    const totalBatches = this.stats.processedOperations / this.stats.averageBatchSize || 1;
    this.stats.averageBatchSize = (
      (this.stats.averageBatchSize * (totalBatches - 1) + result.processedOperations.length) / totalBatches
    );

    // Update average processing time
    this.stats.averageProcessingTime = (
      (this.stats.averageProcessingTime * (totalBatches - 1) + processingTime) / totalBatches
    );

    this.updateQueueUtilization();
  }

  /**
   * Update queue utilization
   */
  private updateQueueUtilization(): void {
    this.stats.queueUtilization = this.getTotalQueueSize() / this.config.maxQueueSize;
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
          console.error('Error in queue event listener:', error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.pause();
    this.clearQueue();
    this.processingBatches.clear();
    this.eventListeners.clear();
  }
}

/**
 * Create operation queue instance
 */
export function createOperationQueue(config?: Partial<QueueConfig>): OperationQueue {
  return new OperationQueue(config);
}
