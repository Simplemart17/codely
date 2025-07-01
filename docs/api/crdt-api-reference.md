# CRDT API Reference

## Core Classes

### CRDTDocument

The main document class for collaborative editing.

#### Constructor
```typescript
new CRDTDocument(sessionId: string, user: CollaborativeUser)
```

#### Methods

##### `connect(websocketUrl: string): void`
Connects the document to a WebSocket provider for real-time synchronization.

**Parameters:**
- `websocketUrl`: WebSocket server URL

**Example:**
```typescript
document.connect('ws://localhost:3001');
```

##### `disconnect(): void`
Disconnects from the WebSocket provider and cleans up resources.

##### `bindMonacoEditor(editor: editor.IStandaloneCodeEditor): void`
Binds the CRDT document to a Monaco editor instance.

**Parameters:**
- `editor`: Monaco editor instance

**Throws:**
- Error if no provider connection exists

##### `getContent(): string`
Returns the current document content.

**Returns:** Document content as string

##### `setContent(content: string): void`
Sets the document content (use sparingly, prefer collaborative editing).

**Parameters:**
- `content`: New document content

##### `getState(): DocumentState`
Returns the current document state including cursors and users.

**Returns:** `DocumentState` object

##### `updateCursor(position: CursorPosition): void`
Updates the current user's cursor position.

**Parameters:**
- `position`: Cursor position object

##### `getConnectedUsers(): CollaborativeUser[]`
Returns list of currently connected users.

**Returns:** Array of `CollaborativeUser` objects

##### `isSynced(): boolean`
Checks if the document is fully synchronized.

**Returns:** Boolean indicating sync status

##### `getConnectionStatus(): 'connected' | 'connecting' | 'disconnected'`
Returns the current connection status.

#### Events

##### `'connected'`
Emitted when successfully connected to WebSocket provider.

##### `'disconnected'`
Emitted when disconnected from WebSocket provider.

##### `'textChange'`
Emitted when document text changes.

**Event Data:**
```typescript
{
  changes: any;
  content: string;
}
```

##### `'awarenessChange'`
Emitted when user awareness data changes (cursors, selections).

**Event Data:**
```typescript
{
  added: any[];
  updated: any[];
  removed: number[];
}
```

### CRDTManager

Manages multiple CRDT documents and sessions.

#### Constructor
```typescript
new CRDTManager(websocketUrl: string)
```

#### Methods

##### `setCurrentUser(user: Partial<CollaborativeUser>): void`
Sets the current user for all sessions.

##### `joinSession(config: SessionConfig): Promise<CRDTDocument>`
Creates or joins a collaborative session.

**Parameters:**
- `config`: Session configuration object

**Returns:** Promise resolving to `CRDTDocument`

##### `leaveSession(sessionId: string): Promise<void>`
Leaves a collaborative session.

##### `getDocument(sessionId: string): CRDTDocument | null`
Gets the document for a specific session.

##### `getActiveSessions(): string[]`
Returns list of active session IDs.

##### `bindEditor(sessionId: string, editor: editor.IStandaloneCodeEditor): void`
Binds Monaco editor to a session.

##### `disconnectAll(): void`
Disconnects from all sessions.

### OperationTransformer

Handles operation transformation for concurrent edits.

#### Methods

##### `transform(op1: Operation, op2: Operation): TransformResult`
Transforms one operation against another.

**Parameters:**
- `op1`: First operation
- `op2`: Second operation

**Returns:** `TransformResult` object

##### `transformBatch(batch: OperationBatch, againstOperations: Operation[]): OperationBatch`
Transforms a batch of operations.

##### `addPendingOperation(userId: string, operation: Operation): void`
Adds operation to pending queue.

##### `getPendingOperations(userId: string): Operation[]`
Gets pending operations for a user.

##### `addToHistory(operation: Operation): void`
Adds operation to history.

##### `getHistory(): Operation[]`
Gets operation history.

### CursorTracker

Manages multi-user cursor tracking and visualization.

#### Constructor
```typescript
new CursorTracker(currentUser?: CollaborativeUser)
```

#### Methods

##### `bindEditor(editor: editor.IStandaloneCodeEditor): void`
Binds cursor tracker to Monaco editor.

##### `updateCursor(userId: string, position: CursorPosition, user?: CollaborativeUser): void`
Updates cursor position for a user.

##### `removeCursor(userId: string): void`
Removes cursor for a user.

##### `getCursors(): Map<string, CursorState>`
Gets all tracked cursors.

##### `setTypingState(userId: string, isTyping: boolean): void`
Sets typing state for a user.

#### Events

##### `'cursorMoved'`
Emitted when a cursor moves.

##### `'cursorAdded'`
Emitted when a new cursor is added.

