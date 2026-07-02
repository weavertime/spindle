# Collaboration System

The collaboration system enables real-time multi-user editing of spreadsheets with presence indicators and conflict resolution.

## Architecture Overview

### Collaboration Provider Interface

The collaboration system is designed with a provider pattern:

```typescript
// packages/sheets-core/src/collaboration/types.ts
export interface CollaborationProvider {
  connect(workbookId: string): Promise<void>;
  disconnect(): void;
  on(event: 'change' | 'presence' | 'cursor', handler: (data: unknown) => void): () => void;
  emit(event: 'change' | 'presence' | 'cursor', data: unknown): void;
  getPresences(): Presence[];
}
```

### Provider Integration

Collaboration providers are attached to workbooks:

```typescript
// In workbook.ts
private collaborationProvider?: CollaborationProvider;

setCollaborationProvider(provider: CollaborationProvider): void {
  this.collaborationProvider = provider;
  // Set up event forwarding
  this.setupCollaboration();
}

private setupCollaboration(): void {
  if (!this.collaborationProvider) return;

  // Forward local changes to remote
  this.on('cellChange', (event) => {
    this.collaborationProvider!.emit('change', {
      type: 'cellChange',
      sheetId: event.sheetId,
      row: event.row,
      col: event.col,
      value: event.value,
      timestamp: Date.now(),
      userId: this.currentUserId,
    });
  });

  // Listen for remote changes
  this.collaborationProvider.on('change', (operation: CollaborationOperation) => {
    if (operation.userId !== this.currentUserId) {
      this.applyRemoteOperation(operation);
    }
  });
}
```

## Firebase Provider Implementation

### Firebase Collaboration Provider

The Firebase provider implements real-time synchronization:

```typescript
// packages/sheets-core/src/collaboration/firebase-provider.ts
export class FirebaseCollaborationProvider implements CollaborationProvider {
  private db: any; // Firebase Realtime Database or Firestore
  private workbookId: string | null = null;
  private handlers: Map<string, Set<(data: unknown) => void>> = new Map();
  private presences: Map<string, Presence> = new Map();

  constructor(firebaseConfig: any) {
    // Initialize Firebase
    // this.db = initializeFirebase(firebaseConfig);
  }

  async connect(workbookId: string): Promise<void> {
    this.workbookId = workbookId;

    // Set up Firebase listeners
    this.setupFirebaseListeners(workbookId);
    this.setupPresenceTracking(workbookId);
  }

  disconnect(): void {
    // Clean up Firebase listeners
    this.workbookId = null;
    this.handlers.clear();
    this.presences.clear();
  }
}
```

### Firebase Data Structure

Collaboration data is stored in Firebase with this structure:

```
/workbooks/{workbookId}/
  ├── operations/           # Change operations
  │   ├── {timestamp}-{userId}/
  │   │   ├── type: "cellChange"
  │   │   ├── sheetId: "sheet_1"
  │   │   ├── row: 0
  │   │   ├── col: 1
  │   │   ├── value: "new value"
  │   │   └── userId: "user123"
  ├── presence/             # User presence
  │   ├── {userId}/
  │   │   ├── username: "John Doe"
  │   │   ├── color: "#ff6b6b"
  │   │   ├── selection: {row: 0, col: 0}
  │   │   ├── cursor: {row: 0, col: 1}
  │   │   └── lastSeen: 1640995200000
  └── cursors/              # Real-time cursor positions
      ├── {userId}/
      │   ├── row: 0
      │   ├── col: 1
      │   └── timestamp: 1640995200000
```

### Real-time Listeners

Firebase listeners handle incoming changes:

