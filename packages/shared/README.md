# @weavertime/spindle-shared

Shared utilities for Spindle packages. This package contains framework-agnostic utilities that can be used by both sheets-core and docs-core.

## Exports

- **EventEmitter**: Generic event emitter for event-driven architectures
- **Collaboration**: Collaboration infrastructure (Firebase provider, types)

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

