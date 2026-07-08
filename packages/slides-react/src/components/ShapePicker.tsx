// ShapePicker — a toolbar dropdown exposing every built-in shape preset (the
// toolbar previously offered only rectangle + ellipse). Each preset renders as
// a mini inline-SVG using the same geometry as the canvas; selecting one
// inserts it centred on the active slide.

import React, { useRef, useState } from 'react';
import { Shapes as ShapesIcon, ChevronDown } from 'lucide-react';
import type { ShapePreset, NewElementSpec } from '@weavertime/spindle-slides-core';
import { shapeGeom } from './elements/shapes';
import { useDeck } from '../hooks';
import { Popover } from './Popover';

const PRESETS: ShapePreset[] = [
  'rect', 'roundRect', 'ellipse', 'triangle', 'rightTriangle', 'diamond',
  'pentagon', 'hexagon', 'octagon', 'star5', 'arrowRight', 'arrowLeft',
  'chevron', 'parallelogram', 'trapezoid', 'plus', 'heart', 'cloud',
];

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 2, height: 30, padding: '0 6px',
  border: '1px solid #d5d9e0', borderRadius: 5, background: '#fff', color: '#3e4c59', cursor: 'pointer',
};

function ShapeIcon({ preset }: { preset: ShapePreset }): React.ReactElement {
  const g = shapeGeom(preset, 22, 22);
  return (
    <svg width={22} height={22} viewBox="-1 -1 24 24" style={{ display: 'block' }}>
      {g.type === 'ellipse' ? (
        <ellipse cx={g.cx} cy={g.cy} rx={g.rx} ry={g.ry} fill="#5b6673" />
      ) : (
        <path d={g.d} fill="#5b6673" />
      )}
    </svg>
  );
}

export function ShapePicker(): React.ReactElement {
  const deck = useDeck();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const { w, h } = deck.getSlideSize();

  const insert = (preset: ShapePreset) => {
    const size = { w: 220, h: 180 };
    const slideId = deck.getActiveSlideId();
    const el = deck.addElement(slideId, {
      type: 'shape',
      shape: preset,
      x: (w - size.w) / 2,
      y: (h - size.h) / 2,
    } as NewElementSpec);
    deck.setSelection({ slideId, elementIds: [el.id] });
    setOpen(false);
  };

  return (
    <>
      <button ref={anchorRef} title="Shapes" style={btn} onClick={() => setOpen((o) => !o)}>
        <ShapesIcon size={16} />
        <ChevronDown size={12} />
      </button>
      {open && (
        <Popover anchor={anchorRef.current} onClose={() => setOpen(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 32px)', gap: 4 }}>
            {PRESETS.map((p) => (
              <button
                key={p}
                title={p}
                onClick={() => insert(p)}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid transparent', borderRadius: 5, background: '#fff', cursor: 'pointer' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#f1f4f8')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#fff')}
              >
                <ShapeIcon preset={p} />
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  );
}