```typescript
private setupFirebaseListeners(workbookId: string): void {
  // Listen for operations
  const operationsRef = this.db.ref(`workbooks/${workbookId}/operations`);

  operationsRef.on('child_added', (snapshot: any) => {
    const operation = snapshot.val();
    if (operation.userId !== this.currentUserId) {
      this.notifyHandlers('change', operation);
    }
  });

  // Listen for presence updates
  const presenceRef = this.db.ref(`workbooks/${workbookId}/presence`);

  presenceRef.on('child_added', (snapshot: any) => {
    const userId = snapshot.key;
    const presence = snapshot.val();
    this.presences.set(userId, presence);
    this.notifyHandlers('presence', { userId, presence });
  });

  presenceRef.on('child_changed', (snapshot: any) => {
    const userId = snapshot.key;
    const presence = snapshot.val();
    this.presences.set(userId, presence);
    this.notifyHandlers('presence', { userId, presence });
  });

  presenceRef.on('child_removed', (snapshot: any) => {
    const userId = snapshot.key;
    this.presences.delete(userId);
    this.notifyHandlers('presence', { userId, removed: true });
  });
}
```

## Presence System

### Presence Data Structure

Presence tracks user activity and selections:

```typescript
export interface Presence {
  userId: string;
  username: string;
  color: string;           // User's cursor/selection color
  selection?: {
    row: number;
    col: number;
  };
  cursor?: {
    row: number;
    col: number;
  };
  lastSeen?: number;
}
```

### Presence Tracking

Presence is updated on user actions:

```typescript
private updatePresence(presence: Partial<Presence>): void {
  if (!this.workbookId || !this.currentUserId) return;

  const presenceRef = this.db.ref(`workbooks/${this.workbookId}/presence/${this.currentUserId}`);

  presenceRef.update({
    ...presence,
    lastSeen: Date.now(),
  }).catch((error: any) => {
    console.error('Failed to update presence:', error);
  });
}

// Update presence on selection change
workbook.on('cellSelection', (event) => {
  this.updatePresence({
    selection: event.selection,
  });
});

// Update cursor position (throttled)
private updateCursorThrottled = throttle((row: number, col: number) => {
  this.updatePresence({
    cursor: { row, col },
  });
}, 50); // Update at most every 50ms
```

## Operation-Based Synchronization

### Collaboration Operations

All changes are represented as operations:

```typescript
export interface CollaborationOperation {
  type: 'cellChange' | 'selectionChange' | 'sheetChange';
  sheetId: string;
  row?: number;
  col?: number;
  value?: unknown;
  selection?: {
    row: number;
    col: number;
  };
  timestamp: number;
  userId: string;
}
```

### Conflict Resolution

Operations are applied in timestamp order:

```typescript
private applyRemoteOperation(operation: CollaborationOperation): void {
  switch (operation.type) {
    case 'cellChange':
      // Apply cell change if newer than local version
      if (this.isNewerThanLocal(operation)) {
        this.workbook.setCellValue(
          operation.sheetId,
          operation.row!,
          operation.col!,
          operation.value
        );
      }
      break;

    case 'selectionChange':
      // Update remote user's selection
      this.updateRemoteSelection(operation.userId, operation.selection!);
      break;

    case 'sheetChange':
      // Handle sheet operations (add/delete/rename)
      this.applySheetOperation(operation);
      break;
  }
}

private isNewerThanLocal(operation: CollaborationOperation): boolean {
  // Compare timestamps and user priorities
  // Last write wins, with user priority for tie-breaking
  const localTimestamp = this.getLocalTimestamp(operation.sheetId, operation.row, operation.col);
  if (operation.timestamp > localTimestamp) {
    return true;
  }
  if (operation.timestamp === localTimestamp) {
    return operation.userId > this.currentUserId; // Simple priority system
  }
  return false;
}
```

## Real-time Cursor Tracking

### Cursor Synchronization

Cursor positions are tracked in real-time:

