// SlidesEditor — the root layout: a header, the filmstrip, and the stage.
// Phase 1 is a read-only viewer with zoom controls; the editing toolbar,
// keyboard, and clipboard land in Phase 2 (this component grows to own them).

import React, { useState } from 'react';
import { useDeck } from '../hooks';
import { Filmstrip } from './Filmstrip';
import { SlideStage } from './SlideStage';

const ZOOM_PRESETS: Array<{ label: string; zoom?: number }> = [
  { label: 'Fit', zoom: undefined },
  { label: '50%', zoom: 0.5 },
  { label: '100%', zoom: 1 },
  { label: '200%', zoom: 2 },
];

export interface SlidesEditorProps {
  style?: React.CSSProperties;
}

export function SlidesEditor({ style }: SlidesEditorProps): React.ReactElement {
  const deck = useDeck();
  const [zoomIdx, setZoomIdx] = useState(0);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#1f2933',
        ...style,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '10px 16px',
          borderBottom: '1px solid #e2e4e8',
          background: '#fff',
        }}
      >
        <strong style={{ fontSize: 15 }}>{deck.getTitle()}</strong>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {ZOOM_PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setZoomIdx(i)}
              style={{
                border: '1px solid #d5d9e0',
                background: i === zoomIdx ? '#2d7ff9' : '#fff',
                color: i === zoomIdx ? '#fff' : '#3e4c59',
                borderRadius: 4,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>
      <div style={{ display: 'flex', flex: '1 1 auto', minHeight: 0 }}>
        <Filmstrip />
        <SlideStage zoom={ZOOM_PRESETS[zoomIdx].zoom} />
      </div>
    </div>
  );
}
