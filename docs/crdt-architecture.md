# CRDT Architecture Documentation

## Overview

The Codely platform implements a comprehensive Conflict-free Replicated Data Type (CRDT) system for real-time collaborative code editing. This system enables multiple users to simultaneously edit code while maintaining consistency and resolving conflicts automatically.

## Architecture Components

### 1. Core CRDT System

#### CRDTDocument (`src/lib/crdt/document.ts`)
The central document class that manages collaborative editing state.

**Key Features:**
- Yjs integration for conflict-free operations
- WebSocket provider for real-time synchronization
- Monaco editor binding for seamless integration
- Event-driven architecture for state changes

**Usage:**
```typescript
import { createCRDTDocument } from '@/lib/crdt/document';

const document = createCRDTDocument(sessionId, user);
document.connect(websocketUrl);
document.bindMonacoEditor(editor);
```

#### CRDTManager (`src/lib/crdt/manager.ts`)
Manages multiple CRDT documents and provides session management.

**Key Features:**
- Multi-session support
- User management
- Document lifecycle management
- Event forwarding and aggregation

### 2. Operation System

#### Operations (`src/lib/crdt/operations.ts`)
Defines operation types and transformation logic.

**Operation Types:**
- `INSERT`: Add text at a position
- `DELETE`: Remove text from a position
- `RETAIN`: Keep text (for formatting)
- `FORMAT`: Apply formatting to text

**Transformation Logic:**
```typescript
const result = transformer.transform(operation1, operation2);
if (result.transformed) {
  // Apply transformed operation
  applyOperation(result.operation);
}
```

#### OperationTransformer (`src/lib/crdt/operations.ts`)
Handles operational transformation for concurrent edits.

**Features:**
- Conflict detection and resolution
- Position adjustment for concurrent operations
- Timestamp-based ordering
- User ID tie-breaking

### 3. Multi-Cursor Support

#### CursorTracker (`src/lib/crdt/cursor-tracking.ts`)
Manages real-time cursor positions for multiple users.

**Features:**
- Real-time cursor position sharing
- Visual cursor rendering in Monaco editor
- Typing indicators
- User identification with colors

#### CursorAnimator (`src/lib/crdt/cursor-animations.ts`)
Provides smooth animations for cursor movements.

**Animation Types:**
- Fade in/out
- Smooth position transitions
- Typing indicators
- Bounce effects

### 4. User Management

#### UserManager (`src/lib/crdt/user-identification.ts`)
Handles user identification, roles, and permissions.

**User Roles:**
- `INSTRUCTOR`: Full permissions
- `STUDENT`: Limited permissions
- `OBSERVER`: Read-only access
- `ADMIN`: Administrative access

**Features:**
- Color assignment
- Permission management
- Status tracking
- Avatar generation

### 5. Selection and Highlighting

#### SelectionSynchronizer (`src/lib/crdt/selection-sync.ts`)
Synchronizes text selections and highlights across users.

**Selection Types:**
- Text selections
- Line selections
- Block selections
- Word selections

**Highlight Types:**
- User selections
- Annotations
- Errors and warnings
- Comments

### 6. State Management

#### StateSynchronizer (`src/lib/crdt/state-sync.ts`)
Manages document state synchronization.

**Features:**
- Delta synchronization
- State vector management
- Conflict detection
- Automatic recovery

#### OfflineHandler (`src/lib/crdt/offline-handler.ts`)
Handles offline/online state transitions.

**Features:**
- Offline operation queuing
- Automatic synchronization on reconnect
- Data persistence
- Conflict resolution for offline changes

### 7. WebSocket Integration

#### WebSocketCRDTIntegration (`src/lib/crdt/websocket-integration.ts`)
Integrates CRDT operations with WebSocket communication.

**Message Types:**
- Operation broadcasts
- Cursor updates
- User awareness
- State synchronization

#### OperationBroadcaster (`src/lib/crdt/operation-broadcaster.ts`)
Efficiently broadcasts operations to multiple users.

**Features:**
- Priority-based queuing
- Batch processing
- Target filtering
- Retry mechanisms

### 8. Error Handling