```typescript
private setupCursorTracking(workbookId: string): void {
  const cursorsRef = this.db.ref(`workbooks/${workbookId}/cursors/${this.currentUserId}`);

  // Update cursor on mouse movement (throttled)
  const handleMouseMove = throttle((event: MouseEvent) => {
    const { row, col } = this.hitTest(event.clientX, event.clientY);
    cursorsRef.set({
      row,
      col,
      timestamp: Date.now(),
    });
  }, 50);

  document.addEventListener('mousemove', handleMouseMove);

  // Listen for other users' cursors
  const allCursorsRef = this.db.ref(`workbooks/${workbookId}/cursors`);
  allCursorsRef.on('child_added', (snapshot: any) => {
    const userId = snapshot.key;
    if (userId !== this.currentUserId) {
      this.updateRemoteCursor(userId, snapshot.val());
    }
  });

  allCursorsRef.on('child_changed', (snapshot: any) => {
    const userId = snapshot.key;
    if (userId !== this.currentUserId) {
      this.updateRemoteCursor(userId, snapshot.val());
    }
  });
}
```

### Rendering Remote Cursors

Remote cursors are displayed in the UI:

```typescript
private updateRemoteCursor(userId: string, cursorData: { row: number; col: number; timestamp: number }): void {
  // Check if cursor is recent (within last 5 seconds)
  const isRecent = Date.now() - cursorData.timestamp < 5000;

  if (isRecent) {
    const presence = this.presences.get(userId);
    if (presence) {
      // Render cursor at position with user's color
      this.renderRemoteCursor(cursorData.row, cursorData.col, presence.color, presence.username);
    }
  } else {
    // Remove stale cursor
    this.removeRemoteCursor(userId);
  }
}
```

## Offline Support

### Operation Queue

Operations are queued when offline:

```typescript
private operationQueue: CollaborationOperation[] = [];
private isOnline = true;

emit(event: string, data: unknown): void {
  if (!this.isOnline) {
    // Queue operation for when we come back online
    this.operationQueue.push(data as CollaborationOperation);
    return;
  }

  // Send to Firebase immediately
  this.sendToFirebase(event, data);
}

private handleReconnect(): void {
  this.isOnline = true;

  // Send queued operations
  while (this.operationQueue.length > 0) {
    const operation = this.operationQueue.shift()!;
    this.sendToFirebase('change', operation);
  }
}
```

## Performance Optimizations

### Operation Batching

Multiple rapid changes are batched:

```typescript
private pendingOperations: Map<string, CollaborationOperation> = new Map();

private emitCellChange(operation: CollaborationOperation): void {
  const key = `${operation.sheetId}-${operation.row}-${operation.col}`;

  // Replace pending operation for same cell
  this.pendingOperations.set(key, operation);

  // Debounce sending to Firebase
  this.debouncedSendPendingOperations();
}

private debouncedSendPendingOperations = debounce(() => {
  for (const operation of this.pendingOperations.values()) {
    this.sendToFirebase('change', operation);
  }
  this.pendingOperations.clear();
}, 100);
```

### Presence Throttling

Presence updates are throttled to reduce Firebase load:

```typescript
private throttledUpdatePresence = throttle((presence: Partial<Presence>) => {
  this.updatePresence(presence);
}, 200);

private throttledUpdateCursor = throttle((row: number, col: number) => {
  this.updateCursor(row, col);
}, 50);
```

## Security Considerations

### Authentication

Collaboration requires authenticated users:

```typescript
async connect(workbookId: string): Promise<void> {
  // Verify user authentication
  const user = await this.authenticateUser();
  if (!user) {
    throw new Error('Authentication required for collaboration');
  }

  this.currentUserId = user.id;
  this.currentUsername = user.name;

  // Connect to Firebase with user context
  await this.connectToFirebase(workbookId, user);
}
```

### Authorization

Workbook access is controlled:

```typescript
private async checkWorkbookAccess(workbookId: string, userId: string): Promise<boolean> {
  // Check if user has permission to access workbook
  const permissionsRef = this.db.ref(`workbooks/${workbookId}/permissions/${userId}`);
  const snapshot = await permissionsRef.once('value');
  const permissions = snapshot.val();

  return permissions && (permissions.read || permissions.write);
}
```

The collaboration system provides seamless real-time editing with presence indicators, conflict resolution, and performance optimizations for large workbooks.
