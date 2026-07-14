# @weavertime/spindle-shared

Shared utilities for Spindle packages, used across the docs, sheets, and slides
cores and their React layers.

## Exports

- **EventEmitter**: Generic event emitter for event-driven architectures
- **Collaboration**: Yjs-based collaboration types and an in-memory
  `CollabProvider` (the WebSocket transport lives in
  `@weavertime/spindle-transport-websocket`)
- **`@weavertime/spindle-shared/react`**: shared React UI — notably
  `ResponsiveToolbar` (overflow/menu toolbar used by all three editors)

## Usage

```typescript
import { EventEmitter } from '@weavertime/spindle-shared';

// Create an event emitter with specific event types
type MyEventTypes = 'change' | 'update' | 'delete';
const emitter = new EventEmitter<MyEventTypes>();

emitter.on('change', (data) => {
  console.log('Change event:', data.payload);
});

emitter.emit('change', { some: 'data' });
```

