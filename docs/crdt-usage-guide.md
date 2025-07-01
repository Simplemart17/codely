# CRDT Usage Guide

## Getting Started

This guide provides practical examples and best practices for implementing collaborative editing using the Codely CRDT system.

## Basic Setup

### 1. Initialize CRDT Manager

```typescript
import { initializeCRDTManager } from '@/lib/crdt/manager';

const crdtManager = initializeCRDTManager({
  websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001',
  user: {
    id: 'user-123',
    name: 'John Doe',
    color: '#FF6B6B'
  }
});
```

### 2. Create a Collaborative Session

```typescript
import { createSessionConfig } from '@/lib/crdt/manager';

const sessionConfig = createSessionConfig(
  'session-abc123',
  {
    id: 'user-123',
    name: 'John Doe'
  },
  {
    language: 'javascript',
    initialContent: '// Welcome to collaborative coding!'
  }
);

const document = await crdtManager.joinSession(sessionConfig);
```

### 3. Bind to Monaco Editor

```typescript
import * as monaco from 'monaco-editor';

// Create Monaco editor
const editor = monaco.editor.create(document.getElementById('editor'), {
  value: '',
  language: 'javascript',
  theme: 'vs-dark'
});

// Bind CRDT document to editor
document.bindMonacoEditor(editor);
```

## Advanced Features

### Multi-Cursor Support

```typescript
import { createCursorTracker } from '@/lib/crdt/cursor-tracking';

const cursorTracker = createCursorTracker(currentUser);
cursorTracker.bindEditor(editor);

// Listen for cursor updates
cursorTracker.on('cursorMoved', (userId, position) => {
  console.log(`User ${userId} moved cursor to line ${position.line}`);
});

// Handle user joining
cursorTracker.on('cursorAdded', (userId, cursor) => {
  showUserJoinedNotification(cursor.user.name);
});
```

### Selection Synchronization

```typescript
import { createSelectionSynchronizer } from '@/lib/crdt/selection-sync';

const selectionSync = createSelectionSynchronizer(currentUser);
selectionSync.bindEditor(editor);

// Add custom highlight
const highlight = selectionSync.addHighlight({
  userId: currentUser.id,
  type: 'annotation',
  startLine: 10,
  startColumn: 1,
  endLine: 10,
  endColumn: 20,
  text: 'Important code',
  message: 'This function needs optimization',
  persistent: true
});

// Listen for selection changes
selectionSync.on('selectionAdded', (selection) => {
  updateSelectionUI(selection);
});
```

### User Management

```typescript
import { createUserManager, UserRole } from '@/lib/crdt/user-identification';

const userManager = createUserManager({
  maxUsersPerSession: 50,
  defaultRole: UserRole.STUDENT,
  defaultPermissions: {
    canEdit: true,
    canComment: true,
    canShare: false,
    canManageUsers: false,
    canExecuteCode: true,
    canChangeSettings: false
  }
});

// Add instructor with elevated permissions
const instructor = userManager.addUser({
  id: 'instructor-1',
  name: 'Dr. Smith',
  role: UserRole.INSTRUCTOR,
  permissions: {
    canEdit: true,
    canComment: true,
    canShare: true,
    canManageUsers: true,
    canExecuteCode: true,
    canChangeSettings: true
  }
});

// Check permissions before allowing actions
if (userManager.hasPermission(userId, 'canExecuteCode')) {
  executeCode();
}
```

### Conflict Resolution

```typescript
import { createConflictResolver } from '@/lib/crdt/conflict-resolution';

const conflictResolver = createConflictResolver({
  defaultStrategy: 'user_priority',
  userPriorities: [
    { userId: 'instructor-1', priority: 10, role: 'instructor' },
    { userId: 'ta-1', priority: 5, role: 'student' }
  ],
  enableSemanticAnalysis: true,
  autoResolveThreshold: 'medium'
});

// Handle conflicts
document.on('conflict', (conflict) => {
  const resolution = conflictResolver.resolveConflict(conflict.id);
  if (resolution) {
    applyResolution(resolution);
  } else {
    showManualResolutionDialog(conflict);
  }
});
```

