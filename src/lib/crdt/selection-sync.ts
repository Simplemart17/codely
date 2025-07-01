/**
 * Selection and Highlight Synchronization System
 * 
 * This module handles real-time synchronization of text selections,
 * highlights, and annotations across collaborative users.
 */

import type { editor } from 'monaco-editor';
import { CollaborativeUser } from './document';

/**
 * Selection types
 */
export enum SelectionType {
  TEXT = 'text',
  LINE = 'line',
  BLOCK = 'block',
  WORD = 'word'
}

/**
 * Highlight types
 */
export enum HighlightType {
  SELECTION = 'selection',
  ANNOTATION = 'annotation',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  COMMENT = 'comment'
}

/**
 * Selection information
 */
export interface Selection {
  id: string;
  userId: string;
  type: SelectionType;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  text: string;
  timestamp: number;
  temporary: boolean; // If true, selection will be cleared after a timeout
}

/**
 * Highlight information
 */
export interface Highlight {
  id: string;
  userId: string;
  type: HighlightType;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  text: string;
  message?: string;
  timestamp: number;
  persistent: boolean; // If true, highlight persists across sessions
  metadata?: Record<string, unknown>;
}

/**
 * Annotation information
 */
export interface Annotation {
  id: string;
  userId: string;
  line: number;
  column: number;
  message: string;
  type: 'comment' | 'suggestion' | 'question' | 'note';
  timestamp: number;
  resolved: boolean;
  replies?: AnnotationReply[];
}

/**
 * Annotation reply
 */
export interface AnnotationReply {
  id: string;
  userId: string;
  message: string;
  timestamp: number;
}

/**
 * Selection synchronization events
 */
export interface SelectionSyncEvents {
  selectionAdded: (selection: Selection) => void;
  selectionUpdated: (selection: Selection) => void;
  selectionRemoved: (selectionId: string) => void;
  highlightAdded: (highlight: Highlight) => void;
  highlightRemoved: (highlightId: string) => void;
  annotationAdded: (annotation: Annotation) => void;
  annotationUpdated: (annotation: Annotation) => void;
  annotationRemoved: (annotationId: string) => void;
}

/**
 * Selection Synchronizer class for managing collaborative selections
 */
export class SelectionSynchronizer {
  private selections: Map<string, Selection> = new Map();
  private highlights: Map<string, Highlight> = new Map();
  private annotations: Map<string, Annotation> = new Map();
  private decorations: Map<string, string[]> = new Map();
  private editor: editor.IStandaloneCodeEditor | null = null;
  private currentUser: CollaborativeUser | null = null;
  private eventListeners: Map<keyof SelectionSyncEvents, ((...args: unknown[]) => void)[]> = new Map();
  private temporarySelectionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly TEMPORARY_SELECTION_TIMEOUT = 5000; // 5 seconds

  constructor(currentUser?: CollaborativeUser) {
    this.currentUser = currentUser || null;
  }

  /**
   * Set current user
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
   * Add or update selection
   */
  addSelection(selection: Omit<Selection, 'id' | 'timestamp'>): Selection {
    const fullSelection: Selection = {
      ...selection,
      id: `selection-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now()
    };

    this.selections.set(fullSelection.id, fullSelection);
    this.updateSelectionDecoration(fullSelection);

    // Set timeout for temporary selections
    if (fullSelection.temporary) {
      this.setTemporarySelectionTimeout(fullSelection.id);
    }

    this.emit('selectionAdded', fullSelection);
    return fullSelection;
  }

  /**
   * Update existing selection
   */
  updateSelection(selectionId: string, updates: Partial<Selection>): boolean {
    const selection = this.selections.get(selectionId);
    if (!selection) return false;

    const updatedSelection = { ...selection, ...updates, timestamp: Date.now() };
    this.selections.set(selectionId, updatedSelection);
    this.updateSelectionDecoration(updatedSelection);

    this.emit('selectionUpdated', updatedSelection);
    return true;
  }

  /**
   * Remove selection
   */
  removeSelection(selectionId: string): boolean {
    const selection = this.selections.get(selectionId);
    if (!selection) return false;

    this.selections.delete(selectionId);
    this.removeSelectionDecoration(selectionId);

    // Clear timeout if it exists
    const timeout = this.temporarySelectionTimeouts.get(selectionId);
    if (timeout) {
      clearTimeout(timeout);
      this.temporarySelectionTimeouts.delete(selectionId);
    }

    this.emit('selectionRemoved', selectionId);
    return true;
  }

  /**
   * Add highlight
   */
  addHighlight(highlight: Omit<Highlight, 'id' | 'timestamp'>): Highlight {
    const fullHighlight: Highlight = {
      ...highlight,
      id: `highlight-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now()
    };

    this.highlights.set(fullHighlight.id, fullHighlight);
    this.updateHighlightDecoration(fullHighlight);

    this.emit('highlightAdded', fullHighlight);
    return fullHighlight;
  }

