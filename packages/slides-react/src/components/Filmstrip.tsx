// Filmstrip — the vertical slide navigator. Read-only in Phase 1 (click to set
// the active slide); drag-to-reorder and the new-slide split button arrive in
// later phases.

import React from 'react';
import { useDeck, useSlideIds, useActiveSlideId } from '../hooks';
import { ScaledSlide } from './SlideView';

const THUMB_WIDTH = 168;

export function Filmstrip(): React.ReactElement {
  const deck = useDeck();
  const slideIds = useSlideIds();
  const activeSlideId = useActiveSlideId();
  const { w } = deck.getSlideSize();
  const scale = THUMB_WIDTH / w;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        overflowY: 'auto',
        background: '#f4f5f7',
        borderRight: '1px solid #e2e4e8',
        minWidth: THUMB_WIDTH + 48,
        boxSizing: 'border-box',
      }}
    >
      {slideIds.map((id, i) => {
        const active = id === activeSlideId;
        return (
          <div key={id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: '#8a93a2', width: 16, textAlign: 'right', paddingTop: 4 }}>{i + 1}</span>
            <button
              onClick={() => deck.setActiveSlide(id)}
              style={{
                padding: 0,
                border: active ? '2px solid #2d7ff9' : '1px solid #d5d9e0',
                borderRadius: 4,
                overflow: 'hidden',
                cursor: 'pointer',
                background: '#fff',
                lineHeight: 0,
                boxShadow: active ? '0 0 0 2px rgba(45,127,249,0.2)' : 'none',
              }}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={active}
            >
              <ScaledSlide slideId={id} scale={scale} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
