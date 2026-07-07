// ElementView — the absolutely-positioned wrapper for one element. It
// subscribes to just that element (and the theme) via keyed hooks, so a single
// element edit re-renders this node alone. Rotation is a CSS transform about
// the box centre; the un-rotated box's top-left sits at (x, y).

import React from 'react';
import { useElement, useTheme } from '../../hooks';
import type { SlideElement } from '@weavertime/spindle-slides-core';
import { TextView } from './TextView';
import { ShapeView } from './ShapeView';
import { ImageView } from './ImageView';
import { LineView } from './LineView';

function renderInner(el: SlideElement, theme: ReturnType<typeof useTheme>): React.ReactElement {
  switch (el.type) {
    case 'text':
      return <TextView el={el} theme={theme} />;
    case 'shape':
      return <ShapeView el={el} theme={theme} />;
    case 'image':
      return <ImageView el={el} />;
    case 'line':
      return <LineView el={el} theme={theme} />;
  }
}

export function ElementView({ elementId }: { elementId: string }): React.ReactElement | null {
  const el = useElement(elementId);
  const theme = useTheme();
  if (!el) return null;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: el.w,
    height: el.h,
    transform: `translate(${el.x}px, ${el.y}px) rotate(${el.rotation}deg)`,
    transformOrigin: 'center center',
    opacity: el.opacity ?? 1,
    // Idle elements don't intercept pointer events in the read-only renderer;
    // Phase 2 turns this on for the interactive editor.
    pointerEvents: 'none',
  };

  return (
    <div data-element-id={el.id} style={style}>
      {renderInner(el, theme)}
    </div>
  );
}