  /**
   * Remove highlight
   */
  removeHighlight(highlightId: string): boolean {
    const highlight = this.highlights.get(highlightId);
    if (!highlight) return false;

    this.highlights.delete(highlightId);
    this.removeHighlightDecoration(highlightId);

    this.emit('highlightRemoved', highlightId);
    return true;
  }

  /**
   * Add annotation
   */
  addAnnotation(annotation: Omit<Annotation, 'id' | 'timestamp'>): Annotation {
    const fullAnnotation: Annotation = {
      ...annotation,
      id: `annotation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now()
    };

    this.annotations.set(fullAnnotation.id, fullAnnotation);
    this.updateAnnotationDecoration(fullAnnotation);

    this.emit('annotationAdded', fullAnnotation);
    return fullAnnotation;
  }

  /**
   * Update annotation
   */
  updateAnnotation(annotationId: string, updates: Partial<Annotation>): boolean {
    const annotation = this.annotations.get(annotationId);
    if (!annotation) return false;

    const updatedAnnotation = { ...annotation, ...updates, timestamp: Date.now() };
    this.annotations.set(annotationId, updatedAnnotation);
    this.updateAnnotationDecoration(updatedAnnotation);

    this.emit('annotationUpdated', updatedAnnotation);
    return true;
  }

  /**
   * Remove annotation
   */
  removeAnnotation(annotationId: string): boolean {
    const annotation = this.annotations.get(annotationId);
    if (!annotation) return false;

    this.annotations.delete(annotationId);
    this.removeAnnotationDecoration(annotationId);

    this.emit('annotationRemoved', annotationId);
    return true;
  }

  /**
   * Get all selections
   */
  getSelections(): Selection[] {
    return Array.from(this.selections.values());
  }

  /**
   * Get selections by user
   */
  getSelectionsByUser(userId: string): Selection[] {
    return this.getSelections().filter(s => s.userId === userId);
  }

  /**
   * Get all highlights
   */
  getHighlights(): Highlight[] {
    return Array.from(this.highlights.values());
  }

  /**
   * Get highlights by type
   */
  getHighlightsByType(type: HighlightType): Highlight[] {
    return this.getHighlights().filter(h => h.type === type);
  }

  /**
   * Get all annotations
   */
  getAnnotations(): Annotation[] {
    return Array.from(this.annotations.values());
  }

  /**
   * Get unresolved annotations
   */
  getUnresolvedAnnotations(): Annotation[] {
    return this.getAnnotations().filter(a => !a.resolved);
  }

  /**
   * Clear all selections for a user
   */
  clearUserSelections(userId: string): void {
    const userSelections = this.getSelectionsByUser(userId);
    userSelections.forEach(selection => {
      this.removeSelection(selection.id);
    });
  }

  /**
   * Clear all temporary selections
   */
  clearTemporarySelections(): void {
    const temporarySelections = this.getSelections().filter(s => s.temporary);
    temporarySelections.forEach(selection => {
      this.removeSelection(selection.id);
    });
  }

  /**
   * Add event listener
   */
  on<K extends keyof SelectionSyncEvents>(
    event: K,
    callback: SelectionSyncEvents[K]
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback as (...args: unknown[]) => void);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof SelectionSyncEvents>(
    event: K,
    callback: SelectionSyncEvents[K]
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
  private emit<K extends keyof SelectionSyncEvents>(
    event: K,
    ...args: Parameters<SelectionSyncEvents[K]>
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in selection sync event listener:`, error);
        }
      });
    }
  }

  /**
   * Set up Monaco editor event listeners
   */
  private setupEditorListeners(): void {
    if (!this.editor || !this.currentUser) return;

    // Track selection changes
    this.editor.onDidChangeCursorSelection((e) => {
      if (!this.currentUser || e.selection.isEmpty()) return;

      const selection: Omit<Selection, 'id' | 'timestamp'> = {
        userId: this.currentUser.id,
        type: SelectionType.TEXT,
        startLine: e.selection.startLineNumber,
        startColumn: e.selection.startColumn,
        endLine: e.selection.endLineNumber,
        endColumn: e.selection.endColumn,
        text: this.editor!.getModel()!.getValueInRange(e.selection),
        temporary: true
      };

      // Remove previous temporary selections for this user
      this.clearUserSelections(this.currentUser.id);
      
      // Add new selection
      this.addSelection(selection);
    });
  }

  /**
   * Update selection decoration in Monaco editor
   */
  private updateSelectionDecoration(selection: Selection): void {
    if (!this.editor) return;

    // Remove existing decoration
    this.removeSelectionDecoration(selection.id);

    const decoration: editor.IModelDeltaDecoration = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      range: new (this.editor.getModel()!.constructor as any).Range(
        selection.startLine,
        selection.startColumn,
        selection.endLine,
        selection.endColumn
      ),
      options: {
        className: `selection-${selection.userId}`,
        stickiness: 1,
        zIndex: 998
      }
    };

    const decorationIds = this.editor.deltaDecorations([], [decoration]);
    this.decorations.set(selection.id, decorationIds);
  }

  /**
   * Remove selection decoration
   */
  private removeSelectionDecoration(selectionId: string): void {
    if (!this.editor) return;

    const decorationIds = this.decorations.get(selectionId);
    if (decorationIds) {
      this.editor.deltaDecorations(decorationIds, []);
      this.decorations.delete(selectionId);
    }
  }

  /**
   * Update highlight decoration
   */
  private updateHighlightDecoration(highlight: Highlight): void {
    if (!this.editor) return;

    const className = `highlight-${highlight.type}-${highlight.userId}`;
    const decoration: editor.IModelDeltaDecoration = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      range: new (this.editor.getModel()!.constructor as any).Range(
        highlight.startLine,
        highlight.startColumn,
        highlight.endLine,
        highlight.endColumn
      ),
      options: {
        className,
        stickiness: 1,
        zIndex: 997
      }
    };

    const decorationIds = this.editor.deltaDecorations([], [decoration]);
    this.decorations.set(highlight.id, decorationIds);

    // Add CSS for highlight
    this.addHighlightStyles(highlight);
  }

  /**
   * Remove highlight decoration
   */
  private removeHighlightDecoration(highlightId: string): void {
    if (!this.editor) return;

    const decorationIds = this.decorations.get(highlightId);
    if (decorationIds) {
      this.editor.deltaDecorations(decorationIds, []);
      this.decorations.delete(highlightId);
    }
  }

  /**
   * Update annotation decoration
   */
  private updateAnnotationDecoration(annotation: Annotation): void {
    if (!this.editor) return;

    const decoration: editor.IModelDeltaDecoration = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      range: new (this.editor.getModel()!.constructor as any).Range(
        annotation.line,
        annotation.column,
        annotation.line,
        annotation.column
      ),
      options: {
        glyphMarginClassName: `annotation-${annotation.type}`,
        stickiness: 1,
        zIndex: 1001
      }
    };

    const decorationIds = this.editor.deltaDecorations([], [decoration]);
    this.decorations.set(annotation.id, decorationIds);
  }

  /**
   * Remove annotation decoration
   */
  private removeAnnotationDecoration(annotationId: string): void {
    if (!this.editor) return;

    const decorationIds = this.decorations.get(annotationId);
    if (decorationIds) {
      this.editor.deltaDecorations(decorationIds, []);
      this.decorations.delete(annotationId);
    }
  }

  /**
   * Add CSS styles for highlights
   */
  private addHighlightStyles(highlight: Highlight): void {
    const styleId = `highlight-style-${highlight.type}`;
    
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    
    const colors = this.getHighlightColors(highlight.type);
    
    style.textContent = `
      .highlight-${highlight.type}-${highlight.userId} {
        background-color: ${colors.background} !important;
        border: 1px solid ${colors.border};
        border-radius: 2px;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Get colors for highlight type
   */
  private getHighlightColors(type: HighlightType): { background: string; border: string } {
    switch (type) {
      case HighlightType.ERROR:
        return { background: '#ffebee', border: '#f44336' };
      case HighlightType.WARNING:
        return { background: '#fff3e0', border: '#ff9800' };
      case HighlightType.INFO:
        return { background: '#e3f2fd', border: '#2196f3' };
      case HighlightType.COMMENT:
        return { background: '#f3e5f5', border: '#9c27b0' };
      case HighlightType.ANNOTATION:
        return { background: '#e8f5e8', border: '#4caf50' };
      default:
        return { background: '#f5f5f5', border: '#9e9e9e' };
    }
  }

  /**
   * Set timeout for temporary selection
   */
  private setTemporarySelectionTimeout(selectionId: string): void {
    const timeout = setTimeout(() => {
      this.removeSelection(selectionId);
    }, this.TEMPORARY_SELECTION_TIMEOUT);

    this.temporarySelectionTimeouts.set(selectionId, timeout);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear all timeouts
    for (const timeout of this.temporarySelectionTimeouts.values()) {
      clearTimeout(timeout);
    }

    // Clear all decorations
    if (this.editor) {
      for (const decorationIds of this.decorations.values()) {
        this.editor.deltaDecorations(decorationIds, []);
      }
    }

    this.selections.clear();
    this.highlights.clear();
    this.annotations.clear();
    this.decorations.clear();
    this.temporarySelectionTimeouts.clear();
    this.eventListeners.clear();
    this.editor = null;
    this.currentUser = null;
  }
}

/**
 * Create selection synchronizer instance
 */
export function createSelectionSynchronizer(currentUser?: CollaborativeUser): SelectionSynchronizer {
  return new SelectionSynchronizer(currentUser);
}
