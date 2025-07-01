/**
 * CRDT Manager for handling multiple collaborative documents
 * 
 * This module manages multiple CRDT documents and provides a centralized
 * interface for collaborative editing sessions.
 */

import { CRDTDocument, CollaborativeUser, DocumentState, createCRDTDocument, generateUserColor } from './document';
import type { editor } from 'monaco-editor';

/**
 * Session configuration for CRDT
 */
export interface SessionConfig {
  sessionId: string;
  websocketUrl: string;
  user: CollaborativeUser;
  language?: string;
  initialContent?: string;
}

/**
 * Document event data
 */
export interface DocumentEvent {
  sessionId: string;
  type: string;
  data: any;
  timestamp: number;
}

/**
 * CRDT Manager class for handling multiple collaborative sessions
 */
export class CRDTManager {
  private documents: Map<string, CRDTDocument> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  private currentUser: CollaborativeUser | null = null;
  private websocketUrl: string;

  constructor(websocketUrl: string) {
    this.websocketUrl = websocketUrl;
  }

  /**
   * Set current user for all sessions
   */
  setCurrentUser(user: Partial<CollaborativeUser>): void {
    this.currentUser = {
      id: user.id || `user-${Date.now()}`,
      name: user.name || 'Anonymous',
      color: user.color || generateUserColor(user.id || `user-${Date.now()}`),
      avatar: user.avatar
    };
  }

  /**
   * Create or join a collaborative session
   */
  async joinSession(config: SessionConfig): Promise<CRDTDocument> {
    const { sessionId, user, language, initialContent } = config;

    // Check if document already exists
    if (this.documents.has(sessionId)) {
      return this.documents.get(sessionId)!;
    }

    try {
      // Create new CRDT document
      const document = createCRDTDocument(sessionId, user);

      // Set up event forwarding
      this.setupDocumentEventForwarding(document, sessionId);

      // Connect to WebSocket
      document.connect(this.websocketUrl);

      // Set initial content if provided
      if (initialContent) {
        document.setContent(initialContent);
      }

      // Store document
      this.documents.set(sessionId, document);

      this.emit('sessionJoined', {
        sessionId,
        user,
        document
      });

      return document;
    } catch (error) {
      console.error(`Failed to join session ${sessionId}:`, error);
      this.emit('error', {
        sessionId,
        type: 'join_session',
        error
      });
      throw error;
    }
  }

  /**
   * Leave a collaborative session
   */
  async leaveSession(sessionId: string): Promise<void> {
    const document = this.documents.get(sessionId);
    if (!document) {
      return;
    }

    try {
      // Disconnect and destroy document
      document.destroy();
      this.documents.delete(sessionId);

      this.emit('sessionLeft', { sessionId });
    } catch (error) {
      console.error(`Failed to leave session ${sessionId}:`, error);
      this.emit('error', {
        sessionId,
        type: 'leave_session',
        error
      });
    }
  }

