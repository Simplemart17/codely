/**
 * Monitoring and logging system for Codely platform
 */

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

// Log entry interface
export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Performance metrics
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

// User activity tracking
export interface UserActivity {
  userId: string;
  sessionId?: string;
  action: string;
  component: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Logger class
class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogSize = 1000;
  private logLevel: LogLevel = LogLevel.INFO;

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  constructor() {
    // Set log level based on environment
    if (process.env.NODE_ENV === 'development') {
      this.logLevel = LogLevel.DEBUG;
    } else if (process.env.NODE_ENV === 'production') {
      this.logLevel = LogLevel.WARN;
    }
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    return {
      id: this.generateId(),
      level,
      message,
      timestamp: new Date(),
      context,
      userId: this.getCurrentUserId(),
      sessionId: this.getCurrentSessionId(),
      component: context?.component as string | undefined,
      action: context?.action as string | undefined,
      duration: context?.duration as number | undefined,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };
  }

  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private getCurrentUserId(): string | undefined {
    // In a real app, get from auth context
    return typeof window !== 'undefined' 
      ? localStorage.getItem('userId') || undefined
      : undefined;
  }

  private getCurrentSessionId(): string | undefined {
    // In a real app, get from session context
    return typeof window !== 'undefined'
      ? sessionStorage.getItem('sessionId') || undefined
      : undefined;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private addToLogs(entry: LogEntry): void {
    this.logs.push(entry);
    
    // Keep logs within size limit
    if (this.logs.length > this.maxLogSize) {
      this.logs.shift();
    }
  }

  private formatLogMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level];
    const component = entry.component ? `[${entry.component}]` : '';
    const action = entry.action ? `(${entry.action})` : '';
    const duration = entry.duration ? ` ${entry.duration}ms` : '';
    
    return `${timestamp} ${level} ${component}${action} ${entry.message}${duration}`;
  }

  private async sendToMonitoring(entry: LogEntry): Promise<void> {
    if (process.env.NODE_ENV === 'production' && entry.level >= LogLevel.WARN) {
      try {
        await fetch('/api/monitoring/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entry),
        });
      } catch (error) {
        console.error('Failed to send log to monitoring service:', error);
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const entry = this.createLogEntry(LogLevel.DEBUG, message, context);
    this.addToLogs(entry);
    console.debug(this.formatLogMessage(entry), context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const entry = this.createLogEntry(LogLevel.INFO, message, context);
    this.addToLogs(entry);
    console.info(this.formatLogMessage(entry), context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const entry = this.createLogEntry(LogLevel.WARN, message, context);
    this.addToLogs(entry);
    console.warn(this.formatLogMessage(entry), context);
    this.sendToMonitoring(entry);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const entry = this.createLogEntry(LogLevel.ERROR, message, context, error);
    this.addToLogs(entry);
    console.error(this.formatLogMessage(entry), error, context);
    this.sendToMonitoring(entry);
  }

  critical(message: string, error?: Error, context?: Record<string, unknown>): void {
    const entry = this.createLogEntry(LogLevel.CRITICAL, message, context, error);
    this.addToLogs(entry);
    console.error(`🚨 CRITICAL: ${this.formatLogMessage(entry)}`, error, context);
    this.sendToMonitoring(entry);
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter(log => log.level >= level);
    }
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

// Performance monitoring
class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private maxMetricsSize = 500;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  recordMetric(name: string, value: number, unit: string = 'ms', context?: Record<string, unknown>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      context,
    };

    this.metrics.push(metric);
    
    // Keep metrics within size limit
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics.shift();
    }

    // Log performance metric
    Logger.getInstance().debug(`Performance: ${name} = ${value}${unit}`, context);

    // Send to monitoring service
    this.sendMetricToMonitoring(metric);
  }

  private async sendMetricToMonitoring(metric: PerformanceMetric): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      try {
        await fetch('/api/monitoring/metrics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metric),
        });
      } catch (error) {
        console.error('Failed to send metric to monitoring service:', error);
      }
    }
  }

  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter(metric => metric.name === name);
    }
    return [...this.metrics];
  }

  getAverageMetric(name: string): number | null {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) return null;
    
    const sum = metrics.reduce((total, metric) => total + metric.value, 0);
    return sum / metrics.length;
  }

  clearMetrics(): void {
    this.metrics = [];
  }
}

// Activity tracker
class ActivityTracker {
  private static instance: ActivityTracker;
  private activities: UserActivity[] = [];
  private maxActivitiesSize = 200;

  static getInstance(): ActivityTracker {
    if (!ActivityTracker.instance) {
      ActivityTracker.instance = new ActivityTracker();
    }
    return ActivityTracker.instance;
  }

  track(action: string, component: string, metadata?: Record<string, unknown>): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    const activity: UserActivity = {
      userId,
      sessionId: this.getCurrentSessionId(),
      action,
      component,
      timestamp: new Date(),
      metadata,
    };

    this.activities.push(activity);
    
    // Keep activities within size limit
    if (this.activities.length > this.maxActivitiesSize) {
      this.activities.shift();
    }

    // Log activity
    Logger.getInstance().debug(`Activity: ${component}.${action}`, metadata);

    // Send to analytics service
    this.sendActivityToAnalytics(activity);
  }

  private getCurrentUserId(): string | undefined {
    return typeof window !== 'undefined' 
      ? localStorage.getItem('userId') || undefined
      : undefined;
  }

  private getCurrentSessionId(): string | undefined {
    return typeof window !== 'undefined'
      ? sessionStorage.getItem('sessionId') || undefined
      : undefined;
  }

  private async sendActivityToAnalytics(activity: UserActivity): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      try {
        await fetch('/api/analytics/activity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(activity),
        });
      } catch (error) {
        console.error('Failed to send activity to analytics service:', error);
      }
    }
  }

  getActivities(userId?: string): UserActivity[] {
    if (userId) {
      return this.activities.filter(activity => activity.userId === userId);
    }
    return [...this.activities];
  }

  clearActivities(): void {
    this.activities = [];
  }
}

// Singleton instances
export const logger = Logger.getInstance();
export const performanceMonitor = PerformanceMonitor.getInstance();
export const activityTracker = ActivityTracker.getInstance();

// Utility functions
export const measureAsync = async <T>(
  fn: () => Promise<T>,
  name: string,
  context?: Record<string, unknown>
): Promise<T> => {
  const startTime = performance.now();
  logger.debug(`Starting ${name}`, context);
  
  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    
    performanceMonitor.recordMetric(name, duration, 'ms', context);
    logger.debug(`Completed ${name}`, { ...context, duration });
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    logger.error(`Failed ${name}`, error as Error, { ...context, duration });
    throw error;
  }
};

export const measureSync = <T>(
  fn: () => T,
  name: string,
  context?: Record<string, unknown>
): T => {
  const startTime = performance.now();
  logger.debug(`Starting ${name}`, context);
  
  try {
    const result = fn();
    const duration = performance.now() - startTime;
    
    performanceMonitor.recordMetric(name, duration, 'ms', context);
    logger.debug(`Completed ${name}`, { ...context, duration });
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    logger.error(`Failed ${name}`, error as Error, { ...context, duration });
    throw error;
  }
};

// React hooks
export const useLogger = () => logger;
export const usePerformanceMonitor = () => performanceMonitor;
export const useActivityTracker = () => activityTracker;

const monitoringExports = {
  logger,
  performanceMonitor,
  activityTracker,
  measureAsync,
  measureSync,
};

export default monitoringExports;
