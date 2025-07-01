/**
 * Comprehensive error handling system for Codely platform
 */

// Error types and classifications
export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  SESSION = 'SESSION',
  EDITOR = 'EDITOR',
  EXECUTION = 'EXECUTION',
  WEBSOCKET = 'WEBSOCKET',
  UNKNOWN = 'UNKNOWN',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  details?: string;
  code?: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  stack?: string;
  userMessage?: string;
  retryable?: boolean;
  actions?: ErrorAction[];
}

export interface ErrorAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
}

// Custom error classes
export class CodelyError extends Error {
  public readonly id: string;
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly code?: string;
  public readonly context?: Record<string, unknown>;
  public readonly userMessage?: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    options: {
      code?: string;
      context?: Record<string, unknown>;
      userMessage?: string;
      retryable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'CodelyError';
    this.id = this.generateId();
    this.type = type;
    this.severity = severity;
    this.code = options.code;
    this.context = options.context;
    this.userMessage = options.userMessage || this.getDefaultUserMessage();
    this.retryable = options.retryable ?? this.isRetryableByDefault();

    if (options.cause) {
      this.stack = options.cause.stack;
    }
  }

  private generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private getDefaultUserMessage(): string {
    switch (this.type) {
      case ErrorType.NETWORK:
        return 'Network connection issue. Please check your internet connection and try again.';
      case ErrorType.AUTHENTICATION:
        return 'Authentication failed. Please log in again.';
      case ErrorType.AUTHORIZATION:
        return 'You don\'t have permission to perform this action.';
      case ErrorType.SESSION:
        return 'Session error occurred. Please refresh the page.';
      case ErrorType.EDITOR:
        return 'Code editor encountered an issue. Please try refreshing.';
      case ErrorType.EXECUTION:
        return 'Code execution failed. Please check your code and try again.';
      case ErrorType.WEBSOCKET:
        return 'Real-time connection lost. Attempting to reconnect...';
      case ErrorType.VALIDATION:
        return 'Invalid input provided. Please check your data and try again.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  private isRetryableByDefault(): boolean {
    return [ErrorType.NETWORK, ErrorType.WEBSOCKET, ErrorType.SESSION].includes(this.type);
  }

  toAppError(): AppError {
    return {
      id: this.id,
      type: this.type,
      severity: this.severity,
      message: this.message,
      code: this.code,
      timestamp: new Date(),
      context: this.context,
      stack: this.stack,
      userMessage: this.userMessage,
      retryable: this.retryable,
    };
  }
}

// Specific error classes
export class NetworkError extends CodelyError {
  constructor(message: string, options?: { code?: string; context?: Record<string, unknown> }) {
    super(message, ErrorType.NETWORK, ErrorSeverity.MEDIUM, {
      ...options,
      retryable: true,
    });
  }
}

export class ValidationError extends CodelyError {
  constructor(message: string, field?: string, value?: unknown) {
    super(message, ErrorType.VALIDATION, ErrorSeverity.LOW, {
      context: { field, value },
      retryable: false,
    });
  }
}

export class AuthenticationError extends CodelyError {
  constructor(message: string = 'Authentication required') {
    super(message, ErrorType.AUTHENTICATION, ErrorSeverity.HIGH, {
      retryable: false,
    });
  }
}

export class AuthorizationError extends CodelyError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, ErrorType.AUTHORIZATION, ErrorSeverity.HIGH, {
      retryable: false,
    });
  }
}

export class SessionError extends CodelyError {
  constructor(message: string, sessionId?: string) {
    super(message, ErrorType.SESSION, ErrorSeverity.MEDIUM, {
      context: { sessionId },
      retryable: true,
    });
  }
}

export class EditorError extends CodelyError {
  constructor(message: string, editorContext?: Record<string, unknown>) {
    super(message, ErrorType.EDITOR, ErrorSeverity.MEDIUM, {
      context: editorContext,
      retryable: true,
    });
  }
}

export class ExecutionError extends CodelyError {
  constructor(message: string, code?: string, language?: string) {
    super(message, ErrorType.EXECUTION, ErrorSeverity.LOW, {
      context: { code, language },
      retryable: true,
    });
  }
}

export class WebSocketError extends CodelyError {
  constructor(message: string, event?: string) {
    super(message, ErrorType.WEBSOCKET, ErrorSeverity.MEDIUM, {
      context: { event },
      retryable: true,
    });
  }
}

// Error handler class
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorQueue: AppError[] = [];
  private maxQueueSize = 100;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  handle(error: Error | CodelyError, context?: Record<string, unknown>): AppError {
    let appError: AppError;

    if (error instanceof CodelyError) {
      appError = error.toAppError();
    } else {
      // Convert regular Error to AppError
      appError = {
        id: this.generateId(),
        type: this.classifyError(error),
        severity: ErrorSeverity.MEDIUM,
        message: error.message,
        timestamp: new Date(),
        context,
        stack: error.stack,
        userMessage: 'An unexpected error occurred. Please try again.',
        retryable: true,
      };
    }

    // Add to error queue
    this.addToQueue(appError);

    // Log error
    this.logError(appError);

    // Report to monitoring service
    this.reportError(appError);

    return appError;
  }

  private generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorType.NETWORK;
    }
    if (message.includes('auth') || message.includes('unauthorized')) {
      return ErrorType.AUTHENTICATION;
    }
    if (message.includes('permission') || message.includes('forbidden')) {
      return ErrorType.AUTHORIZATION;
    }
    if (message.includes('websocket') || message.includes('socket')) {
      return ErrorType.WEBSOCKET;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION;
    }
    
    return ErrorType.UNKNOWN;
  }

  private addToQueue(error: AppError): void {
    this.errorQueue.push(error);
    
    // Keep queue size manageable
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }
  }

  private logError(error: AppError): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = `[${error.type}] ${error.message}`;
    
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 ${error.severity} Error (${error.id})`);
      console[logLevel](logMessage);
      if (error.context) {
        console.log('Context:', error.context);
      }
      if (error.stack) {
        console.log('Stack:', error.stack);
      }
      console.groupEnd();
    }
  }

  private getLogLevel(severity: ErrorSeverity): 'log' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'log';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return 'error';
      default:
        return 'warn';
    }
  }

  private async reportError(error: AppError): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      try {
        await fetch('/api/errors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(error),
        });
      } catch (reportError) {
        console.error('Failed to report error:', reportError);
      }
    }
  }

  getRecentErrors(limit: number = 10): AppError[] {
    return this.errorQueue.slice(-limit);
  }

  clearErrors(): void {
    this.errorQueue = [];
  }
}

// Utility functions
export const handleError = (error: Error | CodelyError, context?: Record<string, unknown>): AppError => {
  return ErrorHandler.getInstance().handle(error, context);
};

export const createRetryAction = (fn: () => void | Promise<void>, label: string = 'Retry'): ErrorAction => ({
  label,
  action: fn,
  primary: true,
});

export const createNavigationAction = (path: string, label: string): ErrorAction => ({
  label,
  action: () => {
    if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  },
});

export const createReloadAction = (label: string = 'Reload Page'): ErrorAction => ({
  label,
  action: () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  },
});

// React hook for error handling
export const useErrorHandler = () => {
  const handler = ErrorHandler.getInstance();

  return {
    handleError: (error: Error | CodelyError, context?: Record<string, unknown>) =>
      handler.handle(error, context),
    getRecentErrors: () => handler.getRecentErrors(),
    clearErrors: () => handler.clearErrors(),
  };
};

export default ErrorHandler;