  /**
   * Get document for a session
   */
  getDocument(sessionId: string): CRDTDocument | null {
    return this.documents.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Bind Monaco editor to a session
   */
  bindEditor(sessionId: string, editor: editor.IStandaloneCodeEditor): void {
    const document = this.documents.get(sessionId);
    if (!document) {
      throw new Error(`No document found for session ${sessionId}`);
    }

    document.bindMonacoEditor(editor);
  }

  /**
   * Get session state
   */
  getSessionState(sessionId: string): DocumentState | null {
    const document = this.documents.get(sessionId);
    return document ? document.getState() : null;
  }

  /**
   * Get connected users for a session
   */
  getConnectedUsers(sessionId: string): CollaborativeUser[] {
    const document = this.documents.get(sessionId);
    return document ? document.getConnectedUsers() : [];
  }

  /**
   * Check if session is synchronized
   */
  isSessionSynced(sessionId: string): boolean {
    const document = this.documents.get(sessionId);
    return document ? document.isSynced() : false;
  }

  /**
   * Get connection status for a session
   */
  getConnectionStatus(sessionId: string): 'connected' | 'connecting' | 'disconnected' {
    const document = this.documents.get(sessionId);
    return document ? document.getConnectionStatus() : 'disconnected';
  }

  /**
   * Reconnect all sessions
   */
  async reconnectAll(): Promise<void> {
    const reconnectPromises = Array.from(this.documents.entries()).map(
      async ([sessionId, document]) => {
        try {
          document.disconnect();
          document.connect(this.websocketUrl);
        } catch (error) {
          console.error(`Failed to reconnect session ${sessionId}:`, error);
          this.emit('error', {
            sessionId,
            type: 'reconnect',
            error
          });
        }
      }
    );

    await Promise.all(reconnectPromises);
  }

  /**
   * Disconnect all sessions
   */
  disconnectAll(): void {
    this.documents.forEach((document, sessionId) => {
      try {
        document.destroy();
      } catch (error) {
        console.error(`Failed to disconnect session ${sessionId}:`, error);
      }
    });
    this.documents.clear();
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
   * Emit event
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Set up event forwarding from document to manager
   */
  private setupDocumentEventForwarding(document: CRDTDocument, sessionId: string): void {
    const forwardEvent = (eventType: string) => {
      document.on(eventType, (data: any) => {
        const event: DocumentEvent = {
          sessionId,
          type: eventType,
          data,
          timestamp: Date.now()
        };
        this.emit(eventType, event);
        this.emit('documentEvent', event);
      });
    };

    // Forward all document events
    [
      'connected',
      'disconnected',
      'editorBound',
      'textChange',
      'documentUpdate',
      'awarenessChange',
      'connectionStatus',
      'sync',
      'error'
    ].forEach(forwardEvent);
  }

  /**
   * Get manager statistics
   */
  getStats(): {
    activeSessions: number;
    connectedSessions: number;
    syncedSessions: number;
    totalUsers: number;
  } {
    const activeSessions = this.documents.size;
    let connectedSessions = 0;
    let syncedSessions = 0;
    let totalUsers = 0;

    this.documents.forEach((document) => {
      if (document.getConnectionStatus() === 'connected') {
        connectedSessions++;
      }
      if (document.isSynced()) {
        syncedSessions++;
      }
      totalUsers += document.getConnectedUsers().length;
    });

    return {
      activeSessions,
      connectedSessions,
      syncedSessions,
      totalUsers
    };
  }

  /**
   * Destroy manager and clean up all resources
   */
  destroy(): void {
    this.disconnectAll();
    this.eventListeners.clear();
    this.currentUser = null;
  }
}

/**
 * Global CRDT manager instance
 */
let globalCRDTManager: CRDTManager | null = null;

/**
 * Get or create global CRDT manager
 */
export function getCRDTManager(websocketUrl?: string): CRDTManager {
  if (!globalCRDTManager) {
    if (!websocketUrl) {
      throw new Error('WebSocket URL required for first initialization');
    }
    globalCRDTManager = new CRDTManager(websocketUrl);
  }
  return globalCRDTManager;
}

/**
 * Initialize CRDT manager with configuration
 */
export function initializeCRDTManager(config: {
  websocketUrl: string;
  user?: Partial<CollaborativeUser>;
}): CRDTManager {
  const manager = getCRDTManager(config.websocketUrl);
  
  if (config.user) {
    manager.setCurrentUser(config.user);
  }

  return manager;
}

/**
 * Utility function to create session configuration
 */
export function createSessionConfig(
  sessionId: string,
  user: Partial<CollaborativeUser>,
  options?: {
    language?: string;
    initialContent?: string;
  }
): SessionConfig {
  return {
    sessionId,
    websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001',
    user: {
      id: user.id || `user-${Date.now()}`,
      name: user.name || 'Anonymous',
      color: user.color || generateUserColor(user.id || `user-${Date.now()}`),
      avatar: user.avatar
    },
    language: options?.language || 'javascript',
    initialContent: options?.initialContent
  };
}
