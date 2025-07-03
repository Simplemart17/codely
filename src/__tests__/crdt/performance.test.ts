/**
 * Performance tests for CRDT operations with large documents
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CRDTManager, createSessionConfig } from '../../lib/crdt/manager';
import { OperationQueue, OperationPriority } from '../../lib/crdt/operation-queue';
import { OperationBroadcaster } from '../../lib/crdt/operation-broadcaster';
import { StateSynchronizer } from '../../lib/crdt/state-sync';
import * as Y from 'yjs';

// Mock dependencies
jest.mock('y-websocket');
jest.mock('y-monaco');

describe('CRDT Performance Tests', () => {
  let crdtManager: CRDTManager;

  beforeEach(() => {
    crdtManager = new CRDTManager('ws://localhost:3001');
  });

  afterEach(() => {
    crdtManager.disconnectAll();
  });

  describe('Large Document Handling', () => {
    it('should handle large text documents efficiently', async () => {
      const sessionId = 'large-doc-test';
      const userConfig = createSessionConfig(sessionId, {
        id: 'user1',
        name: 'Alice'
      });

      const doc = await crdtManager.joinSession(userConfig);
      
      // Generate large content (1MB)
      const largeContent = 'A'.repeat(1024 * 1024);
      
      const startTime = performance.now();
      doc.setContent(largeContent);
      const setTime = performance.now() - startTime;

      const retrieveStartTime = performance.now();
      const retrievedContent = doc.getContent();
      const retrieveTime = performance.now() - retrieveStartTime;

      expect(retrievedContent.length).toBe(largeContent.length);
      expect(setTime).toBeLessThan(1000); // Should complete within 1 second
      expect(retrieveTime).toBeLessThan(100); // Should retrieve within 100ms
    });

    it('should handle documents with many lines efficiently', async () => {
      const sessionId = 'many-lines-test';
      const userConfig = createSessionConfig(sessionId, {
        id: 'user1',
        name: 'Alice'
      });

      const doc = await crdtManager.joinSession(userConfig);
      
      // Generate content with 10,000 lines
      const lines = Array.from({ length: 10000 }, (_, i) => `Line ${i + 1}: Some content here`);
      const manyLinesContent = lines.join('\n');
      
      const startTime = performance.now();
      doc.setContent(manyLinesContent);
      const endTime = performance.now();

      expect(doc.getContent().split('\n')).toHaveLength(10000);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle rapid small edits efficiently', async () => {
      const sessionId = 'rapid-edits-test';
      const userConfig = createSessionConfig(sessionId, {
        id: 'user1',
        name: 'Alice'
      });

      const doc = await crdtManager.joinSession(userConfig);
      
      let content = 'Initial content';
      doc.setContent(content);

      const startTime = performance.now();
      
      // Perform 1000 small edits
      for (let i = 0; i < 1000; i++) {
        content += ` Edit${i}`;
        doc.setContent(content);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(doc.getContent()).toContain('Edit999');
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(duration / 1000).toBeLessThan(5); // Average less than 5ms per edit
    });

    it('should maintain performance with complex document structure', async () => {
      const sessionId = 'complex-doc-test';
      const userConfig = createSessionConfig(sessionId, {
        id: 'user1',
        name: 'Alice'
      });

      const doc = await crdtManager.joinSession(userConfig);
      
      // Generate complex JavaScript code structure
      const complexContent = `
        class ComplexClass {
          constructor() {
            this.data = new Map();
            this.callbacks = [];
            this.state = {
              ${Array.from({ length: 100 }, (_, i) => `property${i}: 'value${i}'`).join(',\n              ')}
            };
          }

          ${Array.from({ length: 50 }, (_, i) => `
          method${i}() {
            return this.state.property${i} + ' processed';
          }`).join('\n')}
        }

        ${Array.from({ length: 20 }, (_, i) => `
        function utilityFunction${i}(param1, param2, param3) {
          const result = param1 + param2 + param3;
          console.log('Function ${i} called with result:', result);
          return result * ${i + 1};
        }`).join('\n')}
      `;

      const startTime = performance.now();
      doc.setContent(complexContent);
      const endTime = performance.now();

      expect(doc.getContent().length).toBeGreaterThan(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Operation Queue Performance', () => {
    it('should handle high-volume operation queuing', async () => {
      const operationQueue = new OperationQueue({
        maxBatchSize: 100,
        batchTimeout: 50,
        maxQueueSize: 10000
      });

      const startTime = performance.now();

      // Queue 5000 operations
      for (let i = 0; i < 5000; i++) {
        const success = operationQueue.enqueue({
          type: 'INSERT' as unknown,
          position: i,
          content: `Content ${i}`,
          timestamp: Date.now(),
          userId: 'user1',
          sessionId: 'session1'
        }, OperationPriority.NORMAL);

        expect(success).toBe(true);
      }

      const queueTime = performance.now() - startTime;
      expect(queueTime).toBeLessThan(1000); // Should queue within 1 second

      const stats = operationQueue.getStats();
      expect(stats.totalOperations).toBe(5000);
      expect(stats.pendingOperations).toBe(5000);

      operationQueue.destroy();
    });

    it('should process batches efficiently', async () => {
      const operationQueue = new OperationQueue({
        maxBatchSize: 50,
        batchTimeout: 10,
        maxQueueSize: 1000
      });

      // Queue operations
      for (let i = 0; i < 500; i++) {
        operationQueue.enqueue({
          type: 'INSERT' as unknown,
          position: i,
          content: `Content ${i}`,
          timestamp: Date.now(),
          userId: 'user1',
          sessionId: 'session1'
        }, OperationPriority.NORMAL);
      }

      const startTime = performance.now();
      
      // Process multiple batches
      const batchPromises = [];
      for (let i = 0; i < 10; i++) {
        batchPromises.push(operationQueue.processBatch());
      }

      await Promise.all(batchPromises);
      const processTime = performance.now() - startTime;

      expect(processTime).toBeLessThan(2000); // Should process within 2 seconds

      operationQueue.destroy();
    });

    it('should handle priority queuing efficiently', async () => {
      const operationQueue = new OperationQueue({
        maxBatchSize: 100,
        batchTimeout: 50
      });

      const startTime = performance.now();

      // Mix of different priority operations
      for (let i = 0; i < 1000; i++) {
        const priority = i % 4; // Cycle through priorities 0-3
        operationQueue.enqueue({
          type: 'INSERT' as unknown,
          position: i,
          content: `Content ${i}`,
          timestamp: Date.now(),
          userId: 'user1',
          sessionId: 'session1'
        }, priority as OperationPriority);
      }

      const queueTime = performance.now() - startTime;
      expect(queueTime).toBeLessThan(500); // Should queue within 500ms

      operationQueue.destroy();
    });
  });

  describe('Broadcasting Performance', () => {
    it('should handle high-volume message broadcasting', async () => {
      const broadcaster = new OperationBroadcaster({
        maxRetries: 1,
        batchSize: 100,
        batchTimeout: 50
      });

      // Add mock connections
      const connectionCount = 100;
      for (let i = 0; i < connectionCount; i++) {
        const mockConnection = {
          userId: `user${i}`,
          sessionId: 'test-session',
          connected: true,
          lastActivity: Date.now(),
          send: jest.fn().mockResolvedValue(undefined),
          disconnect: jest.fn()
        };
        broadcaster.addConnection(mockConnection);
      }

      const startTime = performance.now();

      // Broadcast 1000 operations
      const broadcastPromises = [];
      for (let i = 0; i < 1000; i++) {
        const promise = broadcaster.broadcastOperation({
          type: 'INSERT' as unknown,
          position: i,
          content: `Content ${i}`,
          timestamp: Date.now(),
          userId: 'source-user',
          sessionId: 'test-session'
        }, 'test-session');
        broadcastPromises.push(promise);
      }

      await Promise.allSettled(broadcastPromises);
      const broadcastTime = performance.now() - startTime;

      expect(broadcastTime).toBeLessThan(5000); // Should complete within 5 seconds

      const stats = broadcaster.getStats();
      expect(stats.totalMessages).toBe(1000);

      broadcaster.destroy();
    });

    it('should handle large user groups efficiently', async () => {
      const broadcaster = new OperationBroadcaster({
        batchSize: 50,
        batchTimeout: 25
      });

      // Add 500 mock connections
      const connectionCount = 500;
      for (let i = 0; i < connectionCount; i++) {
        const mockConnection = {
          userId: `user${i}`,
          sessionId: 'large-session',
          connected: true,
          lastActivity: Date.now(),
          send: jest.fn().mockResolvedValue(undefined),
          disconnect: jest.fn()
        };
        broadcaster.addConnection(mockConnection);
      }

      const startTime = performance.now();

      // Broadcast to all users
      await broadcaster.broadcastOperation({
        type: 'INSERT' as unknown,
        position: 0,
        content: 'Broadcast to all',
        timestamp: Date.now(),
        userId: 'source-user',
        sessionId: 'large-session'
      }, 'large-session');

      const broadcastTime = performance.now() - startTime;
      expect(broadcastTime).toBeLessThan(2000); // Should complete within 2 seconds

      broadcaster.destroy();
    });
  });

  describe('State Synchronization Performance', () => {
    it('should handle large state synchronization efficiently', async () => {
      const ydoc = new Y.Doc();
      const stateSynchronizer = new StateSynchronizer(ydoc, {
        syncInterval: 50,
        enableDeltaSync: true,
        enableCompression: true
      });

      // Create large document state
      const ytext = ydoc.getText('content');
      const largeContent = 'Large content '.repeat(10000);
      
      const startTime = performance.now();
      ytext.insert(0, largeContent);
      const insertTime = performance.now() - startTime;

      expect(insertTime).toBeLessThan(1000); // Should insert within 1 second

      const syncStartTime = performance.now();
      const stateVector = stateSynchronizer.getStateVector();
      stateSynchronizer.getDocumentDelta();
      const syncTime = performance.now() - syncStartTime;

      expect(stateVector).toBeDefined();
      expect(syncTime).toBeLessThan(100); // Should sync within 100ms

      stateSynchronizer.destroy();
    });

    it('should handle frequent state updates efficiently', async () => {
      const ydoc = new Y.Doc();
      const stateSynchronizer = new StateSynchronizer(ydoc, {
        syncInterval: 10,
        enableDeltaSync: true
      });

      const ytext = ydoc.getText('content');
      
      const startTime = performance.now();

      // Perform 1000 small updates
      for (let i = 0; i < 1000; i++) {
        ytext.insert(ytext.length, ` Update${i}`);
      }

      const updateTime = performance.now() - startTime;
      expect(updateTime).toBeLessThan(3000); // Should complete within 3 seconds

      stateSynchronizer.destroy();
    });
  });

  describe('Memory Usage', () => {
    it('should maintain reasonable memory usage with large documents', async () => {
      const sessionId = 'memory-test';
      const userConfig = createSessionConfig(sessionId, {
        id: 'user1',
        name: 'Alice'
      });

      const doc = await crdtManager.joinSession(userConfig);
      
      // Monitor memory usage (simplified)
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create large content
      const largeContent = 'Memory test content '.repeat(50000);
      doc.setContent(largeContent);
      
      const afterContentMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterContentMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      // Clean up
      doc.setContent('');
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    });

    it('should clean up resources properly', async () => {
      const sessionIds = [];
      
      // Create multiple sessions
      for (let i = 0; i < 10; i++) {
        const sessionId = `cleanup-test-${i}`;
        sessionIds.push(sessionId);
        
        const userConfig = createSessionConfig(sessionId, {
          id: `user${i}`,
          name: `User ${i}`
        });

        await crdtManager.joinSession(userConfig);
      }

      expect(crdtManager.getActiveSessions()).toHaveLength(10);

      // Clean up all sessions
      for (const sessionId of sessionIds) {
        await crdtManager.leaveSession(sessionId);
      }

      expect(crdtManager.getActiveSessions()).toHaveLength(0);
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent operations from multiple users', async () => {
      const sessionId = 'concurrent-perf-test';
      const userCount = 20;
      const operationsPerUser = 50;

      const documents = [];
      
      // Create multiple user sessions
      for (let i = 0; i < userCount; i++) {
        const userConfig = createSessionConfig(sessionId, {
          id: `user${i}`,
          name: `User ${i}`
        });

        const doc = await crdtManager.joinSession(userConfig);
        documents.push(doc);
      }

      const startTime = performance.now();

      // Simulate concurrent operations
      const operationPromises = documents.map((doc, userIndex) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            for (let i = 0; i < operationsPerUser; i++) {
              doc.setContent(`User ${userIndex} - Operation ${i}`);
            }
            resolve();
          }, Math.random() * 100); // Random delay to simulate real concurrency
        });
      });

      await Promise.all(operationPromises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const totalOperations = userCount * operationsPerUser;

      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(totalOperations / (totalTime / 1000)).toBeGreaterThan(50); // At least 50 ops/second

      // Verify all documents are still functional
      documents.forEach((doc, index) => {
        expect(doc.getContent()).toContain(`User ${index}`);
      });
    });
  });
});
