/**
 * Connection State Management for CRDT Operations
 * 
 * This module manages WebSocket connection states, health monitoring,
 * and automatic recovery for collaborative editing sessions.
 */

import { EventEmitter } from 'events';

/**
 * Connection states
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
  DEGRADED = 'degraded'
}

/**
 * Connection health status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown'
}

/**
 * Connection metrics
 */
export interface ConnectionMetrics {
  latency: number;
  packetLoss: number;
  throughput: number;
  uptime: number;
  reconnectCount: number;
  lastError?: Error;
  lastHealthCheck: number;
}

/**
 * Connection configuration
 */
export interface ConnectionConfig {
  url: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  maxReconnectDelay: number;
  healthCheckInterval: number;
  timeoutDuration: number;
  heartbeatInterval: number;
  degradedThreshold: number; // latency threshold for degraded state
  criticalThreshold: number; // latency threshold for critical state
}

/**
 * Connection events
 */
export interface ConnectionEvents {
  stateChanged: (state: ConnectionState, previousState: ConnectionState) => void;
  healthChanged: (status: HealthStatus, metrics: ConnectionMetrics) => void;
  reconnectAttempt: (attempt: number, maxAttempts: number) => void;
  reconnectSuccess: () => void;
  reconnectFailed: (error: Error) => void;
  error: (error: Error) => void;
  message: (data: unknown) => void;
  latencyUpdate: (latency: number) => void;
}

/**
 * Connection Manager class for WebSocket state management
 */
export class ConnectionManager extends EventEmitter {
  private config: ConnectionConfig;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private healthStatus: HealthStatus = HealthStatus.UNKNOWN;
  private metrics: ConnectionMetrics;
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private connectionStartTime: number = 0;
  private lastPingTime: number = 0;
  private messageQueue: unknown[] = [];

