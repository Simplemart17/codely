/**
 * Network Error Handling for CRDT Operations
 * 
 * This module implements robust error handling for network-related issues
 * in collaborative editing sessions, including retry logic and fallback strategies.
 */

/**
 * Network error types
 */
export enum NetworkErrorType {
  CONNECTION_FAILED = 'connection_failed',
  CONNECTION_TIMEOUT = 'connection_timeout',
  CONNECTION_LOST = 'connection_lost',
  MESSAGE_TIMEOUT = 'message_timeout',
  MESSAGE_FAILED = 'message_failed',
  AUTHENTICATION_FAILED = 'authentication_failed',
  RATE_LIMITED = 'rate_limited',
  SERVER_ERROR = 'server_error',
  PROTOCOL_ERROR = 'protocol_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Recovery strategies
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  RECONNECT = 'reconnect',
  FALLBACK = 'fallback',
  QUEUE = 'queue',
  IGNORE = 'ignore',
  ESCALATE = 'escalate'
}

/**
 * Network error interface
 */
export interface NetworkError {
  id: string;
  type: NetworkErrorType;
  severity: ErrorSeverity;
  message: string;
  timestamp: number;
  context: any;
  retryCount: number;
  maxRetries: number;
  recoveryStrategy: RecoveryStrategy;
  originalError?: Error;
}

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
  maxRetries: number;
  retryDelay: number;
  maxRetryDelay: number;
  backoffMultiplier: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  enableFallback: boolean;
  fallbackTimeout: number;
  errorReportingEnabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Error statistics
 */
export interface ErrorStats {
  totalErrors: number;
  errorsByType: Map<NetworkErrorType, number>;
  errorsBySeverity: Map<ErrorSeverity, number>;
  retriedErrors: number;
  recoveredErrors: number;
  failedRecoveries: number;
  circuitBreakerTrips: number;
  averageRecoveryTime: number;
}

/**
 * Network Error Handler class
 */
