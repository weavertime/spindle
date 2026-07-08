// Deck-level controls: the new-slide layout gallery, theme picker, and slide
// background color. Rendered at the start of the toolbar. Menus use a portal
// Popover so they aren't clipped by the toolbar's overflow.

import React, { useRef, useState } from 'react';
import { Plus, Palette, ChevronDown } from 'lucide-react';
import { BUILTIN_THEMES, getBuiltinTheme } from '@weavertime/spindle-slides-core';
import { useDeck, useActiveSlideId, useTheme, useSlide } from '../hooks';
import { Popover } from './Popover';
import { LayoutThumb } from './LayoutThumb';

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, height: 30, padding: '0 10px',
  border: '1px solid #d5d9e0', borderRadius: 5, background: '#fff', color: '#3e4c59',
  cursor: 'pointer', fontSize: 13,
};

const item: React.CSSProperties = { padding: '7px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 13 };

export function DeckControls(): React.ReactElement {
  const deck = useDeck();
  const activeSlideId = useActiveSlideId();
  const theme = useTheme();
  const slide = useSlide(activeSlideId);
  const [open, setOpen] = useState<null | 'layout' | 'theme'>(null);
  const layoutRef = useRef<HTMLButtonElement>(null);
  const themeRef = useRef<HTMLButtonElement>(null);

  const layouts = deck.getLayouts();
  const slideSize = deck.getSlideSize();
  const bgHex = slide?.background?.kind === 'solid' && slide.background.color.kind === 'rgb' ? slide.background.color.hex : '#ffffff';

  const hover = (e: React.MouseEvent, on: boolean) => ((e.currentTarget as HTMLElement).style.background = on ? '#f1f4f8' : 'transparent');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button ref={layoutRef} style={btn} title="New slide" onClick={() => setOpen(open === 'layout' ? null : 'layout')}>
        <Plus size={15} /> Slide <ChevronDown size={13} />
      </button>
      {open === 'layout' && (
        <Popover anchor={layoutRef.current} onClose={() => setOpen(null)}>
          <div style={{ fontSize: 11, color: '#8a93a2', padding: '2px 6px 8px' }}>Add slide with layout</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: 300 }}>
            {layouts.map((l) => (
              <div
                key={l.id}
                onClick={() => { const s = deck.addSlide({ afterSlideId: activeSlideId, layoutId: l.id }); deck.setActiveSlide(s.id); setOpen(null); }}
                style={{ cursor: 'pointer', borderRadius: 6, padding: 4 }}
                onMouseEnter={(e) => hover(e, true)}
                onMouseLeave={(e) => hover(e, false)}
              >
                <div style={{ border: '1px solid #d5d9e0', borderRadius: 4, overflow: 'hidden', aspectRatio: `${slideSize.w} / ${slideSize.h}`, background: '#fff' }}>
                  <LayoutThumb layout={l} size={slideSize} />
                </div>
                <div style={{ fontSize: 12, color: '#3e4c59', textAlign: 'center', marginTop: 4 }}>{l.name}</div>
              </div>
            ))}
          </div>
        </Popover>
      )}

      <button ref={themeRef} style={btn} title="Theme" onClick={() => setOpen(open === 'theme' ? null : 'theme')}>
        <Palette size={15} /> {theme.name} <ChevronDown size={13} />
      </button>
      {open === 'theme' && (
        <Popover anchor={themeRef.current} onClose={() => setOpen(null)}>
          {BUILTIN_THEMES.map((t) => (
            <div
              key={t.name}
              onClick={() => { deck.setTheme(getBuiltinTheme(t.name)); setOpen(null); }}
              style={{ ...item, display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={(e) => hover(e, true)}
              onMouseLeave={(e) => hover(e, false)}
            >
              <span style={{ display: 'flex', gap: 2 }}>
                {(['accent1', 'accent2', 'accent3', 'accent4'] as const).map((s) => (
                  <span key={s} style={{ width: 12, height: 12, borderRadius: 3, background: t.colors[s] }} />
                ))}
              </span>
              {t.name}
            </div>
          ))}
        </Popover>
      )}

      <label style={{ ...btn, gap: 6 }} title="Slide background">
        Background
        <input
          type="color"
          value={bgHex}
          onChange={(e) => deck.setSlideBackground(activeSlideId, { kind: 'solid', color: { kind: 'rgb', hex: e.target.value } })}
          style={{ width: 22, height: 22, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
        />
      </label>
    </div>
  );
}