  constructor(config: ConnectionConfig) {
    super();
    this.config = config;
    
    this.metrics = {
      latency: 0,
      packetLoss: 0,
      throughput: 0,
      uptime: 0,
      reconnectCount: 0,
      lastHealthCheck: 0
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.state === ConnectionState.CONNECTED || this.state === ConnectionState.CONNECTING) {
      return;
    }

    this.setState(ConnectionState.CONNECTING);
    this.connectionStartTime = Date.now();

    try {
      await this.establishConnection();
      this.setState(ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      this.startHealthMonitoring();
      this.processMessageQueue();
      this.emit('reconnectSuccess');
    } catch (error) {
      this.setState(ConnectionState.FAILED);
      this.emit('error', error as Error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.stopAllTimers();
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.setState(ConnectionState.DISCONNECTED);
    this.setHealthStatus(HealthStatus.UNKNOWN);
  }

  /**
   * Send message through connection
   */
  async send(data: unknown): Promise<void> {
    if (this.state !== ConnectionState.CONNECTED) {
      // Queue message for later sending
      this.messageQueue.push(data);
      return;
    }

    if (!this.socket) {
      throw new Error('No active connection');
    }

    try {
      this.socket.send(JSON.stringify(data));
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get current health status
   */
  getHealthStatus(): HealthStatus {
    return this.healthStatus;
  }

  /**
   * Get connection metrics
   */
  getMetrics(): ConnectionMetrics {
    this.updateUptimeMetric();
    return { ...this.metrics };
  }

  /**
   * Check if connection is healthy
   */
  isHealthy(): boolean {
    return this.state === ConnectionState.CONNECTED && 
           this.healthStatus === HealthStatus.HEALTHY;
  }

  /**
   * Force health check
   */
  async performHealthCheck(): Promise<HealthStatus> {
    if (this.state !== ConnectionState.CONNECTED) {
      this.setHealthStatus(HealthStatus.UNKNOWN);
      return this.healthStatus;
    }

    try {
      const latency = await this.measureLatency();
      this.updateLatencyMetrics(latency);
      
      const newHealthStatus = this.calculateHealthStatus(latency);
      this.setHealthStatus(newHealthStatus);
      
      this.metrics.lastHealthCheck = Date.now();
      
      return this.healthStatus;
    } catch (error) {
      this.setHealthStatus(HealthStatus.CRITICAL);
      this.emit('error', error as Error);
      return this.healthStatus;
    }
  }

  /**
   * Establish WebSocket connection
   */
  private async establishConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.config.url);
        
        const timeout = setTimeout(() => {
          if (this.socket) {
            this.socket.close();
          }
          reject(new Error('Connection timeout'));
        }, this.config.timeoutDuration);

        this.socket.onopen = () => {
          clearTimeout(timeout);
          this.setupSocketListeners();
          this.startHeartbeat();
          resolve();
        };

        this.socket.onerror = (_error) => {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        };

        this.socket.onclose = () => {
          clearTimeout(timeout);
          this.handleDisconnection();
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle pong responses for latency measurement
        if (data.type === 'pong' && data.timestamp) {
          const latency = Date.now() - data.timestamp;
          this.updateLatencyMetrics(latency);
          this.emit('latencyUpdate', latency);
          return;
        }
        
        this.emit('message', data);
      } catch (error) {
        this.emit('error', error as Error);
      }
    };

    this.socket.onerror = (_error) => {
      this.metrics.lastError = new Error('WebSocket error');
      this.emit('error', this.metrics.lastError);
    };

    this.socket.onclose = () => {
      this.handleDisconnection();
    };
  }

  /**
   * Handle connection disconnection
   */
  private handleDisconnection(): void {
    this.stopAllTimers();
    
    if (this.state === ConnectionState.CONNECTED) {
      this.setState(ConnectionState.DISCONNECTED);
      this.setHealthStatus(HealthStatus.UNKNOWN);
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      this.setState(ConnectionState.FAILED);
      this.emit('reconnectFailed', new Error('Max reconnect attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    this.metrics.reconnectCount++;
    
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.config.maxReconnectDelay
    );

    this.setState(ConnectionState.RECONNECTING);
    this.emit('reconnectAttempt', this.reconnectAttempts, this.config.reconnectAttempts);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        this.emit('error', error);
      });
    }, delay);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * Send heartbeat ping
   */
  private sendHeartbeat(): void {
    if (this.state === ConnectionState.CONNECTED && this.socket) {
      this.lastPingTime = Date.now();
      const pingMessage = {
        type: 'ping',
        timestamp: this.lastPingTime
      };
      
      try {
        this.socket.send(JSON.stringify(pingMessage));
      } catch (error) {
        this.emit('error', error as Error);
      }
    }
  }

  /**
   * Measure connection latency
   */
  private async measureLatency(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.state !== ConnectionState.CONNECTED) {
        reject(new Error('No active connection'));
        return;
      }

      const startTime = Date.now();
      const pingMessage = {
        type: 'ping',
        timestamp: startTime
      };

      const timeout = setTimeout(() => {
        reject(new Error('Latency measurement timeout'));
      }, 5000);

      const handlePong = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong' && data.timestamp === startTime) {
            clearTimeout(timeout);
            this.socket!.removeEventListener('message', handlePong);
            resolve(Date.now() - startTime);
          }
        } catch {
          // Ignore parsing errors for non-pong messages
        }
      };

      this.socket.addEventListener('message', handlePong);
      this.socket.send(JSON.stringify(pingMessage));
    });
  }

  /**
   * Update latency metrics
   */
  private updateLatencyMetrics(latency: number): void {
    this.metrics.latency = latency;
    
    // Update health status based on latency
    if (this.state === ConnectionState.CONNECTED || this.state === ConnectionState.DEGRADED) {
      if (latency > this.config.criticalThreshold) {
        this.setHealthStatus(HealthStatus.CRITICAL);
      } else if (latency > this.config.degradedThreshold) {
        this.setHealthStatus(HealthStatus.WARNING);
        this.setState(ConnectionState.DEGRADED);
      } else {
        this.setHealthStatus(HealthStatus.HEALTHY);
        if (this.state === ConnectionState.DEGRADED) {
          this.setState(ConnectionState.CONNECTED);
        }
      }
    }
  }

  /**
   * Calculate health status based on metrics
   */
  private calculateHealthStatus(latency: number): HealthStatus {
    if (latency > this.config.criticalThreshold) {
      return HealthStatus.CRITICAL;
    } else if (latency > this.config.degradedThreshold) {
      return HealthStatus.WARNING;
    } else {
      return HealthStatus.HEALTHY;
    }
  }

  /**
   * Update uptime metric
   */
  private updateUptimeMetric(): void {
    if (this.connectionStartTime > 0 && this.state === ConnectionState.CONNECTED) {
      this.metrics.uptime = Date.now() - this.connectionStartTime;
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.state === ConnectionState.CONNECTED) {
      const message = this.messageQueue.shift();
      this.send(message).catch(error => {
        this.emit('error', error);
      });
    }
  }

  /**
   * Set connection state
   */
  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      const previousState = this.state;
      this.state = newState;
      this.emit('stateChanged', newState, previousState);
    }
  }

  /**
   * Set health status
   */
  private setHealthStatus(newStatus: HealthStatus): void {
    if (this.healthStatus !== newStatus) {
      this.healthStatus = newStatus;
      this.emit('healthChanged', newStatus, this.getMetrics());
    }
  }

  /**
   * Stop all timers
   */
  private stopAllTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disconnect();
    this.removeAllListeners();
    this.messageQueue = [];
  }
}

/**
 * Create connection manager instance
 */
export function createConnectionManager(config: ConnectionConfig): ConnectionManager {
  return new ConnectionManager(config);
}

/**
 * Default connection configuration
 */
export const defaultConnectionConfig: ConnectionConfig = {
  url: 'ws://localhost:3001',
  reconnectAttempts: 10,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  healthCheckInterval: 30000,
  timeoutDuration: 10000,
  heartbeatInterval: 15000,
  degradedThreshold: 500, // 500ms
  criticalThreshold: 2000 // 2 seconds
};
