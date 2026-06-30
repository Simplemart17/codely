/**
 * CRDT Document Structure for Collaborative Code Editing
 * 
 * This module implements the core CRDT document structure using Yjs
 * for conflict-free collaborative editing in the Codely platform.
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import type { editor } from 'monaco-editor';

/**
 * User information for collaborative editing
 */
export interface CollaborativeUser {
  id: string;
  name: string;
  color: string;
  avatar?: string;
}

/**
 * Cursor position information
 */
export interface CursorPosition {
  line: number;
  column: number;
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

/**
 * Collaborative document state
 */
export interface DocumentState {
  content: string;
  language: string;
  cursors: Map<string, CursorPosition>;
  users: Map<string, CollaborativeUser>;
  lastModified: number;
}

/**
 * CRDT Document class for managing collaborative editing
 */
export class CRDTDocument {
  private ydoc: Y.Doc;
  private ytext: Y.Text;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private yawareness: any;
  private provider: WebsocketProvider | null = null;
  private monacoBinding: MonacoBinding | null = null;
  private sessionId: string;
  private currentUser: CollaborativeUser;
  private eventListeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();

  constructor(sessionId: string, user: CollaborativeUser) {
    this.sessionId = sessionId;
    this.currentUser = user;
    
    // Initialize Yjs document
    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText('monaco');
    
    // Initialize awareness for cursor tracking
    this.yawareness = null; // Will be set when provider is created
    
    this.setupEventListeners();
  }

  /**
   * Connect to WebSocket provider for real-time synchronization
   */
  connect(websocketUrl: string, initialContent?: string): void {
    try {
      // Create WebSocket provider
      this.provider = new WebsocketProvider(
        websocketUrl,
        `session-${this.sessionId}`,
        this.ydoc
      );

      // Set up awareness
      this.yawareness = this.provider.awareness;

      // Set local user state
      this.yawareness.setLocalStateField('user', {
        id: this.currentUser.id,
        name: this.currentUser.name,
        color: this.currentUser.color,
        avatar: this.currentUser.avatar
      });

      // Listen for awareness changes
      this.yawareness.on('change', this.handleAwarenessChange.bind(this));

      // Listen for provider events
      this.provider.on('status', this.handleConnectionStatus.bind(this));

      // Handle initial sync — set content if document is empty after first sync
      this.provider.on('sync', (isSynced: boolean) => {
        this.handleSync(isSynced);

        if (isSynced && initialContent && this.ytext.length === 0) {
          // Document is empty on the server, set initial content
          this.setContent(initialContent);
        }
      });

      this.emit('connected', { sessionId: this.sessionId });
    } catch (error) {
      console.error('Failed to connect to WebSocket provider:', error);
      this.emit('error', { type: 'connection', error });
    }
  }

  /**
   * Disconnect from WebSocket provider
   */
  disconnect(): void {
    if (this.monacoBinding) {
      this.monacoBinding.destroy();
      this.monacoBinding = null;
    }

    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }

    this.emit('disconnected', { sessionId: this.sessionId });
  }

  /**
   * Bind Monaco editor to CRDT document
   */
  bindMonacoEditor(editor: editor.IStandaloneCodeEditor): void {
    if (!this.provider) {
      throw new Error('Must connect to provider before binding Monaco editor');
    }

    try {
      // MonacoBinding owns local→awareness cursor/selection sync: it writes the
      // local `selection` field on cursor changes and renders remote
      // participants' cursors as `yRemoteSelection*` decorations (styled by
      // use-remote-cursors). We deliberately do NOT add our own cursor listeners
      // on top of it. Doing so writes a second awareness field on every cursor
      // change, which re-enters MonacoBinding's decoration render synchronously
      // and crashes Monaco with "Invoking deltaDecorations recursively could
      // lead to leaking decorations." The `cursor` field is not used for
      // rendering, so dropping that extra tracking loses nothing visible.
      this.monacoBinding = new MonacoBinding(
        this.ytext,
        editor.getModel()!,
        new Set([editor]),
        this.yawareness
      );

      this.emit('editorBound', { editor });
    } catch (error) {
      console.error('Failed to bind Monaco editor:', error);
      this.emit('error', { type: 'binding', error });
    }
  }

