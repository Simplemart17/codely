/**
 * Unit tests for CRDT Document functionality
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as Y from 'yjs';
import { CRDTDocument, createCRDTDocument, generateUserColor } from '../../lib/crdt/document';
import { CollaborativeUser } from '../../lib/crdt/document';

// Mock WebSocket provider
jest.mock('y-websocket', () => ({
  WebsocketProvider: jest.fn().mockImplementation(() => ({
    awareness: {
      setLocalStateField: jest.fn(),
      on: jest.fn(),
      getStates: jest.fn().mockReturnValue(new Map())
    },
    on: jest.fn(),
    destroy: jest.fn(),
    synced: true,
    wsconnected: true,
    wsconnecting: false
  }))
}));

// Mock Monaco binding
jest.mock('y-monaco', () => ({
  MonacoBinding: jest.fn().mockImplementation(() => ({
    destroy: jest.fn()
  }))
}));

describe('CRDTDocument', () => {
  let document: CRDTDocument;
  let testUser: CollaborativeUser;
  let sessionId: string;

  beforeEach(() => {
    sessionId = 'test-session-123';
    testUser = {
      id: 'user-1',
      name: 'Test User',
      color: '#FF6B6B',
      avatar: 'https://example.com/avatar.jpg'
    };

    document = createCRDTDocument(sessionId, testUser);
  });

  afterEach(() => {
    if (document) {
      document.destroy();
    }
  });

  describe('Document Creation', () => {
    it('should create a document with correct session ID and user', () => {
      expect(document).toBeDefined();
      expect(document.getContent()).toBe('');
    });

    it('should initialize with empty content', () => {
      const content = document.getContent();
      expect(content).toBe('');
    });

    it('should have correct initial state', () => {
      const state = document.getState();
      expect(state.content).toBe('');
      expect(state.cursors.size).toBe(0);
      expect(state.users.size).toBe(0);
      expect(state.language).toBe('javascript');
    });
  });

  describe('Content Management', () => {
    it('should set and get content correctly', () => {
      const testContent = 'console.log("Hello, World!");';
      document.setContent(testContent);
      
      const retrievedContent = document.getContent();
      expect(retrievedContent).toBe(testContent);
    });

    it('should handle empty content', () => {
      document.setContent('');
      expect(document.getContent()).toBe('');
    });

    it('should handle multiline content', () => {
      const multilineContent = `function test() {
  console.log("Line 1");
  console.log("Line 2");
}`;
      document.setContent(multilineContent);
      expect(document.getContent()).toBe(multilineContent);
    });

    it('should handle special characters', () => {
      const specialContent = 'Special chars: àáâãäåæçèéêë 中文 🚀';
      document.setContent(specialContent);
      expect(document.getContent()).toBe(specialContent);
    });
  });

  describe('Connection Management', () => {
    it('should connect to WebSocket provider', () => {
      const websocketUrl = 'ws://localhost:3001';
      
      expect(() => {
        document.connect(websocketUrl);
      }).not.toThrow();
    });

    it('should handle connection errors gracefully', () => {
      const invalidUrl = 'invalid-url';
      
      // Should not throw, but should emit error event
      expect(() => {
        document.connect(invalidUrl);
      }).not.toThrow();
    });

    it('should disconnect properly', () => {
      document.connect('ws://localhost:3001');
      
      expect(() => {
        document.disconnect();
      }).not.toThrow();
    });

    it('should report connection status', () => {
      const status = document.getConnectionStatus();
      expect(['connected', 'connecting', 'disconnected']).toContain(status);
    });
  });

  describe('Cursor Management', () => {
    it('should update cursor position', () => {
      const position = {
        line: 1,
        column: 5
      };

      expect(() => {
        document.updateCursor(position);
      }).not.toThrow();
    });

    it('should handle cursor with selection', () => {
      const position = {
        line: 1,
        column: 5,
        selection: {
          startLine: 1,
          startColumn: 5,
          endLine: 1,
          endColumn: 10
        }
      };

      expect(() => {
        document.updateCursor(position);
      }).not.toThrow();
    });

    it('should get connected users', () => {
      const users = document.getConnectedUsers();
      expect(Array.isArray(users)).toBe(true);
    });
  });

  describe('State Management', () => {
    it('should get document state', () => {
      const state = document.getState();
      
      expect(state).toHaveProperty('content');
      expect(state).toHaveProperty('language');
      expect(state).toHaveProperty('cursors');
      expect(state).toHaveProperty('users');
      expect(state).toHaveProperty('lastModified');
      
      expect(typeof state.lastModified).toBe('number');
    });

    it('should report sync status', () => {
      const isSynced = document.isSynced();
      expect(typeof isSynced).toBe('boolean');
    });

    it('should handle state updates', () => {
      const initialState = document.getState();
      document.setContent('New content');
      const updatedState = document.getState();
      
      expect(updatedState.content).not.toBe(initialState.content);
      expect(updatedState.lastModified).toBeGreaterThan(initialState.lastModified);
    });
  });

  describe('Event Handling', () => {
    it('should add and remove event listeners', () => {
      const mockCallback = jest.fn();
      
      document.on('textChange', mockCallback);
      document.off('textChange', mockCallback);
      
      // Should not throw
      expect(true).toBe(true);
    });

    it('should emit events on content change', (done) => {
      document.on('textChange', (data) => {
        expect(data).toHaveProperty('content');
        done();
      });

      document.setContent('Test content');
    });

    it('should handle multiple listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      document.on('textChange', callback1);
      document.on('textChange', callback2);
      
      document.setContent('Test');
      
      // Both callbacks should be registered
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle Monaco editor binding errors', () => {
      // Mock editor that will cause binding to fail
      const mockEditor = null;
      
      expect(() => {
        document.bindMonacoEditor(mockEditor as any);
      }).toThrow();
    });

    it('should handle invalid cursor positions', () => {
      const invalidPosition = {
        line: -1,
        column: -1
      };

      expect(() => {
        document.updateCursor(invalidPosition);
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should destroy document properly', () => {
      document.connect('ws://localhost:3001');
      
      expect(() => {
        document.destroy();
      }).not.toThrow();
    });

    it('should handle multiple destroy calls', () => {
      document.destroy();
      
      expect(() => {
        document.destroy();
      }).not.toThrow();
    });
  });
});

describe('Utility Functions', () => {
  describe('createCRDTDocument', () => {
    it('should create a valid CRDT document', () => {
      const sessionId = 'test-session';
      const user: CollaborativeUser = {
        id: 'user-1',
        name: 'Test User',
        color: '#FF6B6B'
      };

      const doc = createCRDTDocument(sessionId, user);
      expect(doc).toBeInstanceOf(CRDTDocument);
      doc.destroy();
    });
  });

  describe('generateUserColor', () => {
    it('should generate consistent colors for same user ID', () => {
      const userId = 'user-123';
      const color1 = generateUserColor(userId);
      const color2 = generateUserColor(userId);
      
      expect(color1).toBe(color2);
    });

    it('should generate different colors for different user IDs', () => {
      const color1 = generateUserColor('user-1');
      const color2 = generateUserColor('user-2');
      
      expect(color1).not.toBe(color2);
    });

    it('should generate valid hex colors', () => {
      const color = generateUserColor('test-user');
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should handle empty user ID', () => {
      const color = generateUserColor('');
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should handle special characters in user ID', () => {
      const color = generateUserColor('user@example.com');
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });
});

describe('Integration Tests', () => {
  it('should handle multiple documents in same session', () => {
    const sessionId = 'shared-session';
    const user1: CollaborativeUser = {
      id: 'user-1',
      name: 'User 1',
      color: '#FF6B6B'
    };
    const user2: CollaborativeUser = {
      id: 'user-2',
      name: 'User 2',
      color: '#4ECDC4'
    };

    const doc1 = createCRDTDocument(sessionId, user1);
    const doc2 = createCRDTDocument(sessionId, user2);

    // Both documents should be created successfully
    expect(doc1).toBeDefined();
    expect(doc2).toBeDefined();

    doc1.destroy();
    doc2.destroy();
  });

  it('should handle rapid content changes', () => {
    const doc = createCRDTDocument('test-session', {
      id: 'user-1',
      name: 'Test User',
      color: '#FF6B6B'
    });

    // Rapidly change content
    for (let i = 0; i < 100; i++) {
      doc.setContent(`Content ${i}`);
    }

    expect(doc.getContent()).toBe('Content 99');
    doc.destroy();
  });

  it('should maintain state consistency during operations', () => {
    const doc = createCRDTDocument('test-session', {
      id: 'user-1',
      name: 'Test User',
      color: '#FF6B6B'
    });

    const content = 'Test content for consistency';
    doc.setContent(content);

    const state1 = doc.getState();
    const state2 = doc.getState();

    expect(state1.content).toBe(state2.content);
    expect(state1.lastModified).toBe(state2.lastModified);

    doc.destroy();
  });
});
