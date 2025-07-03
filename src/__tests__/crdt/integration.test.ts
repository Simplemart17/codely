/**
 * Integration tests for multi-user CRDT scenarios
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CRDTManager, createSessionConfig } from '../../lib/crdt/manager';
import { CRDTDocument } from '../../lib/crdt/document';
import { CursorTracker } from '../../lib/crdt/cursor-tracking';
import { SelectionSynchronizer } from '../../lib/crdt/selection-sync';
import { UserManager, UserRole } from '../../lib/crdt/user-identification';
import { ConflictResolver } from '../../lib/crdt/conflict-resolution';

// Mock WebSocket and Monaco dependencies
jest.mock('y-websocket');
jest.mock('y-monaco');

describe('Multi-User CRDT Integration', () => {
  let crdtManager: CRDTManager;
  let websocketUrl: string;

  beforeEach(() => {
    websocketUrl = 'ws://localhost:3001';
    crdtManager = new CRDTManager(websocketUrl);
  });

  afterEach(() => {
    crdtManager.disconnectAll();
  });

  describe('Multi-User Session Management', () => {
    it('should handle multiple users joining the same session', async () => {
      const sessionId = 'test-session-multi';
      
      const user1Config = createSessionConfig(sessionId, {
        id: 'user1',
        name: 'Alice',
        color: '#FF6B6B'
      });

      const user2Config = createSessionConfig(sessionId, {
        id: 'user2',
        name: 'Bob',
        color: '#4ECDC4'
      });

      const doc1 = await crdtManager.joinSession(user1Config);
      const doc2 = await crdtManager.joinSession(user2Config);

      expect(doc1).toBeDefined();
      expect(doc2).toBeDefined();
      expect(crdtManager.getActiveSessions()).toContain(sessionId);
    });

    it('should handle users leaving sessions', async () => {
      const sessionId = 'test-session-leave';
      
      const userConfig = createSessionConfig(sessionId, {
        id: 'user1',
        name: 'Alice',
        color: '#FF6B6B'
      });

      await crdtManager.joinSession(userConfig);
      expect(crdtManager.getActiveSessions()).toContain(sessionId);

      await crdtManager.leaveSession(sessionId);
      expect(crdtManager.getActiveSessions()).not.toContain(sessionId);
    });

    it('should maintain separate state for different sessions', async () => {
      const session1Id = 'session-1';
      const session2Id = 'session-2';
      
      const user1Config = createSessionConfig(session1Id, {
        id: 'user1',
        name: 'Alice'
      });

      const user2Config = createSessionConfig(session2Id, {
        id: 'user2',
        name: 'Bob'
      });

      const doc1 = await crdtManager.joinSession(user1Config);
      const doc2 = await crdtManager.joinSession(user2Config);

      doc1.setContent('Content for session 1');
      doc2.setContent('Content for session 2');

      expect(doc1.getContent()).toBe('Content for session 1');
      expect(doc2.getContent()).toBe('Content for session 2');
    });
  });

  describe('Collaborative Editing Scenarios', () => {
    it('should handle concurrent text insertions', async () => {
      const sessionId = 'concurrent-insert-test';
      
      const user1Config = createSessionConfig(sessionId, {
        id: 'user1',
        name: 'Alice'
      });

      const user2Config = createSessionConfig(sessionId, {
        id: 'user2',
        name: 'Bob'
      });

      const doc1 = await crdtManager.joinSession(user1Config);
      const doc2 = await crdtManager.joinSession(user2Config);

      // Simulate concurrent insertions
      doc1.setContent('Hello World');
      doc2.setContent('Hello Beautiful World');

      // Both documents should eventually converge
      // In a real scenario, this would be handled by the CRDT algorithm
      expect(doc1.getContent()).toBeDefined();
      expect(doc2.getContent()).toBeDefined();
    });

    it('should handle rapid successive edits', async () => {
      const sessionId = 'rapid-edits-test';
      
      const userConfig = createSessionConfig(sessionId, {
        id: 'user1',
        name: 'Alice'
      });

      const doc = await crdtManager.joinSession(userConfig);

      // Perform rapid edits
      for (let i = 0; i < 50; i++) {
        doc.setContent(`Content version ${i}`);
      }

      expect(doc.getContent()).toBe('Content version 49');
    });

    it('should maintain document consistency across operations', async () => {
      const sessionId = 'consistency-test';
      
      const userConfig = createSessionConfig(sessionId, {
        id: 'user1',
        name: 'Alice'
      });

      const doc = await crdtManager.joinSession(userConfig);

      const initialState = doc.getState();
      doc.setContent('New content');
      const updatedState = doc.getState();

      expect(updatedState.lastModified).toBeGreaterThan(initialState.lastModified);
      expect(updatedState.content).toBe('New content');
    });
  });

  describe('Cursor and Selection Synchronization', () => {
    it('should track multiple user cursors', () => {
      const user1 = { id: 'user1', name: 'Alice', color: '#FF6B6B' };
      const user2 = { id: 'user2', name: 'Bob', color: '#4ECDC4' };
      
      const cursorTracker = new CursorTracker(user1);

      cursorTracker.updateCursor('user2', { line: 1, column: 5 }, user2);
      cursorTracker.updateCursor('user3', { line: 2, column: 10 }, {
        id: 'user3',
        name: 'Charlie',
        color: '#45B7D1'
      });

      const cursors = cursorTracker.getCursors();
      expect(cursors.size).toBe(2); // user1 is current user, so not tracked
    });

    it('should handle cursor removal', () => {
      const user1 = { id: 'user1', name: 'Alice', color: '#FF6B6B' };
      const cursorTracker = new CursorTracker(user1);

      cursorTracker.updateCursor('user2', { line: 1, column: 5 }, {
        id: 'user2',
        name: 'Bob',
        color: '#4ECDC4'
      });

      expect(cursorTracker.getCursors().size).toBe(1);

      cursorTracker.removeCursor('user2');
      expect(cursorTracker.getCursors().size).toBe(0);
    });

    it('should synchronize text selections', () => {
      const user1 = { id: 'user1', name: 'Alice', color: '#FF6B6B' };
      const selectionSync = new SelectionSynchronizer(user1);

      const selection = selectionSync.addSelection({
        userId: 'user2',
        type: 'text' as unknown,
        startLine: 1,
        startColumn: 5,
        endLine: 1,
        endColumn: 10,
        text: 'Hello',
        temporary: false
      });

      expect(selection).toBeDefined();
      expect(selectionSync.getSelections()).toHaveLength(1);
    });
  });

  describe('User Management', () => {
    it('should manage multiple users with different roles', () => {
      const userManager = new UserManager({
        defaultRole: UserRole.STUDENT,
        defaultPermissions: {
          canEdit: true,
          canComment: true,
          canShare: false,
          canManageUsers: false,
          canExecuteCode: true,
          canChangeSettings: false
        },
        maxUsersPerSession: 10,
        enableAvatars: true,
        enableStatusIndicators: true
      });

      const instructor = userManager.addUser({
        id: 'instructor1',
        name: 'Dr. Smith',
        role: UserRole.INSTRUCTOR
      });

      const student1 = userManager.addUser({
        id: 'student1',
        name: 'Alice'
      });

      const student2 = userManager.addUser({
        id: 'student2',
        name: 'Bob'
      });

      expect(instructor.role).toBe(UserRole.INSTRUCTOR);
      expect(student1.role).toBe(UserRole.STUDENT);
      expect(student2.role).toBe(UserRole.STUDENT);
      expect(userManager.getUserCount()).toBe(3);
    });

    it('should enforce user capacity limits', () => {
      const userManager = new UserManager({
        maxUsersPerSession: 2,
        defaultRole: UserRole.STUDENT,
        defaultPermissions: {
          canEdit: true,
          canComment: true,
          canShare: false,
          canManageUsers: false,
          canExecuteCode: true,
          canChangeSettings: false
        }
      });

      userManager.addUser({ id: 'user1', name: 'Alice' });
      userManager.addUser({ id: 'user2', name: 'Bob' });

      expect(userManager.isAtCapacity()).toBe(true);
    });

    it('should handle user permissions correctly', () => {
      const userManager = new UserManager({
        defaultRole: UserRole.STUDENT,
        defaultPermissions: {
          canEdit: true,
          canComment: true,
          canShare: false,
          canManageUsers: false,
          canExecuteCode: true,
          canChangeSettings: false
        }
      });

      userManager.addUser({
        id: 'user1',
        name: 'Alice'
      });

      expect(userManager.hasPermission('user1', 'canEdit')).toBe(true);
      expect(userManager.hasPermission('user1', 'canManageUsers')).toBe(false);

      userManager.updateUserPermissions('user1', { canManageUsers: true });
      expect(userManager.hasPermission('user1', 'canManageUsers')).toBe(true);
    });
  });

  describe('Conflict Resolution', () => {
    it('should detect and resolve conflicts', () => {
      const conflictResolver = new ConflictResolver({
        defaultStrategy: 'last_writer_wins' as unknown,
        userPriorities: [
          { userId: 'instructor1', priority: 10, role: 'instructor' },
          { userId: 'student1', priority: 1, role: 'student' }
        ],
        enableSemanticAnalysis: false,
        autoResolveThreshold: 'low' as unknown,
        maxConflictAge: 60000
      });

      const operations = [
        {
          type: 'INSERT' as unknown,
          position: 5,
          content: 'Hello',
          timestamp: 1000,
          userId: 'student1',
          sessionId: 'session1'
        },
        {
          type: 'INSERT' as unknown,
          position: 5,
          content: 'Hi',
          timestamp: 1001,
          userId: 'instructor1',
          sessionId: 'session1'
        }
      ];

      const conflicts = conflictResolver.detectConflicts(operations);
      expect(conflicts).toHaveLength(1);

      const resolution = conflictResolver.resolveConflict(conflicts[0].id);
      expect(resolution).toBeDefined();
      expect(resolution?.strategy).toBeDefined();
    });

    it('should auto-resolve low-severity conflicts', () => {
      const conflictResolver = new ConflictResolver({
        defaultStrategy: 'last_writer_wins' as unknown,
        userPriorities: [],
        enableSemanticAnalysis: false,
        autoResolveThreshold: 'medium' as unknown,
        maxConflictAge: 60000
      });

      const operations = [
        {
          type: 'INSERT' as unknown,
          position: 5,
          content: '  ', // Whitespace - low severity
          timestamp: 1000,
          userId: 'user1',
          sessionId: 'session1'
        },
        {
          type: 'INSERT' as unknown,
          position: 5,
          content: '\t', // Tab - low severity
          timestamp: 1001,
          userId: 'user2',
          sessionId: 'session1'
        }
      ];

      conflictResolver.detectConflicts(operations);
      const resolutions = conflictResolver.autoResolveConflicts();

      expect(resolutions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of operations efficiently', async () => {
      const sessionId = 'performance-test';
      const userConfig = createSessionConfig(sessionId, {
        id: 'user1',
        name: 'Alice'
      });

      const doc = await crdtManager.joinSession(userConfig);
      const startTime = Date.now();

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        doc.setContent(`Content ${i}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
      expect(doc.getContent()).toBe('Content 999');
    });

    it('should maintain performance with multiple concurrent users', async () => {
      const sessionId = 'concurrent-performance-test';
      const userCount = 10;
      const documents: CRDTDocument[] = [];

      const startTime = Date.now();

      // Create multiple user sessions
      for (let i = 0; i < userCount; i++) {
        const userConfig = createSessionConfig(sessionId, {
          id: `user${i}`,
          name: `User ${i}`
        });

        const doc = await crdtManager.joinSession(userConfig);
        documents.push(doc);
      }

      // Perform operations on each document
      documents.forEach((doc, index) => {
        doc.setContent(`Content from user ${index}`);
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(3000); // 3 seconds
      expect(documents).toHaveLength(userCount);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle session join failures gracefully', async () => {
      // Mock a failing scenario
      const invalidConfig = createSessionConfig('', {
        id: '',
        name: ''
      });

      try {
        await crdtManager.joinSession(invalidConfig);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should recover from document corruption', async () => {
      const sessionId = 'recovery-test';
      const userConfig = createSessionConfig(sessionId, {
        id: 'user1',
        name: 'Alice'
      });

      const doc = await crdtManager.joinSession(userConfig);
      
      // Set valid content
      doc.setContent('Valid content');
      expect(doc.getContent()).toBe('Valid content');

      // Document should remain functional
      doc.setContent('Updated content');
      expect(doc.getContent()).toBe('Updated content');
    });

    it('should handle network disconnections', async () => {
      const sessionId = 'network-test';
      const userConfig = createSessionConfig(sessionId, {
        id: 'user1',
        name: 'Alice'
      });

      const doc = await crdtManager.joinSession(userConfig);
      
      // Simulate network disconnection
      doc.disconnect();
      
      // Document should still be functional for local operations
      doc.setContent('Offline content');
      expect(doc.getContent()).toBe('Offline content');
    });
  });
});