##### `'cursorRemoved'`
Emitted when a cursor is removed.

### UserManager

Manages users, roles, and permissions.

#### Constructor
```typescript
new UserManager(config: UserIdentificationConfig)
```

#### Methods

##### `addUser(user: Partial<ExtendedUser> & { id: string; name: string }): ExtendedUser`
Adds or updates a user.

##### `removeUser(userId: string): boolean`
Removes a user.

##### `getUser(userId: string): ExtendedUser | null`
Gets user by ID.

##### `getAllUsers(): ExtendedUser[]`
Gets all users.

##### `getUsersByRole(role: UserRole): ExtendedUser[]`
Gets users by role.

##### `hasPermission(userId: string, permission: keyof UserPermissions): boolean`
Checks if user has permission.

##### `updateUserPermissions(userId: string, permissions: Partial<UserPermissions>): boolean`
Updates user permissions.

### ConflictResolver

Handles conflict detection and resolution.

#### Constructor
```typescript
new ConflictResolver(config: ConflictResolutionConfig)
```

#### Methods

##### `detectConflicts(operations: Operation[]): Conflict[]`
Detects conflicts between operations.

##### `resolveConflict(conflictId: string, strategy?: ResolutionStrategy): ConflictResolution | null`
Resolves a specific conflict.

##### `autoResolveConflicts(): ConflictResolution[]`
Auto-resolves conflicts based on configuration.

##### `getUnresolvedConflicts(): Conflict[]`
Gets all unresolved conflicts.

## Interfaces

### CollaborativeUser
```typescript
interface CollaborativeUser {
  id: string;
  name: string;
  color: string;
  avatar?: string;
}
```

### CursorPosition
```typescript
interface CursorPosition {
  line: number;
  column: number;
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}
```

### DocumentState
```typescript
interface DocumentState {
  content: string;
  language: string;
  cursors: Map<string, CursorPosition>;
  users: Map<string, CollaborativeUser>;
  lastModified: number;
}
```

### Operation
```typescript
interface Operation {
  type: OperationType;
  position: number;
  timestamp: number;
  userId: string;
  sessionId: string;
}
```

### SessionConfig
```typescript
interface SessionConfig {
  sessionId: string;
  websocketUrl: string;
  user: CollaborativeUser;
  language?: string;
  initialContent?: string;
}
```

## Enums

### OperationType
```typescript
enum OperationType {
  INSERT = 'insert',
  DELETE = 'delete',
  RETAIN = 'retain',
  FORMAT = 'format'
}
```

### UserRole
```typescript
enum UserRole {
  INSTRUCTOR = 'instructor',
  STUDENT = 'student',
  OBSERVER = 'observer',
  ADMIN = 'admin'
}
```

### ResolutionStrategy
```typescript
enum ResolutionStrategy {
  LAST_WRITER_WINS = 'last_writer_wins',
  FIRST_WRITER_WINS = 'first_writer_wins',
  USER_PRIORITY = 'user_priority',
  MERGE_CONTENT = 'merge_content',
  MANUAL_RESOLUTION = 'manual_resolution',
  SEMANTIC_MERGE = 'semantic_merge'
}
```

## Utility Functions

### `createCRDTDocument(sessionId: string, user: CollaborativeUser): CRDTDocument`
Factory function to create a new CRDT document.

### `generateUserColor(userId: string): string`
Generates a consistent color for a user ID.

### `createSessionConfig(sessionId: string, user: Partial<CollaborativeUser>, options?: object): SessionConfig`
Creates a session configuration object.

### `initializeCRDTManager(config: object): CRDTManager`
Initializes and configures a CRDT manager.

## Error Handling

### Common Errors

#### `ConnectionError`
Thrown when WebSocket connection fails.

#### `AuthenticationError`
Thrown when user authentication fails.

#### `PermissionError`
Thrown when user lacks required permissions.

#### `ConflictError`
Thrown when conflicts cannot be resolved automatically.

### Error Event Handling
```typescript
document.on('error', (error) => {
  switch (error.type) {
    case 'connection':
      handleConnectionError(error);
      break;
    case 'conflict':
      handleConflictError(error);
      break;
    default:
      handleGenericError(error);
  }
});
```

## Configuration Options

### CRDT Configuration
```typescript
interface CRDTConfig {
  maxRetries: number;
  retryDelay: number;
  enableOfflineMode: boolean;
  conflictResolutionStrategy: ResolutionStrategy;
  maxOperationHistory: number;
  syncInterval: number;
}
```

### WebSocket Configuration
```typescript
interface WebSocketConfig {
  url: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
  messageTimeout: number;
}
```

For more detailed examples and usage patterns, see the [Usage Guide](../crdt-usage-guide.md).
