// PresentMode — full-screen playback. Portals to <body>, requests fullscreen,
// and letterboxes the same static SlideView at min(vw/w, vh/h). Arrow/Space/
// PgUp-Dn/Home/End/number-jump navigation; a 150ms opacity cross-fade is the
// only v1 transition. No editing chrome.

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { richTextToPlainText } from '@weavertime/spindle-slides-core';
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
  const [showNotes, setShowNotes] = useState(false);
  const numberBuffer = useRef('');

  // Current index / count via refs so the keydown listener (subscribed once)
  // always reads fresh values without re-subscribing on every navigation.
  const indexRef = useRef(index);
  indexRef.current = index;
  const lenRef = useRef(slideIds.length);
  lenRef.current = slideIds.length;

  const go = (i: number) => {
    const next = Math.max(0, Math.min(lenRef.current - 1, i));
    if (next === indexRef.current) return;
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

  // Enter fullscreen once on mount; exit only on unmount. Doing this per
  // navigation would exit fullscreen on every slide change (and the re-request
  // is rejected outside a user gesture) — the slide would drop out of fullscreen.
  useEffect(() => {
    containerRef.current?.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // Keyboard navigation — subscribe once; handlers read the refs above.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          go(indexRef.current + 1);
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          go(indexRef.current - 1);
          e.preventDefault();
          break;
        case 'Home':
          go(0);
          break;
        case 'End':
          go(lenRef.current - 1);
          break;
        case 'Escape':
          onExit();
          break;
        case 's':
        case 'S':
          setShowNotes((v) => !v);
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
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the engine's active slide in sync so the filmstrip reflects the jump.
  useEffect(() => {
    if (slideIds[index]) deck.setActiveSlide(slideIds[index]);
  }, [index, slideIds, deck]);

  const slideId = slideIds[index];
  const notesDoc = slideId ? deck.getSlide(slideId)?.notes : undefined;
  const notes = notesDoc ? richTextToPlainText(notesDoc).trim() : '';

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
      <div style={{ position: 'fixed', bottom: 16, left: 20, color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
        Press S for speaker notes
      </div>
      {showNotes && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '32vh', overflowY: 'auto',
            background: 'rgba(15,17,23,0.94)', backdropFilter: 'blur(8px)', color: '#e7e9f1',
            borderTop: '1px solid rgba(255,255,255,0.12)', padding: '18px 40px 22px',
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 8, fontFamily: 'ui-monospace, monospace' }}>
            Speaker notes · slide {index + 1}
          </div>
          <div style={{ fontSize: 18, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {notes || <span style={{ color: 'rgba(255,255,255,0.4)' }}>No notes for this slide.</span>}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