### Offline Support

```typescript
import { createOfflineHandler, IndexedDBStorage } from '@/lib/crdt/offline-handler';

const storage = new IndexedDBStorage('codely-offline');
const offlineHandler = createOfflineHandler(document.ydoc, storage, {
  enableOfflineMode: true,
  maxOfflineOperations: 1000,
  syncRetryInterval: 5000
});

// Handle connection state changes
offlineHandler.on('connectionChanged', (state) => {
  updateConnectionIndicator(state);
  
  if (state === 'offline') {
    showOfflineNotification();
  } else if (state === 'online') {
    showOnlineNotification();
  }
});

// Handle sync events
offlineHandler.on('syncCompleted', (syncedOperations) => {
  showSyncSuccessMessage(`Synced ${syncedOperations} operations`);
});
```

## Real-World Examples

### 1. Classroom Coding Session

```typescript
class ClassroomSession {
  private crdtManager: CRDTManager;
  private userManager: UserManager;
  private currentDocument: CRDTDocument | null = null;

  constructor() {
    this.crdtManager = initializeCRDTManager({
      websocketUrl: 'wss://codely.example.com/ws'
    });

    this.userManager = createUserManager({
      maxUsersPerSession: 30,
      defaultRole: UserRole.STUDENT
    });
  }

  async startSession(sessionId: string, instructor: User) {
    // Add instructor
    this.userManager.addUser({
      ...instructor,
      role: UserRole.INSTRUCTOR
    });

    // Create session
    const sessionConfig = createSessionConfig(sessionId, instructor, {
      language: 'javascript',
      initialContent: this.getStarterCode()
    });

    this.currentDocument = await this.crdtManager.joinSession(sessionConfig);
    
    // Set up event handlers
    this.setupEventHandlers();
  }

  async addStudent(student: User) {
    if (this.userManager.isAtCapacity()) {
      throw new Error('Session is at capacity');
    }

    const studentUser = this.userManager.addUser({
      ...student,
      role: UserRole.STUDENT
    });

    // Join existing session
    if (this.currentDocument) {
      const sessionConfig = createSessionConfig(
        this.currentDocument.sessionId,
        studentUser
      );
      
      await this.crdtManager.joinSession(sessionConfig);
    }
  }

  private setupEventHandlers() {
    if (!this.currentDocument) return;

    // Handle text changes
    this.currentDocument.on('textChange', (data) => {
      this.broadcastChange(data);
    });

    // Handle user awareness
    this.currentDocument.on('awarenessChange', (data) => {
      this.updateUserList(data);
    });
  }

  private getStarterCode(): string {
    return `// Welcome to the coding session!
// Today we'll be learning about functions

function greet(name) {
  // TODO: Implement greeting function
}

// Test your function
console.log(greet("World"));`;
  }
}
```

### 2. Code Review Session

```typescript
class CodeReviewSession {
  private document: CRDTDocument;
  private selectionSync: SelectionSynchronizer;
  private annotations: Map<string, Annotation> = new Map();

  constructor(document: CRDTDocument) {
    this.document = document;
    this.selectionSync = createSelectionSynchronizer(getCurrentUser());
    this.setupReviewFeatures();
  }

  addComment(line: number, column: number, message: string) {
    const annotation = this.selectionSync.addAnnotation({
      userId: getCurrentUser().id,
      line,
      column,
      message,
      type: 'comment',
      resolved: false
    });

    this.annotations.set(annotation.id, annotation);
    return annotation;
  }

  highlightIssue(startLine: number, endLine: number, type: 'error' | 'warning') {
    return this.selectionSync.addHighlight({
      userId: getCurrentUser().id,
      type: type === 'error' ? 'error' : 'warning',
      startLine,
      startColumn: 1,
      endLine,
      endColumn: 1,
      text: this.document.getContent().split('\n').slice(startLine - 1, endLine).join('\n'),
      persistent: true
    });
  }

  resolveComment(annotationId: string) {
    const annotation = this.annotations.get(annotationId);
    if (annotation) {
      this.selectionSync.updateAnnotation(annotationId, { resolved: true });
    }
  }

  private setupReviewFeatures() {
    // Handle annotation clicks
    this.selectionSync.on('annotationAdded', (annotation) => {
      this.showAnnotationDialog(annotation);
    });

    // Handle highlight interactions
    this.selectionSync.on('highlightAdded', (highlight) => {
      this.updateIssuesList(highlight);
    });
  }
}
```

