/**
 * Operation Transformation Logic for CRDT
 * 
 * This module implements operation transformation and conflict resolution
 * for collaborative editing using Yjs CRDT algorithms.
 */

import * as Y from 'yjs';

/**
 * Operation types for collaborative editing
 */
export enum OperationType {
  INSERT = 'insert',
  DELETE = 'delete',
  RETAIN = 'retain',
  FORMAT = 'format'
}

/**
 * Base operation interface
 */
export interface BaseOperation {
  type: OperationType;
  position: number;
  timestamp: number;
  userId: string;
  sessionId: string;
}

/**
 * Insert operation
 */
export interface InsertOperation extends BaseOperation {
  type: OperationType.INSERT;
  content: string;
  attributes?: Record<string, unknown>;
}

/**
 * Delete operation
 */
export interface DeleteOperation extends BaseOperation {
  type: OperationType.DELETE;
  length: number;
}

/**
 * Retain operation (for formatting)
 */
export interface RetainOperation extends BaseOperation {
  type: OperationType.RETAIN;
  length: number;
  attributes?: Record<string, unknown>;
}

/**
 * Format operation
 */
export interface FormatOperation extends BaseOperation {
  type: OperationType.FORMAT;
  length: number;
  attributes: Record<string, unknown>;
}

/**
 * Union type for all operations
 */
export type Operation = InsertOperation | DeleteOperation | RetainOperation | FormatOperation;

/**
 * Operation result after transformation
 */
export interface TransformResult {
  operation: Operation;
  transformed: boolean;
  conflicts: string[];
}

/**
 * Batch of operations
 */
export interface OperationBatch {
  operations: Operation[];
  timestamp: number;
  userId: string;
  sessionId: string;
}

/**
 * Operation Transformer class for handling operation transformation
 */
export class OperationTransformer {
  private pendingOperations: Map<string, Operation[]> = new Map();
  private operationHistory: Operation[] = [];
  private maxHistorySize: number = 1000;

  /**
   * Transform an operation against another operation
   */
  transform(op1: Operation, op2: Operation): TransformResult {
    const conflicts: string[] = [];
    let transformed = false;

    // If operations are from the same user, no transformation needed
    if (op1.userId === op2.userId) {
      return { operation: op1, transformed: false, conflicts };
    }

    let transformedOp: Operation = { ...op1 };

    // Transform based on operation types
    switch (op1.type) {
      case OperationType.INSERT:
        transformedOp = this.transformInsert(op1 as InsertOperation, op2, conflicts);
        transformed = true;
        break;
      
      case OperationType.DELETE:
        transformedOp = this.transformDelete(op1 as DeleteOperation, op2, conflicts);
        transformed = true;
        break;
      
      case OperationType.RETAIN:
        transformedOp = this.transformRetain(op1 as RetainOperation, op2, conflicts);
        transformed = true;
        break;
      
      case OperationType.FORMAT:
        transformedOp = this.transformFormat(op1 as FormatOperation, op2, conflicts);
        transformed = true;
        break;
    }

    return { operation: transformedOp, transformed, conflicts };
  }

  /**
   * Transform insert operation
   */
  private transformInsert(
    insertOp: InsertOperation, 
    otherOp: Operation, 
    conflicts: string[]
  ): InsertOperation {
    const transformed = { ...insertOp };

    switch (otherOp.type) {
      case OperationType.INSERT:
        // Both operations insert at the same position
        if (insertOp.position === otherOp.position) {
          // Use timestamp to determine order
          if (insertOp.timestamp > otherOp.timestamp) {
            transformed.position += (otherOp as InsertOperation).content.length;
          } else if (insertOp.timestamp === otherOp.timestamp) {
            // Use user ID as tiebreaker
            if (insertOp.userId > otherOp.userId) {
              transformed.position += (otherOp as InsertOperation).content.length;
            }
          }
        } else if (otherOp.position < insertOp.position) {
          // Other insert is before this insert
          transformed.position += (otherOp as InsertOperation).content.length;
        }
        break;

      case OperationType.DELETE:
        const deleteOp = otherOp as DeleteOperation;
        if (deleteOp.position < insertOp.position) {
          // Delete is before insert position
          transformed.position = Math.max(
            deleteOp.position,
            insertOp.position - deleteOp.length
          );
        } else if (deleteOp.position < insertOp.position + insertOp.content.length) {
          // Delete overlaps with insert
          conflicts.push(`Insert-Delete conflict at position ${insertOp.position}`);
        }
        break;
    }

    return transformed;
  }

  /**
   * Transform delete operation
   */
  private transformDelete(
    deleteOp: DeleteOperation, 
    otherOp: Operation, 
    conflicts: string[]
  ): DeleteOperation {
    const transformed = { ...deleteOp };

    switch (otherOp.type) {
      case OperationType.INSERT:
        const insertOp = otherOp as InsertOperation;
        if (insertOp.position <= deleteOp.position) {
          // Insert is before delete position
          transformed.position += insertOp.content.length;
        } else if (insertOp.position < deleteOp.position + deleteOp.length) {
          // Insert is within delete range
          transformed.length += insertOp.content.length;
          conflicts.push(`Delete-Insert conflict at position ${deleteOp.position}`);
        }
        break;

      case OperationType.DELETE:
        const otherDeleteOp = otherOp as DeleteOperation;
        if (otherDeleteOp.position < deleteOp.position) {
          // Other delete is before this delete
          transformed.position = Math.max(
            otherDeleteOp.position,
            deleteOp.position - otherDeleteOp.length
          );
        } else if (otherDeleteOp.position < deleteOp.position + deleteOp.length) {
          // Deletes overlap
          const overlapStart = Math.max(deleteOp.position, otherDeleteOp.position);
          const overlapEnd = Math.min(
            deleteOp.position + deleteOp.length,
            otherDeleteOp.position + otherDeleteOp.length
          );
          const overlapLength = Math.max(0, overlapEnd - overlapStart);
          
          transformed.length = Math.max(0, deleteOp.length - overlapLength);
          conflicts.push(`Delete-Delete overlap at position ${overlapStart}`);
        }
        break;
    }

    return transformed;
  }

