/**
 * Cursor Position Tracking System for Multi-user Collaboration
 * 
 * This module implements real-time cursor position sharing and tracking
 * for collaborative editing sessions.
 */

import type { editor } from 'monaco-editor';
import { CollaborativeUser, CursorPosition } from './document';

/**
 * Cursor state information
 */
export interface CursorState {
  position: CursorPosition;
  user: CollaborativeUser;
  lastUpdate: number;
  isActive: boolean;
  isTyping: boolean;
}

/**
 * Cursor decoration information for Monaco editor
 */
export interface CursorDecoration {
  id: string;
  userId: string;
  decorationIds: string[];
  widgetId?: string;
  position: CursorPosition;
}

/**
 * Cursor tracking events
 */
export interface CursorTrackingEvents {
  cursorMoved: (userId: string, position: CursorPosition) => void;
  cursorAdded: (userId: string, cursor: CursorState) => void;
  cursorRemoved: (userId: string) => void;
  selectionChanged: (userId: string, selection: CursorPosition['selection']) => void;
  typingStarted: (userId: string) => void;
  typingStopped: (userId: string) => void;
}

/**
 * Cursor Tracker class for managing multi-user cursors
 */
export class CursorTracker {
  private cursors: Map<string, CursorState> = new Map();
  private decorations: Map<string, CursorDecoration> = new Map();
  private editor: editor.IStandaloneCodeEditor | null = null;
  private currentUser: CollaborativeUser | null = null;
  private eventListeners: Map<keyof CursorTrackingEvents, ((...args: unknown[]) => void)[]> = new Map();
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly TYPING_TIMEOUT = 2000; // 2 seconds

  constructor(currentUser?: CollaborativeUser) {
    this.currentUser = currentUser || null;
  }

  /**
   * Set the current user
   */
  setCurrentUser(user: CollaborativeUser): void {
    this.currentUser = user;
  }

  /**
   * Bind to Monaco editor
   */
  bindEditor(editor: editor.IStandaloneCodeEditor): void {
    this.editor = editor;
    this.setupEditorListeners();
  }

  /**
   * Update cursor position for a user
   */
  updateCursor(userId: string, position: CursorPosition, user?: CollaborativeUser): void {
    // Don't track current user's cursor
    if (userId === this.currentUser?.id) {
      return;
    }

    const existingCursor = this.cursors.get(userId);
    const cursorUser = user || existingCursor?.user;

    if (!cursorUser) {
      console.warn(`No user information available for cursor ${userId}`);
      return;
    }

    const cursorState: CursorState = {
      position,
      user: cursorUser,
      lastUpdate: Date.now(),
      isActive: true,
      isTyping: existingCursor?.isTyping || false
    };

    this.cursors.set(userId, cursorState);

    // Update visual representation
    this.updateCursorDecoration(userId, cursorState);

    // Emit events
    if (existingCursor) {
      this.emit('cursorMoved', userId, position);
    } else {
      this.emit('cursorAdded', userId, cursorState);
    }

    if (position.selection) {
      this.emit('selectionChanged', userId, position.selection);
    }

    // Handle typing indication
    this.handleTypingIndication(userId);
  }

  /**
   * Remove cursor for a user
   */
  removeCursor(userId: string): void {
    const cursor = this.cursors.get(userId);
    if (!cursor) return;

    // Remove visual representation
    this.removeCursorDecoration(userId);

    // Clear typing timeout
    const timeout = this.typingTimeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.typingTimeouts.delete(userId);
    }

    // Remove from tracking
    this.cursors.delete(userId);

