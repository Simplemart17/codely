/**
 * Unit tests for CRDT Operations and Transformation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  OperationTransformer,
  OperationType,
  Operation,
  InsertOperation,
  DeleteOperation,
  OperationBatch,
  operationTransformer
} from '../../lib/crdt/operations';

describe('OperationTransformer', () => {
  let transformer: OperationTransformer;

  beforeEach(() => {
    transformer = new OperationTransformer();
  });

  describe('Insert Operation Transformation', () => {
    it('should handle concurrent inserts at same position', () => {
      const op1: InsertOperation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'Hello',
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      const op2: InsertOperation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'World',
        timestamp: 1001,
        userId: 'user2',
        sessionId: 'session1'
      };

      const result = transformer.transform(op1, op2);
      
      expect(result.transformed).toBe(true);
      expect(result.operation.position).toBe(5); // Earlier timestamp wins position
    });

    it('should handle inserts at different positions', () => {
      const op1: InsertOperation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'Hello',
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      const op2: InsertOperation = {
        type: OperationType.INSERT,
        position: 10,
        content: 'World',
        timestamp: 1001,
        userId: 'user2',
        sessionId: 'session1'
      };

      const result = transformer.transform(op1, op2);
      
      expect(result.transformed).toBe(true);
      expect(result.operation.position).toBe(5); // Position unchanged
    });

    it('should adjust position when other insert is before', () => {
      const op1: InsertOperation = {
        type: OperationType.INSERT,
        position: 10,
        content: 'Hello',
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      const op2: InsertOperation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'World',
        timestamp: 999,
        userId: 'user2',
        sessionId: 'session1'
      };

      const result = transformer.transform(op1, op2);
      
      expect(result.transformed).toBe(true);
      expect(result.operation.position).toBe(15); // Adjusted by length of op2
    });

    it('should use timestamp for tie-breaking', () => {
      const op1: InsertOperation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'A',
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      const op2: InsertOperation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'B',
        timestamp: 999,
        userId: 'user2',
        sessionId: 'session1'
      };

      const result = transformer.transform(op1, op2);
      
      expect(result.transformed).toBe(true);
      expect(result.operation.position).toBe(6); // Adjusted because op2 has earlier timestamp
    });

    it('should use user ID for tie-breaking when timestamps are equal', () => {
      const op1: InsertOperation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'A',
        timestamp: 1000,
        userId: 'user2',
        sessionId: 'session1'
      };

      const op2: InsertOperation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'B',
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      const result = transformer.transform(op1, op2);
      
      expect(result.transformed).toBe(true);
      // user2 > user1, so op1 should be adjusted
      expect(result.operation.position).toBe(6);
    });
  });

  describe('Delete Operation Transformation', () => {
    it('should handle delete against insert', () => {
      const deleteOp: DeleteOperation = {
        type: OperationType.DELETE,
        position: 5,
        length: 3,
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      const insertOp: InsertOperation = {
        type: OperationType.INSERT,
        position: 3,
        content: 'Hello',
        timestamp: 999,
        userId: 'user2',
        sessionId: 'session1'
      };

      const result = transformer.transform(deleteOp, insertOp);
      
      expect(result.transformed).toBe(true);
      expect(result.operation.position).toBe(10); // Adjusted by insert length
    });

    it('should handle overlapping deletes', () => {
      const op1: DeleteOperation = {
        type: OperationType.DELETE,
        position: 5,
        length: 5,
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      const op2: DeleteOperation = {
        type: OperationType.DELETE,
        position: 7,
        length: 3,
        timestamp: 999,
        userId: 'user2',
        sessionId: 'session1'
      };

      const result = transformer.transform(op1, op2);
      
      expect(result.transformed).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
    });

    it('should handle delete before another delete', () => {
      const op1: DeleteOperation = {
        type: OperationType.DELETE,
        position: 10,
        length: 3,
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      const op2: DeleteOperation = {
        type: OperationType.DELETE,
        position: 5,
        length: 2,
        timestamp: 999,
        userId: 'user2',
        sessionId: 'session1'
      };

      const result = transformer.transform(op1, op2);
      
      expect(result.transformed).toBe(true);
      expect(result.operation.position).toBe(8); // Adjusted by op2 length
    });
  });

  describe('Same User Operations', () => {
    it('should not transform operations from same user', () => {
      const op1: InsertOperation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'Hello',
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      const op2: InsertOperation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'World',
        timestamp: 1001,
        userId: 'user1',
        sessionId: 'session1'
      };

      const result = transformer.transform(op1, op2);
      
      expect(result.transformed).toBe(false);
      expect(result.operation).toEqual(op1);
    });
  });

  describe('Operation Batches', () => {
    it('should transform operation batches', () => {
      const batch: OperationBatch = {
        operations: [
          {
            type: OperationType.INSERT,
            position: 5,
            content: 'Hello',
            timestamp: 1000,
            userId: 'user1',
            sessionId: 'session1'
          },
          {
            type: OperationType.INSERT,
            position: 10,
            content: 'World',
            timestamp: 1001,
            userId: 'user1',
            sessionId: 'session1'
          }
        ],
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      const againstOps: Operation[] = [
        {
          type: OperationType.INSERT,
          position: 3,
          content: 'Hi',
          timestamp: 999,
          userId: 'user2',
          sessionId: 'session1'
        }
      ];

      const result = transformer.transformBatch(batch, againstOps);
      
      expect(result.operations).toHaveLength(2);
      expect(result.operations[0].position).toBe(7); // Adjusted by "Hi" length
      expect(result.operations[1].position).toBe(14); // Adjusted by "Hi" + "Hello" length
    });
  });

  describe('Pending Operations', () => {
    it('should add and retrieve pending operations', () => {
      const operation: Operation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'Hello',
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      transformer.addPendingOperation('user1', operation);
      const pending = transformer.getPendingOperations('user1');
      
      expect(pending).toHaveLength(1);
      expect(pending[0]).toEqual(operation);
    });

    it('should clear pending operations', () => {
      const operation: Operation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'Hello',
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      transformer.addPendingOperation('user1', operation);
      transformer.clearPendingOperations('user1');
      
      const pending = transformer.getPendingOperations('user1');
      expect(pending).toHaveLength(0);
    });
  });

  describe('Operation History', () => {
    it('should maintain operation history', () => {
      const operation: Operation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'Hello',
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      transformer.addToHistory(operation);
      const history = transformer.getHistory();
      
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(operation);
    });

    it('should limit history size', () => {
      // Add more operations than the max history size (1000)
      for (let i = 0; i < 1100; i++) {
        const operation: Operation = {
          type: OperationType.INSERT,
          position: i,
          content: `Content ${i}`,
          timestamp: 1000 + i,
          userId: 'user1',
          sessionId: 'session1'
        };
        transformer.addToHistory(operation);
      }

      const history = transformer.getHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    it('should clear history', () => {
      const operation: Operation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'Hello',
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      transformer.addToHistory(operation);
      transformer.clearHistory();
      
      const history = transformer.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid operation types gracefully', () => {
      const invalidOp = {
        type: 'INVALID' as any,
        position: 5,
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      const validOp: InsertOperation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'Hello',
        timestamp: 1000,
        userId: 'user2',
        sessionId: 'session1'
      };

      const result = transformer.transform(invalidOp, validOp);
      
      expect(result.transformed).toBe(false);
      expect(result.operation).toEqual(invalidOp);
    });

    it('should handle negative positions', () => {
      const op1: InsertOperation = {
        type: OperationType.INSERT,
        position: -1,
        content: 'Hello',
        timestamp: 1000,
        userId: 'user1',
        sessionId: 'session1'
      };

      const op2: InsertOperation = {
        type: OperationType.INSERT,
        position: 5,
        content: 'World',
        timestamp: 1001,
        userId: 'user2',
        sessionId: 'session1'
      };

      const result = transformer.transform(op1, op2);
      
      expect(result.transformed).toBe(true);
      expect(result.operation.position).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Global Operation Transformer', () => {
  it('should provide a global transformer instance', () => {
    expect(operationTransformer).toBeDefined();
    expect(operationTransformer).toBeInstanceOf(OperationTransformer);
  });

  it('should maintain state across calls', () => {
    const operation: Operation = {
      type: OperationType.INSERT,
      position: 5,
      content: 'Hello',
      timestamp: 1000,
      userId: 'user1',
      sessionId: 'session1'
    };

    operationTransformer.addToHistory(operation);
    const history = operationTransformer.getHistory();
    
    expect(history.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Operation Utilities', () => {
  describe('createOperationFromYEvent', () => {
    it('should create operations from Y.js events', () => {
      // Mock Y.js event
      const mockEvent = {
        changes: {
          delta: [
            { insert: 'Hello' },
            { retain: 5 },
            { delete: 3 }
          ]
        }
      };

      const operations = OperationTransformer.createOperationFromYEvent(
        mockEvent as any,
        'user1',
        'session1'
      );

      expect(operations).toHaveLength(2); // Insert and delete (retain doesn't create operation)
      expect(operations[0].type).toBe(OperationType.INSERT);
      expect(operations[1].type).toBe(OperationType.DELETE);
    });

    it('should handle empty delta', () => {
      const mockEvent = {
        changes: {
          delta: []
        }
      };

      const operations = OperationTransformer.createOperationFromYEvent(
        mockEvent as any,
        'user1',
        'session1'
      );

      expect(operations).toHaveLength(0);
    });
  });
});
