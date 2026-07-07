// PresentMode — full-screen playback. Portals to <body>, requests fullscreen,
// and letterboxes the same static SlideView at min(vw/w, vh/h). Arrow/Space/
// PgUp-Dn/Home/End/number-jump navigation; a 150ms opacity cross-fade is the
// only v1 transition. No editing chrome.

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDeck, useSlideIds, useActiveSlideId } from '../hooks';
import { SlideView } from './SlideView';

export function PresentMode({ onExit }: { onExit: () => void }): React.ReactElement {
  const deck = useDeck();
  const slideIds = useSlideIds();
  const active = useActiveSlideId();
  const { w, h } = deck.getSlideSize();
  const containerRef = useRef<HTMLDivElement>(null);

  const [index, setIndex] = useState(() => Math.max(0, slideIds.indexOf(active)));
  const [scale, setScale] = useState(1);
  const [fading, setFading] = useState(false);
  const numberBuffer = useRef('');

  const go = (i: number) => {
    const next = Math.max(0, Math.min(slideIds.length - 1, i));
    if (next === index) return;
    setFading(true);
    setIndex(next);
    window.setTimeout(() => setFading(false), 20);
  };

  useLayoutEffect(() => {
    const measure = () => setScale(Math.min(window.innerWidth / w, window.innerHeight / h));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [w, h]);

  useEffect(() => {
    containerRef.current?.requestFullscreen?.().catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          go(index + 1);
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          go(index - 1);
          e.preventDefault();
          break;
        case 'Home':
          go(0);
          break;
        case 'End':
          go(slideIds.length - 1);
          break;
        case 'Escape':
          onExit();
          break;
        default:
          if (/^[0-9]$/.test(e.key)) {
            numberBuffer.current += e.key;
          } else if (e.key === 'Enter' && numberBuffer.current) {
            go(parseInt(numberBuffer.current, 10) - 1);
            numberBuffer.current = '';
          }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slideIds.length]);

  // Keep the engine's active slide in sync so the filmstrip reflects the jump.
  useEffect(() => {
    if (slideIds[index]) deck.setActiveSlide(slideIds[index]);
  }, [index, slideIds, deck]);

  const slideId = slideIds[index];

  return createPortal(
    <div
      ref={containerRef}
      onClick={(e) => { if (e.detail) go(index + 1); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        cursor: 'default',
      }}
    >
      <div style={{ width: w * scale, height: h * scale, opacity: fading ? 0 : 1, transition: 'opacity 150ms ease' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: w, height: h }}>
          {slideId ? <SlideView slideId={slideId} /> : null}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onExit(); }}
        style={{ position: 'fixed', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}
      >
        Exit (Esc)
      </button>
      <div style={{ position: 'fixed', bottom: 16, right: 20, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
        {index + 1} / {slideIds.length}
      </div>
    </div>,
    document.body
  );
}