### 3. Pair Programming Session

```typescript
class PairProgrammingSession {
  private document: CRDTDocument;
  private cursorTracker: CursorTracker;
  private voiceChat: VoiceChat;

  constructor() {
    this.setupCollaborativeEnvironment();
  }

  async startSession(partner: User) {
    const sessionId = `pair-${Date.now()}`;
    
    // Create session
    const sessionConfig = createSessionConfig(sessionId, getCurrentUser(), {
      language: 'typescript',
      initialContent: '// Let\'s code together!'
    });

    this.document = await this.crdtManager.joinSession(sessionConfig);
    
    // Set up cursor tracking
    this.cursorTracker = createCursorTracker(getCurrentUser());
    this.cursorTracker.bindEditor(this.editor);

    // Enable voice chat
    this.voiceChat = new VoiceChat(sessionId);
    await this.voiceChat.connect();

    // Invite partner
    await this.invitePartner(partner, sessionId);
  }

  switchDriver(newDriverId: string) {
    // Implement driver switching logic
    this.document.updateCursor({
      line: 1,
      column: 1
    });

    this.showDriverIndicator(newDriverId);
  }

  private setupCollaborativeEnvironment() {
    // Set up real-time features
    this.cursorTracker.on('cursorMoved', (userId, position) => {
      this.updatePartnerCursor(userId, position);
    });

    this.cursorTracker.on('typingStarted', (userId) => {
      this.showTypingIndicator(userId);
    });

    this.cursorTracker.on('typingStopped', (userId) => {
      this.hideTypingIndicator(userId);
    });
  }
}
```

## Best Practices

### 1. Performance Optimization

```typescript
// Use operation batching for multiple changes
const batch = [];
for (const change of changes) {
  batch.push(createOperation(change));
}
await document.applyBatch(batch);

// Implement efficient cursor updates
const throttledCursorUpdate = throttle((position) => {
  document.updateCursor(position);
}, 100);
```

### 2. Error Handling

```typescript
// Always handle connection errors
document.on('error', (error) => {
  console.error('CRDT Error:', error);
  showErrorNotification('Connection issue. Retrying...');
});

// Implement graceful degradation
if (!document.isSynced()) {
  showOfflineMode();
  enableLocalEditing();
}
```

### 3. Memory Management

```typescript
// Clean up resources when done
window.addEventListener('beforeunload', () => {
  document.destroy();
  crdtManager.disconnectAll();
});

// Limit operation history
const operationQueue = createOperationQueue({
  maxQueueSize: 1000,
  enableCompression: true
});
```

### 4. Security Considerations

```typescript
// Validate user permissions
if (!userManager.hasPermission(userId, 'canEdit')) {
  throw new Error('User not authorized to edit');
}

// Sanitize content
const sanitizedContent = sanitizeCode(content);
document.setContent(sanitizedContent);

// Rate limiting
const rateLimiter = new RateLimiter({
  maxOperationsPerSecond: 10
});

if (!rateLimiter.allowOperation(userId)) {
  throw new Error('Rate limit exceeded');
}
```

## Troubleshooting

### Common Issues and Solutions

1. **Slow Performance**
   - Enable operation batching
   - Reduce cursor update frequency
   - Use delta synchronization

2. **Connection Issues**
   - Implement retry logic
   - Use offline mode
   - Check WebSocket configuration

3. **Conflicts Not Resolving**
   - Verify conflict resolution strategy
   - Check user priorities
   - Enable semantic analysis

4. **Memory Leaks**
   - Properly destroy documents
   - Clear event listeners
   - Limit operation history

For more detailed troubleshooting, see the [Architecture Documentation](./crdt-architecture.md).
