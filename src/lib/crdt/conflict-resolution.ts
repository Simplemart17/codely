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
 * Semantic analysis result
 */
export interface SemanticAnalysis {
  canAutoMerge: boolean;
  conflictType: string;
  semanticContext: any;
  mergeStrategy: string;
  confidence: number;
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
    try {
      // Analyze the semantic context of the conflict
      const semanticAnalysis = this.analyzeSemanticContext(conflict);

      if (semanticAnalysis.canAutoMerge) {
        return this.performSemanticMerge(conflict, semanticAnalysis);
      }

      // If semantic merge is not possible, use intelligent fallback
      return this.intelligentFallbackResolution(conflict, semanticAnalysis);
    } catch (error) {
      console.warn('Semantic merge failed, falling back to content merge:', error);
      return this.resolveMergeContent(conflict);
    }
  }

  /**
   * Analyze semantic context of conflict
   */
  private analyzeSemanticContext(conflict: Conflict): SemanticAnalysis {
    const operations = conflict.operations;
    const analysis: SemanticAnalysis = {
      canAutoMerge: false,
      conflictType: 'unknown',
      semanticContext: {},
      mergeStrategy: 'manual',
      confidence: 0
    };

    // Analyze operation types and patterns
    const insertOps = operations.filter(op => op.type === OperationType.INSERT);
    const deleteOps = operations.filter(op => op.type === OperationType.DELETE);

    if (insertOps.length > 0) {
      analysis.semanticContext = this.analyzeInsertOperations(insertOps);
      analysis.conflictType = 'insert_conflict';
    }

    if (deleteOps.length > 0) {
      const deleteAnalysis = this.analyzeDeleteOperations(deleteOps);
      analysis.semanticContext = { ...analysis.semanticContext, ...deleteAnalysis };
      analysis.conflictType = analysis.conflictType === 'insert_conflict' ? 'mixed_conflict' : 'delete_conflict';
    }

    // Determine if auto-merge is possible
    analysis.canAutoMerge = this.canPerformAutoMerge(analysis);
    analysis.confidence = this.calculateMergeConfidence(analysis);

    return analysis;
  }

  /**
   * Analyze insert operations for semantic patterns
   */
  private analyzeInsertOperations(operations: Operation[]): any {
    const context: any = {
      insertPatterns: [],
      codeStructures: [],
      semanticTokens: []
    };

    for (const op of operations) {
      const content = (op as any).content || '';

      // Detect code patterns
      if (this.isCodeBlock(content)) {
        context.codeStructures.push({
          type: 'code_block',
          content,
          position: op.position
        });
      } else if (this.isComment(content)) {
        context.insertPatterns.push({
          type: 'comment',
          content,
          position: op.position
        });
      } else if (this.isWhitespace(content)) {
        context.insertPatterns.push({
          type: 'whitespace',
          content,
          position: op.position
        });
      }

      // Extract semantic tokens
      const tokens = this.extractSemanticTokens(content);
      context.semanticTokens.push(...tokens);
    }

    return context;
  }

  /**
   * Analyze delete operations for semantic patterns
   */
  private analyzeDeleteOperations(operations: Operation[]): any {
    const context: any = {
      deletePatterns: [],
      affectedStructures: []
    };

    for (const op of operations) {
      const length = (op as any).length || 0;

      context.deletePatterns.push({
        position: op.position,
        length,
        type: this.classifyDeleteOperation(op)
      });
    }

    return context;
  }

  /**
   * Check if auto-merge is possible
   */
  private canPerformAutoMerge(analysis: SemanticAnalysis): boolean {
    // Simple heuristics for auto-merge capability
    if (analysis.conflictType === 'insert_conflict') {
      const insertPatterns = analysis.semanticContext.insertPatterns || [];

      // Can auto-merge if all inserts are comments or whitespace
      return insertPatterns.every((pattern: any) =>
        pattern.type === 'comment' || pattern.type === 'whitespace'
      );
    }

    return false;
  }

  /**
   * Calculate merge confidence score
   */
  private calculateMergeConfidence(analysis: SemanticAnalysis): number {
    let confidence = 0.5; // Base confidence

    if (analysis.canAutoMerge) {
      confidence += 0.3;
    }

    // Increase confidence for simple patterns
    const patterns = analysis.semanticContext.insertPatterns || [];
    const simplePatterns = patterns.filter((p: any) =>
      p.type === 'whitespace' || p.type === 'comment'
    );

    if (simplePatterns.length === patterns.length) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Perform semantic merge
   */
  private performSemanticMerge(conflict: Conflict, analysis: SemanticAnalysis): ConflictResolution {
    const mergedOperation = this.createMergedOperation(conflict, analysis);
    const discardedOperations = conflict.operations.filter(op => op !== mergedOperation);

    return {
      strategy: ResolutionStrategy.SEMANTIC_MERGE,
      resolvedOperation: mergedOperation,
      discardedOperations,
      mergedContent: this.extractMergedContent(mergedOperation),
      timestamp: Date.now()
    };
  }

  /**
   * Create merged operation from conflict analysis
   */
  private createMergedOperation(conflict: Conflict, analysis: SemanticAnalysis): Operation {
    const operations = conflict.operations;
    const baseOp = operations[0];

    if (analysis.conflictType === 'insert_conflict') {
      return this.mergeInsertOperations(operations, analysis);
    }

    // Fallback to first operation
    return baseOp;
  }

  /**
   * Merge insert operations intelligently
   */
  private mergeInsertOperations(operations: Operation[], analysis: SemanticAnalysis): Operation {
    const insertOps = operations.filter(op => op.type === OperationType.INSERT);
    const sortedOps = insertOps.sort((a, b) => a.timestamp - b.timestamp);

    // Merge content based on semantic analysis
    const mergedContent = this.mergeContentSemantically(sortedOps, analysis);

    return {
      ...sortedOps[0],
      content: mergedContent,
      timestamp: Date.now()
    } as any;
  }

  /**
   * Merge content semantically
   */
  private mergeContentSemantically(operations: Operation[], analysis: SemanticAnalysis): string {
    const contents = operations.map(op => (op as any).content || '');
    const patterns = analysis.semanticContext.insertPatterns || [];

    // Group by pattern type
    const comments = contents.filter((_, i) => patterns[i]?.type === 'comment');
    const whitespace = contents.filter((_, i) => patterns[i]?.type === 'whitespace');
    const code = contents.filter((_, i) => !patterns[i] || patterns[i].type === 'code');

    // Merge in logical order: code first, then comments, then whitespace
    return [...code, ...comments, ...whitespace].join('');
  }

  /**
   * Intelligent fallback resolution
   */
  private intelligentFallbackResolution(conflict: Conflict, analysis: SemanticAnalysis): ConflictResolution {
    // Use analysis to choose the best fallback strategy
    switch (analysis.conflictType) {
      case 'insert_conflict':
        return this.resolveInsertConflictIntelligently(conflict, analysis);
      case 'delete_conflict':
        return this.resolveDeleteConflictIntelligently(conflict, analysis);
      case 'mixed_conflict':
        return this.resolveMixedConflictIntelligently(conflict, analysis);
      default:
        return this.resolveLastWriterWins(conflict);
    }
  }

  /**
   * Resolve insert conflict intelligently
   */
  private resolveInsertConflictIntelligently(conflict: Conflict, analysis: SemanticAnalysis): ConflictResolution {
    const patterns = analysis.semanticContext.insertPatterns || [];

    // If all inserts are whitespace, merge them
    if (patterns.every((p: any) => p.type === 'whitespace')) {
      return this.resolveMergeContent(conflict);
    }

    // If mixed content, use user priority
    return this.resolveByUserPriority(conflict);
  }

  /**
   * Resolve delete conflict intelligently
   */
  private resolveDeleteConflictIntelligently(conflict: Conflict, analysis: SemanticAnalysis): ConflictResolution {
    // For delete conflicts, prefer the larger deletion (more comprehensive change)
    const deleteOps = conflict.operations.filter(op => op.type === OperationType.DELETE);
    const largestDelete = deleteOps.reduce((largest, current) =>
      ((current as any).length || 0) > ((largest as any).length || 0) ? current : largest
    );

    const discardedOps = conflict.operations.filter(op => op !== largestDelete);

    return {
      strategy: ResolutionStrategy.SEMANTIC_MERGE,
      resolvedOperation: largestDelete,
      discardedOperations: discardedOps,
      timestamp: Date.now()
    };
  }

  /**
   * Resolve mixed conflict intelligently
   */
  private resolveMixedConflictIntelligently(conflict: Conflict, analysis: SemanticAnalysis): ConflictResolution {
    // For mixed conflicts, prioritize based on operation impact
    const operations = conflict.operations;
    const prioritizedOp = operations.reduce((highest, current) => {
      const currentPriority = this.calculateOperationPriority(current, analysis);
      const highestPriority = this.calculateOperationPriority(highest, analysis);
      return currentPriority > highestPriority ? current : highest;
    });

    const discardedOps = operations.filter(op => op !== prioritizedOp);

    return {
      strategy: ResolutionStrategy.SEMANTIC_MERGE,
      resolvedOperation: prioritizedOp,
      discardedOperations: discardedOps,
      timestamp: Date.now()
    };
  }

  /**
   * Calculate operation priority for conflict resolution
   */
  private calculateOperationPriority(operation: Operation, analysis: SemanticAnalysis): number {
    let priority = 1;

    // Higher priority for inserts over deletes
    if (operation.type === OperationType.INSERT) {
      priority += 2;
    }

    // Higher priority for code content
    const content = (operation as any).content || '';
    if (this.isCodeBlock(content)) {
      priority += 3;
    } else if (this.isComment(content)) {
      priority += 1;
    }

    return priority;
  }

  /**
   * Extract merged content from operation
   */
  private extractMergedContent(operation: Operation): string {
    return (operation as any).content || '';
  }

  /**
   * Check if content is a code block
   */
  private isCodeBlock(content: string): boolean {
    // Simple heuristics for code detection
    const codePatterns = [
      /function\s+\w+/,
      /class\s+\w+/,
      /if\s*\(/,
      /for\s*\(/,
      /while\s*\(/,
      /\{[\s\S]*\}/,
      /=>\s*\{/
    ];

    return codePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check if content is a comment
   */
  private isComment(content: string): boolean {
    const trimmed = content.trim();
    return trimmed.startsWith('//') ||
           trimmed.startsWith('/*') ||
           trimmed.startsWith('*') ||
           trimmed.startsWith('#');
  }

  /**
   * Check if content is whitespace
   */
  private isWhitespace(content: string): boolean {
    return /^\s*$/.test(content);
  }

  /**
   * Extract semantic tokens from content
   */
  private extractSemanticTokens(content: string): any[] {
    const tokens: any[] = [];

    // Simple tokenization
    const words = content.split(/\s+/).filter(word => word.length > 0);

    for (const word of words) {
      if (this.isKeyword(word)) {
        tokens.push({ type: 'keyword', value: word });
      } else if (this.isIdentifier(word)) {
        tokens.push({ type: 'identifier', value: word });
      } else if (this.isOperator(word)) {
        tokens.push({ type: 'operator', value: word });
      }
    }

    return tokens;
  }

  /**
   * Check if word is a programming keyword
   */
  private isKeyword(word: string): boolean {
    const keywords = [
      'function', 'class', 'if', 'else', 'for', 'while', 'return',
      'const', 'let', 'var', 'import', 'export', 'default'
    ];
    return keywords.includes(word);
  }

  /**
   * Check if word is an identifier
   */
  private isIdentifier(word: string): boolean {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(word);
  }

  /**
   * Check if word is an operator
   */
  private isOperator(word: string): boolean {
    const operators = ['+', '-', '*', '/', '=', '==', '===', '!=', '!==', '<', '>', '<=', '>='];
    return operators.includes(word);
  }

  /**
   * Classify delete operation type
   */
  private classifyDeleteOperation(operation: Operation): string {
    const length = (operation as any).length || 0;

    if (length === 1) {
      return 'character_delete';
    } else if (length < 10) {
      return 'word_delete';
    } else if (length < 100) {
      return 'line_delete';
    } else {
      return 'block_delete';
    }
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