  /**
   * Transform retain operation
   */
  private transformRetain(
    retainOp: RetainOperation, 
    otherOp: Operation, 
    _conflicts: string[]
  ): RetainOperation {
    const transformed = { ...retainOp };

    switch (otherOp.type) {
      case OperationType.INSERT:
        const insertOp = otherOp as InsertOperation;
        if (insertOp.position <= retainOp.position) {
          transformed.position += insertOp.content.length;
        }
        break;

      case OperationType.DELETE:
        const deleteOp = otherOp as DeleteOperation;
        if (deleteOp.position < retainOp.position) {
          transformed.position = Math.max(
            deleteOp.position,
            retainOp.position - deleteOp.length
          );
        }
        break;
    }

    return transformed;
  }

  /**
   * Transform format operation
   */
  private transformFormat(
    formatOp: FormatOperation, 
    otherOp: Operation, 
    conflicts: string[]
  ): FormatOperation {
    const transformed = { ...formatOp };

    switch (otherOp.type) {
      case OperationType.INSERT:
        const insertOp = otherOp as InsertOperation;
        if (insertOp.position <= formatOp.position) {
          transformed.position += insertOp.content.length;
        }
        break;

      case OperationType.DELETE:
        const deleteOp = otherOp as DeleteOperation;
        if (deleteOp.position < formatOp.position) {
          transformed.position = Math.max(
            deleteOp.position,
            formatOp.position - deleteOp.length
          );
        }
        break;

      case OperationType.FORMAT:
        const otherFormatOp = otherOp as FormatOperation;
        // Check for conflicting format operations
        if (this.rangesOverlap(
          formatOp.position, formatOp.position + formatOp.length,
          otherFormatOp.position, otherFormatOp.position + otherFormatOp.length
        )) {
          // Merge attributes, with newer operation taking precedence
          if (formatOp.timestamp > otherFormatOp.timestamp) {
            transformed.attributes = {
              ...otherFormatOp.attributes,
              ...formatOp.attributes
            };
          }
          conflicts.push(`Format conflict at position ${formatOp.position}`);
        }
        break;
    }

    return transformed;
  }

  /**
   * Check if two ranges overlap
   */
  private rangesOverlap(
    start1: number, end1: number,
    start2: number, end2: number
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  /**
   * Transform a batch of operations
   */
  transformBatch(batch: OperationBatch, againstOperations: Operation[]): OperationBatch {
    const transformedOperations: Operation[] = [];
    const allConflicts: string[] = [];

    for (const operation of batch.operations) {
      let transformedOp = operation;
      
      for (const againstOp of againstOperations) {
        const result = this.transform(transformedOp, againstOp);
        transformedOp = result.operation;
        allConflicts.push(...result.conflicts);
      }
      
      transformedOperations.push(transformedOp);
    }

    return {
      ...batch,
      operations: transformedOperations
    };
  }

  /**
   * Add operation to pending queue
   */
  addPendingOperation(userId: string, operation: Operation): void {
    if (!this.pendingOperations.has(userId)) {
      this.pendingOperations.set(userId, []);
    }
    this.pendingOperations.get(userId)!.push(operation);
  }

  /**
   * Get pending operations for a user
   */
  getPendingOperations(userId: string): Operation[] {
    return this.pendingOperations.get(userId) || [];
  }

  /**
   * Clear pending operations for a user
   */
  clearPendingOperations(userId: string): void {
    this.pendingOperations.delete(userId);
  }

  /**
   * Add operation to history
   */
  addToHistory(operation: Operation): void {
    this.operationHistory.push(operation);
    
    // Limit history size
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory.shift();
    }
  }

  /**
   * Get operation history
   */
  getHistory(): Operation[] {
    return [...this.operationHistory];
  }

  /**
   * Clear operation history
   */
  clearHistory(): void {
    this.operationHistory = [];
  }

  /**
   * Create operation from Yjs event
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static createOperationFromYEvent(event: Y.YEvent<any>, userId: string, sessionId: string): Operation[] {
    const operations: Operation[] = [];
    
    if (event instanceof Y.YTextEvent) {
      let index = 0;
      
      for (const change of event.changes.delta) {
        const timestamp = Date.now();
        
        if (change.retain) {
          index += change.retain;
        } else if (change.insert) {
          operations.push({
            type: OperationType.INSERT,
            position: index,
            content: change.insert,
            timestamp,
            userId,
            sessionId,
            attributes: (change as { attributes?: Record<string, unknown> }).attributes
          } as InsertOperation);
          index += change.insert.length;
        } else if (change.delete) {
          operations.push({
            type: OperationType.DELETE,
            position: index,
            length: change.delete,
            timestamp,
            userId,
            sessionId
          } as DeleteOperation);
        }
      }
    }
    
    return operations;
  }
}

/**
 * Global operation transformer instance
 */
export const operationTransformer = new OperationTransformer();
