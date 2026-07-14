# @weavertime/spindle-slides-core

The framework-agnostic presentation engine behind [Spindle Slides](https://spindle.weavertime.com). Zero React.

It owns the deck model, a container-agnostic **scene layer** (elements — text, shapes, images, lines/connectors, and **tables** — rotated-rect geometry, anchor-invariant resize/rotate, snapping, align/distribute, z-order, flat groups, fractional indexing), rich text (a flat ProseMirror schema + pure JSON helpers), themes & layouts, comments, and an optional Yjs collaboration binding. Tables carry per-cell rich text, cell/row/column selection state, and content-driven row heights.

```ts
import { DeckImpl } from '@weavertime/spindle-slides-core';

const deck = new DeckImpl('my-deck', 'Untitled deck');
const slide = deck.getActiveSlideId();
deck.addElement(slide, { type: 'shape', shape: 'star5', x: 100, y: 100 });

const json = deck.getData();   // plain JSON — author by hand or generate
```

- **Immutable records + semantic events** — every mutation replaces the object and emits a typed event, so a React layer can subscribe at element granularity.
- **Collab is opt-in and lazy** — `deck.attachCollab(provider, identity)` loads the Yjs binding as a separate chunk (`@weavertime/spindle-slides-core/collab`); consumers who don't collaborate never load Yjs.
- **Pure-JSON model** — `getData()` / `setData()` round-trip a `DeckData` object.

Pair with **[`@weavertime/spindle-slides-react`](https://www.npmjs.com/package/@weavertime/spindle-slides-react)** for the editor UI. Full docs: <https://spindle.weavertime.com/docs/slides/overview>.

MIT licensed.
