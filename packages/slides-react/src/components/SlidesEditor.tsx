// SlidesEditor — the root editor layout: toolbar, filmstrip, and the
// interactive stage. Owns keyboard shortcuts (attached to a focused wrapper,
// not window) and the right-click context menu.

import React, { useEffect, useRef, useState } from 'react';
import { useDeck, useKeyboardShortcuts } from '../hooks';
import { Toolbar } from './Toolbar';
import { TextFormatBar } from './TextFormatBar';
import { Filmstrip } from './Filmstrip';
import { SlideStage } from './SlideStage';
import { NotesPanel } from './NotesPanel';
import { ContextMenu } from './ContextMenu';

const ZOOM_PRESETS: Array<{ label: string; zoom?: number }> = [
  { label: 'Fit', zoom: undefined },
  { label: '50%', zoom: 0.5 },
  { label: '100%', zoom: 1 },
  { label: '200%', zoom: 2 },
];

export interface SlidesEditorProps {
  style?: React.CSSProperties;
  /** Read-only viewer (no toolbar, gestures, or shortcuts). */
  readOnly?: boolean;
}

export function SlidesEditor({ style, readOnly = false }: SlidesEditorProps): React.ReactElement {
  const deck = useDeck();
  const [zoomIdx, setZoomIdx] = useState(0);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const { onKeyDown } = useKeyboardShortcuts();
  const rootRef = useRef<HTMLDivElement>(null);

  // Focus the editor so keyboard shortcuts work without an explicit click.
  useEffect(() => {
    if (!readOnly) rootRef.current?.focus();
  }, [readOnly]);

  return (
    <div
      ref={rootRef}
      tabIndex={readOnly ? undefined : 0}
      onKeyDown={readOnly ? undefined : onKeyDown}
      onContextMenu={(e) => {
        if (readOnly) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        outline: 'none',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#1f2933',
        ...style,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', borderBottom: '1px solid #e2e4e8', background: '#fff' }}>
        <strong style={{ fontSize: 15 }}>{deck.getTitle()}</strong>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {ZOOM_PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setZoomIdx(i)}
              style={{ border: '1px solid #d5d9e0', background: i === zoomIdx ? '#2d7ff9' : '#fff', color: i === zoomIdx ? '#fff' : '#3e4c59', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>
      {!readOnly && <Toolbar />}
      {!readOnly && <TextFormatBar />}
      <div style={{ display: 'flex', flex: '1 1 auto', minHeight: 0 }}>
        <Filmstrip />
        <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minWidth: 0 }}>
          <SlideStage zoom={ZOOM_PRESETS[zoomIdx].zoom} interactive={!readOnly} />
          {!readOnly && <NotesPanel />}
        </div>
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
    </div>
  );
}