  /**
   * Get current document content
   */
  getContent(): string {
    return this.ytext.toString();
  }

  /**
   * Set document content (use sparingly, prefer collaborative editing)
   */
  setContent(content: string): void {
    this.ydoc.transact(() => {
      this.ytext.delete(0, this.ytext.length);
      this.ytext.insert(0, content);
    });
  }

  /**
   * Get current document state
   */
  getState(): DocumentState {
    const cursors = new Map<string, CursorPosition>();
    const users = new Map<string, CollaborativeUser>();

    if (this.yawareness) {
      this.yawareness.getStates().forEach((state: unknown, _clientId: number) => {
        const stateObj = state as { user?: CollaborativeUser; cursor?: CursorPosition };
        if (stateObj.user && stateObj.cursor) {
          users.set(stateObj.user.id, stateObj.user);
          cursors.set(stateObj.user.id, stateObj.cursor);
        }
      });
    }

    return {
      content: this.getContent(),
      language: 'javascript', // TODO: Make this configurable
      cursors,
      users,
      lastModified: Date.now()
    };
  }

  /**
   * Update cursor position
   */
  updateCursor(position: CursorPosition): void {
    if (this.yawareness) {
      this.yawareness.setLocalStateField('cursor', position);
    }
  }

  /**
   * Get connected users
   */
  getConnectedUsers(): CollaborativeUser[] {
    const users: CollaborativeUser[] = [];
    
    if (this.yawareness) {
      this.yawareness.getStates().forEach((state: unknown) => {
        const stateObj = state as { user?: CollaborativeUser };
        if (stateObj.user) {
          users.push(stateObj.user);
        }
      });
    }

    return users;
  }

  /**
   * Get the awareness instance (for remote cursor rendering)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAwareness(): any {
    return this.yawareness;
  }

  /**
   * Check if document is synchronized
   */
  isSynced(): boolean {
    return this.provider?.synced || false;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    if (!this.provider) return 'disconnected';
    
    switch (this.provider.wsconnected) {
      case true:
        return 'connected';
      case false:
        return this.provider.wsconnecting ? 'connecting' : 'disconnected';
      default:
        return 'disconnected';
    }
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
   * Emit event
   */
  private emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Set up event listeners for document changes
   */
  private setupEventListeners(): void {
    // Listen for text changes
    this.ytext.observe((event) => {
      this.emit('textChange', {
        changes: event.changes,
        content: this.ytext.toString()
      });
    });

    // Listen for document updates
    this.ydoc.on('update', (update: Uint8Array) => {
      this.emit('documentUpdate', { update });
    });
  }

  /**
   * Handle awareness changes (cursor movements, user joins/leaves)
   */
  private handleAwarenessChange(changes: unknown): void {
    const changesObj = changes as { added: number[]; updated: number[]; removed: number[] };
    const { added, updated, removed } = changesObj;
    
    this.emit('awarenessChange', {
      added: added.map((id: number) => this.yawareness.getStates().get(id)),
      updated: updated.map((id: number) => this.yawareness.getStates().get(id)),
      removed: removed
    });
  }

  /**
   * Handle connection status changes
   */
  private handleConnectionStatus(event: { status: string }): void {
    this.emit('connectionStatus', event);
  }

  /**
   * Handle sync events
   */
  private handleSync(isSynced: boolean): void {
    this.emit('sync', { isSynced });
  }

  /**
   * Destroy the document and clean up resources
   */
  destroy(): void {
    this.disconnect();
    this.eventListeners.clear();
    this.ydoc.destroy();
  }
}

/**
 * Factory function to create a new CRDT document
 */
export function createCRDTDocument(
  sessionId: string, 
  user: CollaborativeUser
): CRDTDocument {
  return new CRDTDocument(sessionId, user);
}

/**
 * Utility function to generate user colors
 */
export function generateUserColor(userId: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}
