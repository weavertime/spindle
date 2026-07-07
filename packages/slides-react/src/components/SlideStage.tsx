// SlideStage — the central editing canvas. Phase 1 renders the active slide,
// centered, at a given zoom (fit-to-container or an explicit factor).
// Selection overlays, gestures, and guides layer on in Phase 2.

import React, { useLayoutEffect, useRef, useState } from 'react';
import { useDeck, useActiveSlideId } from '../hooks';
import { SlideView } from './SlideView';
import { InteractiveSlide } from './InteractiveSlide';

export interface SlideStageProps {
  /** Explicit zoom factor; when omitted the slide scales to fit the container. */
  zoom?: number;
  /** Enable selection, gestures, and overlays. */
  interactive?: boolean;
}

export function SlideStage({ zoom, interactive = false }: SlideStageProps): React.ReactElement {
  const deck = useDeck();
  const activeSlideId = useActiveSlideId();
  const { w, h } = deck.getSlideSize();
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);

  useLayoutEffect(() => {
    if (zoom !== undefined) return;
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const pad = 48;
      const scale = Math.min((el.clientWidth - pad) / w, (el.clientHeight - pad) / h);
      setFitScale(Math.max(0.05, scale));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [zoom, w, h]);

  const scale = zoom ?? fitScale;

  return (
    <div
      ref={containerRef}
      style={{
        flex: '1 1 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
        background: '#e9ebef',
      }}
    >
      {activeSlideId && interactive ? (
        <InteractiveSlide key={activeSlideId} slideId={activeSlideId} scale={scale} />
      ) : (
        <div style={{ width: w * scale, height: h * scale, flex: 'none' }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: w, height: h, boxShadow: '0 4px 24px rgba(0,0,0,0.16)' }}>
            {activeSlideId ? <SlideView slideId={activeSlideId} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}
