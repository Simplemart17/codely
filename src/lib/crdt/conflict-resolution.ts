/**
 * Conflict Resolution Mechanisms for CRDT
 * 
 * This module implements advanced conflict resolution strategies
 * for collaborative editing scenarios.
 */

import { Operation, OperationType, OperationBatch } from './operations';

/**
 * Conflict types
 */
export enum ConflictType {
  CONCURRENT_EDIT = 'concurrent_edit',
  OVERLAPPING_DELETE = 'overlapping_delete',
  FORMAT_CONFLICT = 'format_conflict',
  POSITION_CONFLICT = 'position_conflict',
  SEMANTIC_CONFLICT = 'semantic_conflict'
}

/**
 * Conflict severity levels
 */
export enum ConflictSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Conflict information
 */
export interface Conflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  position: number;
  length: number;
  operations: Operation[];
  users: string[];
  timestamp: number;
  resolved: boolean;
  resolution?: ConflictResolution;
}

/**
 * Conflict resolution strategy
 */
export enum ResolutionStrategy {
  LAST_WRITER_WINS = 'last_writer_wins',
  FIRST_WRITER_WINS = 'first_writer_wins',
  USER_PRIORITY = 'user_priority',
  MERGE_CONTENT = 'merge_content',
  MANUAL_RESOLUTION = 'manual_resolution',
  SEMANTIC_MERGE = 'semantic_merge'
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  strategy: ResolutionStrategy;
  resolvedOperation: Operation;
  discardedOperations: Operation[];
  mergedContent?: string;
  userChoice?: string;
  timestamp: number;
}

/**
 * User priority configuration
 */
export interface UserPriority {
  userId: string;
  priority: number; // Higher number = higher priority
  role: 'instructor' | 'student' | 'observer';
}

/**
 * Conflict resolution configuration
 */
export interface ConflictResolutionConfig {
  defaultStrategy: ResolutionStrategy;
  userPriorities: UserPriority[];
  enableSemanticAnalysis: boolean;
  autoResolveThreshold: ConflictSeverity;
  maxConflictAge: number; // milliseconds
}

/**
 * Conflict Resolver class for handling edit conflicts
 */
export class ConflictResolver {
  private conflicts: Map<string, Conflict> = new Map();
  private config: ConflictResolutionConfig;
  private resolutionHistory: ConflictResolution[] = [];

  constructor(config: ConflictResolutionConfig) {
    this.config = config;
  }