#### NetworkErrorHandler (`src/lib/crdt/network-error-handler.ts`)
Robust error handling for network issues.

**Error Types:**
- Connection failures
- Timeout errors
- Authentication failures
- Rate limiting

**Recovery Strategies:**
- Automatic retry
- Reconnection
- Fallback mechanisms
- Circuit breaker pattern

## Data Flow

### 1. User Input Flow
```
User Types → Monaco Editor → CRDT Document → Operation → WebSocket → Other Users
```

### 2. Remote Update Flow
```
WebSocket → Operation → CRDT Document → Monaco Editor → Visual Update
```

### 3. Conflict Resolution Flow
```
Concurrent Operations → Transformer → Conflict Detection → Resolution Strategy → Merged State
```

## Configuration

### Environment Variables
```env
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3001
CRDT_MAX_OPERATIONS=1000
CRDT_SYNC_INTERVAL=100
CRDT_HEARTBEAT_INTERVAL=30000
```

### CRDT Configuration
```typescript
const config = {
  maxRetries: 3,
  retryDelay: 1000,
  enableOfflineMode: true,
  conflictResolutionStrategy: 'last-write-wins'
};
```

## Performance Considerations

### 1. Operation Batching
Operations are batched to reduce network overhead:
- Batch size: 50 operations
- Batch timeout: 100ms
- Priority-based processing

### 2. Memory Management
- Operation history limited to 1000 entries
- Automatic cleanup of old conflicts
- Efficient state vector encoding

### 3. Network Optimization
- Delta synchronization
- Compression for large payloads
- Connection pooling
- Heartbeat monitoring

## Security Considerations

### 1. User Authentication
- JWT-based authentication
- Session validation
- Permission checking

### 2. Data Validation
- Operation validation
- Content sanitization
- Rate limiting

### 3. Access Control
- Role-based permissions
- Session-based access
- User capacity limits

## Testing Strategy

### 1. Unit Tests
- Individual component testing
- Operation transformation logic
- Conflict resolution algorithms

### 2. Integration Tests
- Multi-user scenarios
- Network failure simulation
- Performance benchmarks

### 3. Performance Tests
- Large document handling
- High-volume operations
- Memory usage monitoring

## Deployment

### 1. WebSocket Server
```bash
# Start WebSocket server
npm run start:websocket

# With clustering
npm run start:websocket:cluster
```

### 2. Client Integration
```typescript
// Initialize CRDT system
const crdtManager = initializeCRDTManager({
  websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL,
  user: currentUser
});

// Join session
const document = await crdtManager.joinSession({
  sessionId,
  user,
  language: 'javascript'
});
```

## Monitoring and Debugging

### 1. Metrics
- Operation throughput
- Conflict resolution rate
- Network latency
- Memory usage

### 2. Logging
- Operation history
- Conflict events
- Network errors
- Performance metrics

### 3. Debug Tools
- State inspection
- Operation replay
- Conflict visualization
- Performance profiling

## Future Enhancements

### 1. Advanced Features
- Semantic conflict resolution
- Code-aware merging
- Intelligent suggestions
- Version history

### 2. Performance Improvements
- WebAssembly integration
- Advanced compression
- Predictive synchronization
- Edge caching

### 3. Scalability
- Horizontal scaling
- Load balancing
- Geographic distribution
- CDN integration

## Troubleshooting

### Common Issues

#### 1. Connection Problems
```typescript
// Check connection status
if (!document.isSynced()) {
  // Trigger manual sync
  await document.forceSync();
}
```

#### 2. Conflict Resolution
```typescript
// Monitor conflicts
document.on('conflict', (conflict) => {
  console.log('Conflict detected:', conflict);
  // Manual resolution if needed
});
```

#### 3. Performance Issues
```typescript
// Monitor performance
const stats = crdtManager.getStats();
if (stats.averageLatency > 1000) {
  // Investigate network issues
}
```

## API Reference

See individual component documentation for detailed API references:
- [CRDTDocument API](./api/crdt-document.md)
- [CRDTManager API](./api/crdt-manager.md)
- [Operations API](./api/operations.md)
- [WebSocket Integration API](./api/websocket-integration.md)
