// PresentMode — full-screen playback. Portals to <body>, requests fullscreen,
// and letterboxes the same static SlideView at min(vw/w, vh/h). Arrow/Space/
// PgUp-Dn/Home/End/number-jump navigation; a 150ms opacity cross-fade is the
// only v1 transition. No editing chrome.

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { richTextToPlainText } from '@weavertime/spindle-slides-core';
import { useDeck, useSlideIds, useActiveSlideId } from '../hooks';
import { SlideView, ScaledSlide } from './SlideView';

/** Opacity cross-fade duration; the navigation timeout and the CSS transition
 *  must share this so the fade actually completes before the slide swaps. */
const FADE_MS = 150;
/** Clear a typed slide-number after this idle gap so a stray digit doesn't
 *  linger and hijack a later Enter. */
const NUMBER_IDLE_MS = 1500;

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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
  const numberTimer = useRef<number | undefined>(undefined);

  // Drop any partially-typed slide number and cancel its idle timer. Uses only
  // refs, so it stays correct when called from the once-subscribed key handler.
  const clearNumberBuffer = () => {
    numberBuffer.current = '';
    if (numberTimer.current !== undefined) {
      window.clearTimeout(numberTimer.current);
      numberTimer.current = undefined;
    }
  };

  // Current index / count via refs so the keydown listener (subscribed once)
  // always reads fresh values without re-subscribing on every navigation.
  const indexRef = useRef(index);
  indexRef.current = index;
  const lenRef = useRef(slideIds.length);
  lenRef.current = slideIds.length;

  const go = (i: number) => {
    // Any navigation ends the current number-jump entry.
    clearNumberBuffer();
    const next = Math.max(0, Math.min(lenRef.current - 1, i));
    if (next === indexRef.current) return;
    // Fade the current slide out, swap at the bottom of the fade, then fade the
    // new slide back in — the swap timeout matches the CSS transition so the
    // cross-fade actually completes.
    setFading(true);
    window.setTimeout(() => {
      setIndex(next);
      setFading(false);
    }, FADE_MS);
  };

  useLayoutEffect(() => {
    const measure = () => setScale(Math.min(window.innerWidth / w, window.innerHeight / h));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [w, h]);

  // Elapsed presentation timer (from mount).
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, []);

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
            // Restart the idle timer so a digit typed and abandoned doesn't
            // persist across slides and swallow a later Enter.
            if (numberTimer.current !== undefined) window.clearTimeout(numberTimer.current);
            numberTimer.current = window.setTimeout(clearNumberBuffer, NUMBER_IDLE_MS);
          } else if (e.key === 'Enter' && numberBuffer.current) {
            go(parseInt(numberBuffer.current, 10) - 1); // go() clears the buffer
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
  const nextId = slideIds[index + 1];
  const notesDoc = slideId ? deck.getSlide(slideId)?.notes : undefined;
  const notes = notesDoc ? richTextToPlainText(notesDoc).trim() : '';
  const nextThumb = 220 / w;

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
      <div style={{ width: w * scale, height: h * scale, opacity: fading ? 0 : 1, transition: `opacity ${FADE_MS}ms ease` }}>
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
      <div style={{ position: 'fixed', bottom: 16, right: 20, color: 'rgba(255,255,255,0.65)', fontSize: 13, fontFamily: 'ui-monospace, monospace', display: 'flex', gap: 14, fontVariantNumeric: 'tabular-nums' }}>
        <span title="Elapsed">{mmss(elapsed)}</span>
        <span>{index + 1} / {slideIds.length}</span>
      </div>
      <div style={{ position: 'fixed', bottom: 16, left: 20, color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
        Press S for presenter panel
      </div>
      {showNotes && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '34vh', overflowY: 'auto',
            background: 'rgba(15,17,23,0.94)', backdropFilter: 'blur(8px)', color: '#e7e9f1',
            borderTop: '1px solid rgba(255,255,255,0.12)', padding: '18px 40px 22px',
            display: 'flex', gap: 36, alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 8, fontFamily: 'ui-monospace, monospace' }}>
              Speaker notes · slide {index + 1}
            </div>
            <div style={{ fontSize: 18, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {notes || <span style={{ color: 'rgba(255,255,255,0.4)' }}>No notes for this slide.</span>}
            </div>
          </div>
          <div style={{ flex: 'none', width: 220 }}>
            <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 8, fontFamily: 'ui-monospace, monospace' }}>
              Next
            </div>
            {nextId ? (
              <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)', lineHeight: 0 }}>
                <ScaledSlide slideId={nextId} scale={nextThumb} />
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>End of deck</div>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
