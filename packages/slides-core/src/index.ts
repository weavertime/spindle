// @weavertime/spindle-slides-core
// Core presentation engine (no Yjs — import '@weavertime/spindle-slides-core/collab' for that).

// Deck-layer types + events
export * from './types';

// Scene layer
export * from './scene/types';
export * from './scene/elements';
export * from './scene/fractional-index';

// Rich text model
export * from './text/model';

// Theme + layouts
export * from './theme/types';
export * from './theme/resolve';
export * from './theme/builtin';

// Engine
export { DeckImpl } from './deck';
export type { NewElementSpec, AddSlideOptions } from './deck';
export { DeckHistory } from './history';
export type { DeckSnapshot } from './history';
export { normalizeDeckData } from './serialization';

// Utilities re-exported for convenience
export { generateId } from './utils/id';
export { EventEmitter } from '@weavertime/spindle-shared';
