/**
 * Cursor Animation and Smooth Transitions System
 * 
 * This module provides smooth animations and transitions for collaborative
 * cursors and selections in the Monaco editor.
 */

import type { editor } from 'monaco-editor';
import { CursorPosition } from './document';

/**
 * Animation types
 */
export enum AnimationType {
  FADE_IN = 'fadeIn',
  FADE_OUT = 'fadeOut',
  SLIDE = 'slide',
  BOUNCE = 'bounce',
  PULSE = 'pulse',
  BLINK = 'blink'
}

/**
 * Animation configuration
 */
export interface AnimationConfig {
  duration: number; // milliseconds
  easing: string; // CSS easing function
  delay?: number; // milliseconds
  iterations?: number | 'infinite';
}

/**
 * Cursor animation state
 */
export interface CursorAnimationState {
  userId: string;
  currentPosition: CursorPosition;
  targetPosition: CursorPosition;
  animationId?: number;
  isAnimating: boolean;
  startTime: number;
  duration: number;
}

/**
 * Animation presets
 */
export const ANIMATION_PRESETS: Record<string, AnimationConfig> = {
  smooth: {
    duration: 200,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  fast: {
    duration: 100,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  slow: {
    duration: 400,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  bounce: {
    duration: 300,
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  },
  elastic: {
    duration: 500,
    easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
  }
};

/**
 * Cursor Animator class for managing smooth cursor animations
 */
export class CursorAnimator {
  private animationStates: Map<string, CursorAnimationState> = new Map();
  private editor: editor.IStandaloneCodeEditor | null = null;
  private animationConfig: AnimationConfig = ANIMATION_PRESETS.smooth;
  private isEnabled: boolean = true;

  constructor(config?: Partial<AnimationConfig>) {
    if (config) {
      this.animationConfig = { ...ANIMATION_PRESETS.smooth, ...config };
    }
  }

  /**
   * Set animation configuration
   */
  setConfig(config: Partial<AnimationConfig>): void {
    this.animationConfig = { ...this.animationConfig, ...config };
  }

  /**
   * Enable or disable animations
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (!enabled) {
      // Cancel all ongoing animations
      for (const state of this.animationStates.values()) {
        if (state.animationId) {
          cancelAnimationFrame(state.animationId);
        }
      }
      this.animationStates.clear();
    }
  }

  /**
   * Bind to Monaco editor
   */
  bindEditor(editor: editor.IStandaloneCodeEditor): void {
    this.editor = editor;
  }

  /**
   * Animate cursor to new position
   */
  animateCursor(
    userId: string,
    fromPosition: CursorPosition,
    toPosition: CursorPosition,
    config?: Partial<AnimationConfig>
  ): Promise<void> {
    if (!this.isEnabled) {
      return Promise.resolve();
    }

    const animConfig = { ...this.animationConfig, ...config };
    
    // Cancel existing animation for this user
    this.cancelAnimation(userId);

    return new Promise((resolve) => {
      const state: CursorAnimationState = {
        userId,
        currentPosition: { ...fromPosition },
        targetPosition: { ...toPosition },
        isAnimating: true,
        startTime: performance.now(),
        duration: animConfig.duration
      };

      this.animationStates.set(userId, state);

      const animate = (currentTime: number) => {
        const elapsed = currentTime - state.startTime;
        const progress = Math.min(elapsed / state.duration, 1);
        
        // Apply easing function
        const easedProgress = this.applyEasing(progress, animConfig.easing);
        
        // Interpolate position
        state.currentPosition = this.interpolatePosition(
          fromPosition,
          toPosition,
          easedProgress
        );

        // Update cursor visual position
        this.updateCursorPosition(userId, state.currentPosition);

        if (progress < 1) {
          state.animationId = requestAnimationFrame(animate);
        } else {
          // Animation complete
          state.isAnimating = false;
          state.currentPosition = { ...toPosition };
          this.animationStates.delete(userId);
          resolve();
        }
      };

      state.animationId = requestAnimationFrame(animate);
    });
  }

  /**
   * Animate cursor appearance
   */
  animateCursorAppearance(
    userId: string,
    _position: CursorPosition,
    type: AnimationType = AnimationType.FADE_IN
  ): Promise<void> {
    if (!this.isEnabled) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const element = this.getCursorElement(userId);
      if (!element) {
        resolve();
        return;
      }

      const animation = this.createCSSAnimation(type, this.animationConfig);
      element.style.animation = animation;

      const handleAnimationEnd = () => {
        element.removeEventListener('animationend', handleAnimationEnd);
        element.style.animation = '';
        resolve();
      };

      element.addEventListener('animationend', handleAnimationEnd);
    });
  }

  /**
   * Animate cursor disappearance
   */
  animateCursorDisappearance(
    userId: string,
    type: AnimationType = AnimationType.FADE_OUT
  ): Promise<void> {
    if (!this.isEnabled) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const element = this.getCursorElement(userId);
      if (!element) {
        resolve();
        return;
      }

      const animation = this.createCSSAnimation(type, this.animationConfig);
      element.style.animation = animation;

      const handleAnimationEnd = () => {
        element.removeEventListener('animationend', handleAnimationEnd);
        resolve();
      };

      element.addEventListener('animationend', handleAnimationEnd);
    });
  }

  /**
   * Animate selection change
   */
  animateSelection(
    userId: string,
    fromSelection: CursorPosition['selection'],
    toSelection: CursorPosition['selection']
  ): Promise<void> {
    if (!this.isEnabled || !fromSelection || !toSelection) {
      return Promise.resolve();
    }

    // For now, we'll use a simple fade transition
    // In a more advanced implementation, we could animate the selection bounds
    const element = this.getSelectionElement(userId);
    if (!element) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      element.style.transition = `opacity ${this.animationConfig.duration}ms ${this.animationConfig.easing}`;
      element.style.opacity = '0.5';
      
      setTimeout(() => {
        element.style.opacity = '1';
        setTimeout(() => {
          element.style.transition = '';
          resolve();
        }, this.animationConfig.duration);
      }, 50);
    });
  }

  /**
   * Add typing animation effect
   */
  addTypingAnimation(userId: string): void {
    if (!this.isEnabled) return;

    const element = this.getCursorElement(userId);
    if (!element) return;

    element.classList.add('cursor-typing');
    this.addTypingAnimationStyles();
  }

  /**
   * Remove typing animation effect
   */
  removeTypingAnimation(userId: string): void {
    const element = this.getCursorElement(userId);
    if (!element) return;

    element.classList.remove('cursor-typing');
  }

  /**
   * Cancel animation for a user
   */
  cancelAnimation(userId: string): void {
    const state = this.animationStates.get(userId);
    if (state && state.animationId) {
      cancelAnimationFrame(state.animationId);
      this.animationStates.delete(userId);
    }
  }

  /**
   * Cancel all animations
   */
  cancelAllAnimations(): void {
    for (const state of this.animationStates.values()) {
      if (state.animationId) {
        cancelAnimationFrame(state.animationId);
      }
    }
    this.animationStates.clear();
  }

  /**
   * Check if user cursor is currently animating
   */
  isAnimating(userId: string): boolean {
    const state = this.animationStates.get(userId);
    return state ? state.isAnimating : false;
  }

  /**
   * Get current animation progress for a user
   */
  getAnimationProgress(userId: string): number {
    const state = this.animationStates.get(userId);
    if (!state || !state.isAnimating) return 1;

    const elapsed = performance.now() - state.startTime;
    return Math.min(elapsed / state.duration, 1);
  }

  /**
   * Apply easing function to progress
   */
  private applyEasing(progress: number, easing: string): number {
    // Simple easing implementations
    switch (easing) {
      case 'linear':
        return progress;
      case 'ease-in':
        return progress * progress;
      case 'ease-out':
        return 1 - Math.pow(1 - progress, 2);
      case 'ease-in-out':
        return progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      default:
        // For cubic-bezier, we'll use a simplified approximation
        return this.cubicBezierApproximation(progress);
    }
  }

  /**
   * Simplified cubic-bezier approximation
   */
  private cubicBezierApproximation(t: number): number {
    // Approximation of cubic-bezier(0.4, 0, 0.2, 1)
    return t * t * (3 - 2 * t);
  }

  /**
   * Interpolate between two positions
   */
  private interpolatePosition(
    from: CursorPosition,
    to: CursorPosition,
    progress: number
  ): CursorPosition {
    const result: CursorPosition = {
      line: Math.round(from.line + (to.line - from.line) * progress),
      column: Math.round(from.column + (to.column - from.column) * progress)
    };

    // Interpolate selection if both positions have it
    if (from.selection && to.selection) {
      result.selection = {
        startLine: Math.round(from.selection.startLine + (to.selection.startLine - from.selection.startLine) * progress),
        startColumn: Math.round(from.selection.startColumn + (to.selection.startColumn - from.selection.startColumn) * progress),
        endLine: Math.round(from.selection.endLine + (to.selection.endLine - from.selection.endLine) * progress),
        endColumn: Math.round(from.selection.endColumn + (to.selection.endColumn - from.selection.endColumn) * progress)
      };
    }

    return result;
  }

  /**
   * Update cursor visual position
   */
  private updateCursorPosition(userId: string, position: CursorPosition): void {
    // This would integrate with the cursor tracking system
    // to update the visual position of the cursor
    const element = this.getCursorElement(userId);
    if (!element || !this.editor) return;

    // Convert position to pixel coordinates
    const pixelPosition = this.editor.getScrolledVisiblePosition({
      lineNumber: position.line,
      column: position.column
    });

    if (pixelPosition) {
      element.style.transform = `translate(${pixelPosition.left}px, ${pixelPosition.top}px)`;
    }
  }

  /**
   * Get cursor DOM element
   */
  private getCursorElement(userId: string): HTMLElement | null {
    return document.querySelector(`.cursor-${userId}`) as HTMLElement;
  }

  /**
   * Get selection DOM element
   */
  private getSelectionElement(userId: string): HTMLElement | null {
    return document.querySelector(`.selection-${userId}`) as HTMLElement;
  }

  /**
   * Create CSS animation string
   */
  private createCSSAnimation(type: AnimationType, config: AnimationConfig): string {
    const iterations = config.iterations || 1;
    const delay = config.delay || 0;
    
    return `${type} ${config.duration}ms ${config.easing} ${delay}ms ${iterations}`;
  }

  /**
   * Add typing animation styles
   */
  private addTypingAnimationStyles(): void {
    const styleId = 'cursor-typing-animation';
    
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes cursorBlink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.3; }
      }
      
      @keyframes cursorPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.8); }
        to { opacity: 1; transform: scale(1); }
      }
      
      @keyframes fadeOut {
        from { opacity: 1; transform: scale(1); }
        to { opacity: 0; transform: scale(0.8); }
      }
      
      @keyframes slide {
        from { transform: translateX(-10px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      @keyframes bounce {
        0% { transform: translateY(-10px); }
        50% { transform: translateY(0); }
        100% { transform: translateY(-2px); }
      }
      
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
      
      .cursor-typing {
        animation: cursorBlink 1s infinite, cursorPulse 2s infinite;
      }
      
      .cursor-smooth-transition {
        transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.cancelAllAnimations();
    this.editor = null;
  }
}

/**
 * Create cursor animator instance
 */
export function createCursorAnimator(config?: Partial<AnimationConfig>): CursorAnimator {
  return new CursorAnimator(config);
}

/**
 * Utility function to create smooth transition between positions
 */
export function createSmoothTransition(
  from: CursorPosition,
  to: CursorPosition,
  duration: number = 200
): Promise<CursorPosition[]> {
  return new Promise((resolve) => {
    const frames: CursorPosition[] = [];
    const frameCount = Math.ceil(duration / 16); // ~60fps
    
    for (let i = 0; i <= frameCount; i++) {
      const progress = i / frameCount;
      const easedProgress = progress * progress * (3 - 2 * progress); // smooth step
      
      frames.push({
        line: Math.round(from.line + (to.line - from.line) * easedProgress),
        column: Math.round(from.column + (to.column - from.column) * easedProgress)
      });
    }
    
    resolve(frames);
  });
}
