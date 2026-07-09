// GuidesOverlay draws smart-guide lines and the marquee rectangle. It only
// subscribes to the TransientStore, so it repaints on gesture ticks without
// touching the rest of the tree. Rendered in slide coordinates inside the
// scaled container; line/handle sizes are counter-scaled by 1/scale.

import React, { useSyncExternalStore } from 'react';
import { useDeckContext } from '../context/DeckContext';

const GUIDE = '#f5375f';

export function GuidesOverlay({ scale }: { scale: number }): React.ReactElement {
  const { deck, transient } = useDeckContext();
  const state = useSyncExternalStore(transient.subscribe, transient.get);
  const { w, h } = deck.getSlideSize();
  const line = 1 / scale;

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, pointerEvents: 'none', overflow: 'visible' }}>
      {state.guides.map((g, i) =>
        g.axis === 'x' ? (
          <div key={i} style={{ position: 'absolute', left: g.pos, top: 0, width: line, height: h, background: GUIDE }} />
        ) : (
          <div key={i} style={{ position: 'absolute', left: 0, top: g.pos, width: w, height: line, background: GUIDE }} />
        )
      )}
      {state.marquee ? (
        <div
          style={{
            position: 'absolute',
            left: state.marquee.x,
            top: state.marquee.y,
            width: state.marquee.w,
            height: state.marquee.h,
            border: `${line}px solid #2d7ff9`,
            background: 'rgba(45,127,249,0.1)',
          }}
        />
      ) : null}
    </div>
  );
}