export class NetworkErrorHandler {
  private config: ErrorHandlingConfig;
  private stats: ErrorStats;
  private circuitBreakerState: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private circuitBreakerFailures: number = 0;
  private circuitBreakerLastFailure: number = 0;
  private errorQueue: NetworkError[] = [];
  private eventListeners: Map<string, Function[]> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<ErrorHandlingConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      maxRetryDelay: 30000,
      backoffMultiplier: 2,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      enableFallback: true,
      fallbackTimeout: 5000,
      errorReportingEnabled: true,
      logLevel: 'error',
      ...config
    };

    this.stats = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsBySeverity: new Map(),
      retriedErrors: 0,
      recoveredErrors: 0,
      failedRecoveries: 0,
      circuitBreakerTrips: 0,
      averageRecoveryTime: 0
    };
  }

  /**
   * Handle network error
   */
  async handleError(
    error: Error | NetworkError,
    context?: any
  ): Promise<{ recovered: boolean; strategy: RecoveryStrategy }> {
    const networkError = this.normalizeError(error, context);
    
    this.updateStats(networkError);
    this.logError(networkError);
    this.emit('errorOccurred', networkError);

    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      this.emit('circuitBreakerOpen', networkError);
      return { recovered: false, strategy: RecoveryStrategy.IGNORE };
    }

    // Determine recovery strategy
    const strategy = this.determineRecoveryStrategy(networkError);
    networkError.recoveryStrategy = strategy;

    try {
      const recovered = await this.executeRecoveryStrategy(networkError, strategy);
      
      if (recovered) {
        this.stats.recoveredErrors++;
        this.resetCircuitBreaker();
        this.emit('errorRecovered', networkError);
      } else {
        this.stats.failedRecoveries++;
        this.updateCircuitBreaker();
        this.emit('recoveryFailed', networkError);
      }

      return { recovered, strategy };
    } catch (recoveryError) {
      this.stats.failedRecoveries++;
      this.updateCircuitBreaker();
      this.emit('recoveryError', { networkError, recoveryError });
      return { recovered: false, strategy };
    }
  }

  /**
   * Get error statistics
   */
  getStats(): ErrorStats {
    return {
      ...this.stats,
      errorsByType: new Map(this.stats.errorsByType),
      errorsBySeverity: new Map(this.stats.errorsBySeverity)
    };
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreakerState;
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerState = CircuitBreakerState.CLOSED;
    this.circuitBreakerFailures = 0;
    this.circuitBreakerLastFailure = 0;
    this.emit('circuitBreakerReset');
  }

  /**
   * Clear error queue
   */
  clearErrorQueue(): void {
    this.errorQueue = [];
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
   * Normalize error to NetworkError format
   */
  private normalizeError(error: Error | NetworkError, context?: any): NetworkError {
    if (this.isNetworkError(error)) {
      return error as NetworkError;
    }

    const errorType = this.classifyError(error as Error);
    const severity = this.determineSeverity(errorType);

    return {
      id: this.generateErrorId(),
      type: errorType,
      severity,
      message: error.message,
      timestamp: Date.now(),
      context: context || {},
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      recoveryStrategy: RecoveryStrategy.RETRY,
      originalError: error as Error
    };
  }

  /**
   * Check if error is already a NetworkError
   */
  private isNetworkError(error: any): boolean {
    return error && typeof error === 'object' && 'type' in error && 'severity' in error;
  }

  /**
   * Classify error type
   */
  private classifyError(error: Error): NetworkErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) {
      return NetworkErrorType.CONNECTION_TIMEOUT;
    } else if (message.includes('connection') && message.includes('failed')) {
      return NetworkErrorType.CONNECTION_FAILED;
    } else if (message.includes('connection') && message.includes('lost')) {
      return NetworkErrorType.CONNECTION_LOST;
    } else if (message.includes('authentication')) {
      return NetworkErrorType.AUTHENTICATION_FAILED;
    } else if (message.includes('rate limit')) {
      return NetworkErrorType.RATE_LIMITED;
    } else if (message.includes('server error') || message.includes('5')) {
      return NetworkErrorType.SERVER_ERROR;
    } else if (message.includes('protocol')) {
      return NetworkErrorType.PROTOCOL_ERROR;
    } else {
      return NetworkErrorType.UNKNOWN_ERROR;
    }
  }

  /**
   * Determine error severity
   */
  private determineSeverity(errorType: NetworkErrorType): ErrorSeverity {
    switch (errorType) {
      case NetworkErrorType.CONNECTION_FAILED:
      case NetworkErrorType.AUTHENTICATION_FAILED:
        return ErrorSeverity.CRITICAL;
      
      case NetworkErrorType.CONNECTION_LOST:
      case NetworkErrorType.SERVER_ERROR:
        return ErrorSeverity.HIGH;
      
      case NetworkErrorType.CONNECTION_TIMEOUT:
      case NetworkErrorType.MESSAGE_TIMEOUT:
        return ErrorSeverity.MEDIUM;
      
      default:
        return ErrorSeverity.LOW;
    }
  }

  /**
   * Determine recovery strategy
   */
  private determineRecoveryStrategy(error: NetworkError): RecoveryStrategy {
    // Check if max retries exceeded
    if (error.retryCount >= error.maxRetries) {
      if (error.severity === ErrorSeverity.CRITICAL) {
        return RecoveryStrategy.ESCALATE;
      } else {
        return RecoveryStrategy.FALLBACK;
      }
    }

    // Strategy based on error type
    switch (error.type) {
      case NetworkErrorType.CONNECTION_FAILED:
      case NetworkErrorType.CONNECTION_LOST:
        return RecoveryStrategy.RECONNECT;
      
      case NetworkErrorType.CONNECTION_TIMEOUT:
      case NetworkErrorType.MESSAGE_TIMEOUT:
        return RecoveryStrategy.RETRY;
      
      case NetworkErrorType.RATE_LIMITED:
        return RecoveryStrategy.QUEUE;
      
      case NetworkErrorType.AUTHENTICATION_FAILED:
        return RecoveryStrategy.ESCALATE;
      
      case NetworkErrorType.SERVER_ERROR:
        return error.retryCount < 2 ? RecoveryStrategy.RETRY : RecoveryStrategy.FALLBACK;
      
      default:
        return RecoveryStrategy.RETRY;
    }
  }

  /**
   * Execute recovery strategy
   */
  private async executeRecoveryStrategy(
    error: NetworkError,
    strategy: RecoveryStrategy
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      switch (strategy) {
        case RecoveryStrategy.RETRY:
          return await this.executeRetry(error);
        
        case RecoveryStrategy.RECONNECT:
          return await this.executeReconnect(error);
        
        case RecoveryStrategy.FALLBACK:
          return await this.executeFallback(error);
        
        case RecoveryStrategy.QUEUE:
          return await this.executeQueue(error);
        
        case RecoveryStrategy.IGNORE:
          return true; // Consider ignored errors as "recovered"
        
        case RecoveryStrategy.ESCALATE:
          return await this.executeEscalate(error);
        
        default:
          return false;
      }
    } finally {
      const recoveryTime = Date.now() - startTime;
      this.updateRecoveryTimeStats(recoveryTime);
    }
  }

  /**
   * Execute retry strategy
   */
  private async executeRetry(error: NetworkError): Promise<boolean> {
    error.retryCount++;
    this.stats.retriedErrors++;

    const delay = Math.min(
      this.config.retryDelay * Math.pow(this.config.backoffMultiplier, error.retryCount - 1),
      this.config.maxRetryDelay
    );

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.retryTimers.delete(error.id);
        // In a real implementation, this would retry the original operation
        // For now, we'll simulate a 70% success rate
        resolve(Math.random() > 0.3);
      }, delay);

      this.retryTimers.set(error.id, timer);
    });
  }

  /**
   * Execute reconnect strategy
   */
  private async executeReconnect(error: NetworkError): Promise<boolean> {
    // In a real implementation, this would trigger a reconnection
    // For now, we'll simulate reconnection
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(Math.random() > 0.2); // 80% success rate
      }, 2000);
    });
  }

  /**
   * Execute fallback strategy
   */
  private async executeFallback(error: NetworkError): Promise<boolean> {
    if (!this.config.enableFallback) {
      return false;
    }

    // In a real implementation, this would use a fallback mechanism
    // For now, we'll simulate fallback
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true); // Fallback always succeeds
      }, this.config.fallbackTimeout);
    });
  }

  /**
   * Execute queue strategy
   */
  private async executeQueue(error: NetworkError): Promise<boolean> {
    this.errorQueue.push(error);
    this.emit('errorQueued', error);
    return true; // Queuing always succeeds
  }

  /**
   * Execute escalate strategy
   */
  private async executeEscalate(error: NetworkError): Promise<boolean> {
    this.emit('errorEscalated', error);
    return false; // Escalation means we can't recover automatically
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(): boolean {
    if (!this.config.enableCircuitBreaker) {
      return false;
    }

    if (this.circuitBreakerState === CircuitBreakerState.OPEN) {
      // Check if timeout has passed
      if (Date.now() - this.circuitBreakerLastFailure > this.config.circuitBreakerTimeout) {
        this.circuitBreakerState = CircuitBreakerState.HALF_OPEN;
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Update circuit breaker on failure
   */
  private updateCircuitBreaker(): void {
    if (!this.config.enableCircuitBreaker) {
      return;
    }

    this.circuitBreakerFailures++;
    this.circuitBreakerLastFailure = Date.now();

    if (this.circuitBreakerFailures >= this.config.circuitBreakerThreshold) {
      this.circuitBreakerState = CircuitBreakerState.OPEN;
      this.stats.circuitBreakerTrips++;
      this.emit('circuitBreakerTripped');
    }
  }

  /**
   * Update statistics
   */
  private updateStats(error: NetworkError): void {
    this.stats.totalErrors++;
    
    const typeCount = this.stats.errorsByType.get(error.type) || 0;
    this.stats.errorsByType.set(error.type, typeCount + 1);
    
    const severityCount = this.stats.errorsBySeverity.get(error.severity) || 0;
    this.stats.errorsBySeverity.set(error.severity, severityCount + 1);
  }

  /**
   * Update recovery time statistics
   */
  private updateRecoveryTimeStats(recoveryTime: number): void {
    if (this.stats.averageRecoveryTime === 0) {
      this.stats.averageRecoveryTime = recoveryTime;
    } else {
      this.stats.averageRecoveryTime = (this.stats.averageRecoveryTime + recoveryTime) / 2;
    }
  }

  /**
   * Log error based on configuration
   */
  private logError(error: NetworkError): void {
    if (!this.config.errorReportingEnabled) {
      return;
    }

    const logMessage = `[${error.severity.toUpperCase()}] ${error.type}: ${error.message}`;
    
    switch (this.config.logLevel) {
      case 'debug':
        console.debug(logMessage, error);
        break;
      case 'info':
        if (error.severity !== ErrorSeverity.LOW) {
          console.info(logMessage);
        }
        break;
      case 'warn':
        if (error.severity === ErrorSeverity.MEDIUM || error.severity === ErrorSeverity.HIGH) {
          console.warn(logMessage);
        }
        break;
      case 'error':
        if (error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.CRITICAL) {
          console.error(logMessage, error);
        }
        break;
    }
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
          console.error('Error in error handler event listener:', error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear all retry timers
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
    
    this.errorQueue = [];
    this.eventListeners.clear();
  }
}

/**
 * Create network error handler instance
 */
export function createNetworkErrorHandler(
  config?: Partial<ErrorHandlingConfig>
): NetworkErrorHandler {
  return new NetworkErrorHandler(config);
}

/**
 * Default error handling configuration
 */
export const defaultErrorHandlingConfig: ErrorHandlingConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  maxRetryDelay: 30000,
  backoffMultiplier: 2,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000,
  enableFallback: true,
  fallbackTimeout: 5000,
  errorReportingEnabled: true,
  logLevel: 'error'
};
