// Filmstrip — the vertical slide navigator. Click to activate, drag to
// reorder (HTML5 DnD → deck.moveSlide), and an add-slide button at the bottom.

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useDeck, useSlideIds, useActiveSlideId } from '../hooks';
import { ScaledSlide } from './SlideView';

const THUMB_WIDTH = 168;

export function Filmstrip(): React.ReactElement {
  const deck = useDeck();
  const slideIds = useSlideIds();
  const activeSlideId = useActiveSlideId();
  const { w } = deck.getSlideSize();
  const scale = THUMB_WIDTH / w;
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    // Drop places the dragged slide immediately after the target.
    deck.moveSlide(dragId, { afterSlideId: targetId });
    setDragId(null);
    setOverId(null);
  };

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
          <div
            key={id}
            draggable
            onDragStart={() => setDragId(id)}
            onDragOver={(e) => { e.preventDefault(); setOverId(id); }}
            onDrop={() => onDrop(id)}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
            style={{ display: 'flex', gap: 8, alignItems: 'flex-start', opacity: dragId === id ? 0.4 : 1, borderTop: overId === id && dragId ? '2px solid #2d7ff9' : '2px solid transparent' }}
          >
            <span style={{ fontSize: 12, color: '#8a93a2', width: 16, textAlign: 'right', paddingTop: 4 }}>{i + 1}</span>
            <button
              onClick={() => deck.setActiveSlide(id)}
              style={{ padding: 0, border: active ? '2px solid #2d7ff9' : '1px solid #d5d9e0', borderRadius: 4, overflow: 'hidden', cursor: 'pointer', background: '#fff', lineHeight: 0, boxShadow: active ? '0 0 0 2px rgba(45,127,249,0.2)' : 'none' }}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={active}
            >
              <ScaledSlide slideId={id} scale={scale} />
            </button>
          </div>
        );
      })}
      <button
        onClick={() => { const s = deck.addSlide({ afterSlideId: activeSlideId, layoutId: 'titleContent' }); deck.setActiveSlide(s.id); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginLeft: 24, height: 40, border: '1px dashed #c4cad3', borderRadius: 6, background: '#fff', color: '#5b6673', cursor: 'pointer', fontSize: 13 }}
      >
        <Plus size={15} /> New slide
      </button>
    </div>
  );
}