    this.emit('cursorRemoved', userId);
  }

  /**
   * Get all tracked cursors
   */
  getCursors(): Map<string, CursorState> {
    return new Map(this.cursors);
  }

  /**
   * Get cursor for specific user
   */
  getCursor(userId: string): CursorState | null {
    return this.cursors.get(userId) || null;
  }

  /**
   * Get active cursors (recently updated)
   */
  getActiveCursors(maxAge: number = 30000): Map<string, CursorState> {
    const now = Date.now();
    const activeCursors = new Map<string, CursorState>();

    for (const [userId, cursor] of this.cursors) {
      if (now - cursor.lastUpdate <= maxAge) {
        activeCursors.set(userId, cursor);
      }
    }

    return activeCursors;
  }

  /**
   * Clear all cursors
   */
  clearAllCursors(): void {
    // Remove all decorations
    for (const userId of this.cursors.keys()) {
      this.removeCursorDecoration(userId);
    }

    // Clear all timeouts
    for (const timeout of this.typingTimeouts.values()) {
      clearTimeout(timeout);
    }

    this.cursors.clear();
    this.decorations.clear();
    this.typingTimeouts.clear();
  }

  /**
   * Set typing state for a user
   */
  setTypingState(userId: string, isTyping: boolean): void {
    const cursor = this.cursors.get(userId);
    if (!cursor) return;

    const wasTyping = cursor.isTyping;
    cursor.isTyping = isTyping;
    cursor.lastUpdate = Date.now();

    // Update decoration to show typing state
    this.updateCursorDecoration(userId, cursor);

    // Emit typing events
    if (isTyping && !wasTyping) {
      this.emit('typingStarted', userId);
    } else if (!isTyping && wasTyping) {
      this.emit('typingStopped', userId);
    }
  }

  /**
   * Add event listener
   */
  on<K extends keyof CursorTrackingEvents>(
    event: K,
    callback: CursorTrackingEvents[K]
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback as (...args: unknown[]) => void);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof CursorTrackingEvents>(
    event: K,
    callback: CursorTrackingEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback as (...args: unknown[]) => void);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit<K extends keyof CursorTrackingEvents>(
    event: K,
    ...args: Parameters<CursorTrackingEvents[K]>
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in cursor tracking event listener:`, error);
        }
      });
    }
  }

  /**
   * Set up Monaco editor event listeners
   */
  private setupEditorListeners(): void {
    if (!this.editor || !this.currentUser) return;

    // Track cursor position changes
    this.editor.onDidChangeCursorPosition((e) => {
      if (!this.currentUser) return;

      const position: CursorPosition = {
        line: e.position.lineNumber,
        column: e.position.column
      };

      // Include selection if present
      const selection = this.editor!.getSelection();
      if (selection && !selection.isEmpty()) {
        position.selection = {
          startLine: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLine: selection.endLineNumber,
          endColumn: selection.endColumn
        };
      }

      // This would be sent to other users via the CRDT document
      // The actual sending is handled by the CRDTDocument class
    });

    // Track selection changes
    this.editor.onDidChangeCursorSelection((_e) => {
      if (!this.currentUser) return;

      // This would be sent to other users via the CRDT document
    });
  }

  /**
   * Update cursor decoration in Monaco editor
   */
  private updateCursorDecoration(userId: string, cursor: CursorState): void {
    if (!this.editor) return;

    // Remove existing decoration
    this.removeCursorDecoration(userId);

    const { position, user, isTyping } = cursor;
    const decorationIds: string[] = [];

    // Create cursor decoration
    const cursorDecoration: editor.IModelDeltaDecoration = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      range: new (this.editor.getModel()!.constructor as any).Range(
        position.line,
        position.column,
        position.line,
        position.column
      ),
      options: {
        className: `cursor-${userId}`,
        beforeContentClassName: `cursor-line-${userId}`,
        stickiness: 1, // TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        zIndex: 1000
      }
    };

    // Add selection decoration if present
    if (position.selection) {
      const selectionDecoration: editor.IModelDeltaDecoration = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        range: new (this.editor.getModel()!.constructor as any).Range(
          position.selection.startLine,
          position.selection.startColumn,
          position.selection.endLine,
          position.selection.endColumn
        ),
        options: {
          className: `selection-${userId}`,
          stickiness: 1,
          zIndex: 999
        }
      };

      const selectionIds = this.editor.deltaDecorations([], [selectionDecoration]);
      decorationIds.push(...selectionIds);
    }

    // Add cursor decoration
    const cursorIds = this.editor.deltaDecorations([], [cursorDecoration]);
    decorationIds.push(...cursorIds);

    // Create cursor decoration object
    const decoration: CursorDecoration = {
      id: `cursor-${userId}`,
      userId,
      decorationIds,
      position
    };

    this.decorations.set(userId, decoration);

    // Add CSS styles dynamically
    this.addCursorStyles(userId, user, isTyping);
  }

  /**
   * Remove cursor decoration
   */
  private removeCursorDecoration(userId: string): void {
    if (!this.editor) return;

    const decoration = this.decorations.get(userId);
    if (decoration) {
      this.editor.deltaDecorations(decoration.decorationIds, []);
      this.decorations.delete(userId);
    }

    // Remove CSS styles
    this.removeCursorStyles(userId);
  }

  /**
   * Add CSS styles for cursor
   */
  private addCursorStyles(userId: string, user: CollaborativeUser, isTyping: boolean): void {
    const styleId = `cursor-style-${userId}`;
    
    // Remove existing style
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement('style');
    style.id = styleId;
    
    const opacity = isTyping ? '1' : '0.7';
    const animation = isTyping ? 'cursor-blink 1s infinite' : 'none';
    
    style.textContent = `
      .cursor-${userId} {
        background-color: ${user.color} !important;
        opacity: ${opacity};
        animation: ${animation};
      }
      
      .cursor-line-${userId}::before {
        content: '';
        position: absolute;
        width: 2px;
        height: 1.2em;
        background-color: ${user.color};
        z-index: 1000;
        animation: ${animation};
      }
      
      .selection-${userId} {
        background-color: ${user.color}33 !important;
        border: 1px solid ${user.color}66;
      }
      
      @keyframes cursor-blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.3; }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Remove CSS styles for cursor
   */
  private removeCursorStyles(userId: string): void {
    const styleId = `cursor-style-${userId}`;
    const style = document.getElementById(styleId);
    if (style) {
      style.remove();
    }
  }

  /**
   * Handle typing indication
   */
  private handleTypingIndication(userId: string): void {
    // Clear existing timeout
    const existingTimeout = this.typingTimeouts.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set typing state
    this.setTypingState(userId, true);

    // Set timeout to clear typing state
    const timeout = setTimeout(() => {
      this.setTypingState(userId, false);
      this.typingTimeouts.delete(userId);
    }, this.TYPING_TIMEOUT);

    this.typingTimeouts.set(userId, timeout);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clearAllCursors();
    this.eventListeners.clear();
    this.editor = null;
    this.currentUser = null;
  }
}

/**
 * Create cursor tracker instance
 */
export function createCursorTracker(currentUser?: CollaborativeUser): CursorTracker {
  return new CursorTracker(currentUser);
}