  /**
   * Detect conflicts between operations
   */
  detectConflicts(operations: Operation[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    // Group operations by position ranges
    const positionGroups = this.groupOperationsByPosition(operations);
    
    for (const [positionRange, ops] of positionGroups) {
      if (ops.length > 1) {
        const conflict = this.analyzeConflict(ops, positionRange);
        if (conflict) {
          conflicts.push(conflict);
          this.conflicts.set(conflict.id, conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve a conflict using the specified strategy
   */
  resolveConflict(conflictId: string, strategy?: ResolutionStrategy): ConflictResolution | null {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict || conflict.resolved) {
      return null;
    }

    const resolutionStrategy = strategy || this.config.defaultStrategy;
    let resolution: ConflictResolution;

    switch (resolutionStrategy) {
      case ResolutionStrategy.LAST_WRITER_WINS:
        resolution = this.resolveLastWriterWins(conflict);
        break;
      
      case ResolutionStrategy.FIRST_WRITER_WINS:
        resolution = this.resolveFirstWriterWins(conflict);
        break;
      
      case ResolutionStrategy.USER_PRIORITY:
        resolution = this.resolveByUserPriority(conflict);
        break;
      
      case ResolutionStrategy.MERGE_CONTENT:
        resolution = this.resolveMergeContent(conflict);
        break;
      
      case ResolutionStrategy.SEMANTIC_MERGE:
        resolution = this.resolveSemanticMerge(conflict);
        break;
      
      default:
        resolution = this.resolveLastWriterWins(conflict);
    }

    // Mark conflict as resolved
    conflict.resolved = true;
    conflict.resolution = resolution;
    
    // Add to resolution history
    this.resolutionHistory.push(resolution);

    return resolution;
  }

  /**
   * Auto-resolve conflicts based on configuration
   */
  autoResolveConflicts(): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];
    
    for (const [conflictId, conflict] of this.conflicts) {
      if (!conflict.resolved && conflict.severity <= this.config.autoResolveThreshold) {
        const resolution = this.resolveConflict(conflictId);
        if (resolution) {
          resolutions.push(resolution);
        }
      }
    }

    return resolutions;
  }

  /**
   * Get all unresolved conflicts
   */
  getUnresolvedConflicts(): Conflict[] {
    return Array.from(this.conflicts.values()).filter(c => !c.resolved);
  }

  /**
   * Get conflict by ID
   */
  getConflict(conflictId: string): Conflict | null {
    return this.conflicts.get(conflictId) || null;
  }

  /**
   * Clear old resolved conflicts
   */
  cleanupOldConflicts(): void {
    const now = Date.now();
    const maxAge = this.config.maxConflictAge;
    
    for (const [conflictId, conflict] of this.conflicts) {
      if (conflict.resolved && (now - conflict.timestamp) > maxAge) {
        this.conflicts.delete(conflictId);
      }
    }
  }

  /**
   * Group operations by position ranges
   */
  private groupOperationsByPosition(operations: Operation[]): Map<string, Operation[]> {
    const groups = new Map<string, Operation[]>();
    
    for (const op of operations) {
      const range = this.getOperationRange(op);
      const key = `${range.start}-${range.end}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(op);
    }

    return groups;
  }

  /**
   * Get operation position range
   */
  private getOperationRange(operation: Operation): { start: number; end: number } {
    switch (operation.type) {
      case OperationType.INSERT:
        return {
          start: operation.position,
          end: operation.position
        };
      
      case OperationType.DELETE:
        return {
          start: operation.position,
          end: operation.position + (operation as any).length
        };
      
      case OperationType.FORMAT:
        return {
          start: operation.position,
          end: operation.position + (operation as any).length
        };
      
      default:
        return {
          start: operation.position,
          end: operation.position
        };
    }
  }

  /**
   * Analyze conflict between operations
   */
  private analyzeConflict(operations: Operation[], positionRange: string): Conflict | null {
    if (operations.length < 2) return null;

    const conflictType = this.determineConflictType(operations);
    const severity = this.calculateConflictSeverity(operations, conflictType);
    const users = [...new Set(operations.map(op => op.userId))];
    
    const [start, end] = positionRange.split('-').map(Number);

    return {
      id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: conflictType,
      severity,
      position: start,
      length: end - start,
      operations,
      users,
      timestamp: Date.now(),
      resolved: false
    };
  }

  /**
   * Determine conflict type
   */
  private determineConflictType(operations: Operation[]): ConflictType {
    const types = operations.map(op => op.type);
    
    if (types.includes(OperationType.DELETE) && types.includes(OperationType.DELETE)) {
      return ConflictType.OVERLAPPING_DELETE;
    }
    
    if (types.includes(OperationType.FORMAT) && types.includes(OperationType.FORMAT)) {
      return ConflictType.FORMAT_CONFLICT;
    }
    
    if (types.includes(OperationType.INSERT) && types.includes(OperationType.INSERT)) {
      return ConflictType.POSITION_CONFLICT;
    }
    
    return ConflictType.CONCURRENT_EDIT;
  }

  /**
   * Calculate conflict severity
   */
  private calculateConflictSeverity(operations: Operation[], type: ConflictType): ConflictSeverity {
    const userCount = new Set(operations.map(op => op.userId)).size;
    const operationCount = operations.length;
    
    // Base severity on conflict type
    let baseSeverity = ConflictSeverity.LOW;
    
    switch (type) {
      case ConflictType.OVERLAPPING_DELETE:
        baseSeverity = ConflictSeverity.HIGH;
        break;
      case ConflictType.SEMANTIC_CONFLICT:
        baseSeverity = ConflictSeverity.CRITICAL;
        break;
      case ConflictType.FORMAT_CONFLICT:
        baseSeverity = ConflictSeverity.LOW;
        break;
      default:
        baseSeverity = ConflictSeverity.MEDIUM;
    }
    
    // Increase severity based on user count and operation count
    if (userCount > 2 || operationCount > 3) {
      if (baseSeverity === ConflictSeverity.LOW) baseSeverity = ConflictSeverity.MEDIUM;
      else if (baseSeverity === ConflictSeverity.MEDIUM) baseSeverity = ConflictSeverity.HIGH;
    }
    
    return baseSeverity;
  }

  /**
   * Resolve conflict using last writer wins strategy
   */
  private resolveLastWriterWins(conflict: Conflict): ConflictResolution {
    const sortedOps = conflict.operations.sort((a, b) => b.timestamp - a.timestamp);
    const winningOp = sortedOps[0];
    const discardedOps = sortedOps.slice(1);

    return {
      strategy: ResolutionStrategy.LAST_WRITER_WINS,
      resolvedOperation: winningOp,
      discardedOperations: discardedOps,
      timestamp: Date.now()
    };
  }

  /**
   * Resolve conflict using first writer wins strategy
   */
  private resolveFirstWriterWins(conflict: Conflict): ConflictResolution {
    const sortedOps = conflict.operations.sort((a, b) => a.timestamp - b.timestamp);
    const winningOp = sortedOps[0];
    const discardedOps = sortedOps.slice(1);

    return {
      strategy: ResolutionStrategy.FIRST_WRITER_WINS,
      resolvedOperation: winningOp,
      discardedOperations: discardedOps,
      timestamp: Date.now()
    };
  }

  /**
   * Resolve conflict using user priority
   */
  private resolveByUserPriority(conflict: Conflict): ConflictResolution {
    const userPriorities = new Map(
      this.config.userPriorities.map(up => [up.userId, up.priority])
    );

    const sortedOps = conflict.operations.sort((a, b) => {
      const priorityA = userPriorities.get(a.userId) || 0;
      const priorityB = userPriorities.get(b.userId) || 0;
      return priorityB - priorityA;
    });

    const winningOp = sortedOps[0];
    const discardedOps = sortedOps.slice(1);

    return {
      strategy: ResolutionStrategy.USER_PRIORITY,
      resolvedOperation: winningOp,
      discardedOperations: discardedOps,
      timestamp: Date.now()
    };
  }

  /**
   * Resolve conflict by merging content
   */
  private resolveMergeContent(conflict: Conflict): ConflictResolution {
    // Simple merge strategy - concatenate insert operations
    const insertOps = conflict.operations.filter(op => op.type === OperationType.INSERT);
    
    if (insertOps.length > 1) {
      const mergedContent = insertOps
        .map(op => (op as any).content)
        .join(' ');
      
      const mergedOp: Operation = {
        ...insertOps[0],
        content: mergedContent
      } as any;

      return {
        strategy: ResolutionStrategy.MERGE_CONTENT,
        resolvedOperation: mergedOp,
        discardedOperations: insertOps.slice(1),
        mergedContent,
        timestamp: Date.now()
      };
    }

    // Fallback to last writer wins
    return this.resolveLastWriterWins(conflict);
  }

  /**
   * Resolve conflict using semantic analysis
   */
  private resolveSemanticMerge(conflict: Conflict): ConflictResolution {
    // Placeholder for semantic analysis
    // In a real implementation, this would analyze code semantics
    // and attempt intelligent merging
    
    // For now, fallback to merge content
    return this.resolveMergeContent(conflict);
  }
}

/**
 * Default conflict resolution configuration
 */
export const defaultConflictResolutionConfig: ConflictResolutionConfig = {
  defaultStrategy: ResolutionStrategy.LAST_WRITER_WINS,
  userPriorities: [],
  enableSemanticAnalysis: false,
  autoResolveThreshold: ConflictSeverity.LOW,
  maxConflictAge: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * Create conflict resolver with custom configuration
 */
export function createConflictResolver(
  config?: Partial<ConflictResolutionConfig>
): ConflictResolver {
  const finalConfig = { ...defaultConflictResolutionConfig, ...config };
  return new ConflictResolver(finalConfig);
}
