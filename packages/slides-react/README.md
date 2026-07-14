# @weavertime/spindle-slides-react

React components and hooks for [Spindle Slides](https://spindle.weavertime.com) — a full presentation editor over the [`@weavertime/spindle-slides-core`](https://www.npmjs.com/package/@weavertime/spindle-slides-core) engine.

```tsx
import { DeckImpl } from '@weavertime/spindle-slides-core';
import { DeckProvider, SlidesEditor } from '@weavertime/spindle-slides-react';

const deck = new DeckImpl('my-deck', 'Untitled deck');

export function App() {
  return (
    <DeckProvider deck={deck}>
      <SlidesEditor />
    </DeckProvider>
  );
}
```

Includes the interactive stage (selection, move/resize/rotate gestures with smart guides — gestures write straight to the DOM, so a 50-element slide drags at 60 fps with zero React commits mid-move), a toolbar, filmstrip, the single live ProseMirror rich-text editor, table editing (cell selection, per-cell formatting, paste-a-range), present mode with presenter view, real-time collaboration presence, and an element-anchored comments panel. (PDF/PNG export is intentionally left to the host app.)

Compose the whole editor with `SlidesEditor`, or drop down to `SlideStage`, `SlideView`, `Filmstrip`, `PresentMode`, and the `useDeck` / `useElement` / `useSelection` / `useComments` hooks.

Peer dependencies: `react` and `react-dom` (>= 18). Full docs: <https://spindle.weavertime.com/docs/slides/components>.

MIT licensed.
