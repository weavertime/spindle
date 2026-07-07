// Deck-level controls: the new-slide layout gallery, theme picker, and slide
// background color. Rendered at the start of the toolbar.

import React, { useState } from 'react';
import { Plus, Palette, ChevronDown } from 'lucide-react';
import { BUILTIN_THEMES, getBuiltinTheme } from '@weavertime/spindle-slides-core';
import { useDeck, useActiveSlideId, useTheme, useSlide } from '../hooks';

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, height: 30, padding: '0 10px',
  border: '1px solid #d5d9e0', borderRadius: 5, background: '#fff', color: '#3e4c59',
  cursor: 'pointer', fontSize: 13,
};

function Popover({ children, onClose }: { children: React.ReactNode; onClose: () => void }): React.ReactElement {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 41, background: '#fff', border: '1px solid #d5d9e0', borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,0.16)', padding: 6, minWidth: 200 }}>
        {children}
      </div>
    </>
  );
}

export function DeckControls(): React.ReactElement {
  const deck = useDeck();
  const activeSlideId = useActiveSlideId();
  const theme = useTheme();
  const slide = useSlide(activeSlideId);
  const [open, setOpen] = useState<null | 'layout' | 'theme'>(null);

  const layouts = deck.getLayouts();
  const bgHex = slide?.background?.kind === 'solid' && slide.background.color.kind === 'rgb' ? slide.background.color.hex : '#ffffff';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative' }}>
        <button style={btn} title="New slide" onClick={() => setOpen(open === 'layout' ? null : 'layout')}>
          <Plus size={15} /> Slide <ChevronDown size={13} />
        </button>
        {open === 'layout' && (
          <Popover onClose={() => setOpen(null)}>
            <div style={{ fontSize: 11, color: '#8a93a2', padding: '2px 6px 6px' }}>Add slide with layout</div>
            {layouts.map((l) => (
              <div
                key={l.id}
                onClick={() => { const s = deck.addSlide({ afterSlideId: activeSlideId, layoutId: l.id }); deck.setActiveSlide(s.id); setOpen(null); }}
                style={{ padding: '7px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 13 }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#f1f4f8')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                {l.name}
              </div>
            ))}
          </Popover>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <button style={btn} title="Theme" onClick={() => setOpen(open === 'theme' ? null : 'theme')}>
          <Palette size={15} /> {theme.name} <ChevronDown size={13} />
        </button>
        {open === 'theme' && (
          <Popover onClose={() => setOpen(null)}>
            {BUILTIN_THEMES.map((t) => (
              <div
                key={t.name}
                onClick={() => { deck.setTheme(getBuiltinTheme(t.name)); setOpen(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 13 }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#f1f4f8')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
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
      </div>

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
