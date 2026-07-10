// ResponsiveToolbar — lays its children out in a single row and, when they
// don't all fit, collapses the trailing ones into a "⋯ More" popover. Shared by
// the docs, sheets, and slides toolbars so they behave identically at any width:
// wide → everything inline; narrow → some inline + overflow menu; mobile → the
// menu holds nearly everything (a menu-style toolbar).
//
// Widths are measured from the real rendered items (no hidden double-render, so
// no duplicated effects) and cached by index; on resize we recompute how many
// fit from the cache. The row itself never overflows — items that don't fit are
// moved into the popover — so tooltips/dropdowns that rely on `overflow: visible`
// keep working.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface ResponsiveToolbarProps {
  /** Toolbar items, in priority order (earliest stay inline the longest). */
  children: React.ReactNode;
  /** Gap between items, px (should match the toolbar's own gap). */
  gap?: number;
  /** Icon/content for the overflow trigger (defaults to a "⋯" glyph). */
  moreIcon?: React.ReactNode;
  moreLabel?: string;
  style?: React.CSSProperties;
  className?: string;
  /** Extra style for the overflow popover panel. */
  popoverStyle?: React.CSSProperties;
}

const moreButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, flex: '0 0 auto', border: 'none', borderRadius: 8,
  background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 18,
  lineHeight: 1, fontFamily: 'inherit',
};

const popoverBase: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 1000,
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4,
  // A min width so the icons form a tidy grid instead of a tall 1-wide column.
  minWidth: 232, maxWidth: 320, padding: 8, borderRadius: 12,
  background: 'rgba(255,255,255,0.98)',
  backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  boxShadow: '0 10px 30px -8px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06)',
};

export function ResponsiveToolbar({
  children, gap = 2, moreIcon, moreLabel = 'More tools', style, className, popoverStyle,
}: ResponsiveToolbarProps): React.ReactElement {
  // toArray already drops null/undefined/boolean children and assigns keys.
  const items = React.Children.toArray(children);
  const n = items.length;

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const moreRef = useRef<HTMLButtonElement>(null);
  const widths = useRef<number[]>([]);
  const moreW = useRef(40);

  const [visible, setVisible] = useState(n);
  const [open, setOpen] = useState(false);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    // Refresh cached widths from whatever is currently inline.
    for (let i = 0; i < itemRefs.current.length; i++) {
      const el = itemRefs.current[i];
      if (el) widths.current[i] = el.offsetWidth;
    }
    if (moreRef.current) moreW.current = moreRef.current.offsetWidth;

    const avail = container.clientWidth;
    let total = 0;
    for (let i = 0; i < n; i++) total += (widths.current[i] || 0) + (i > 0 ? gap : 0);

    let count: number;
    if (total <= avail + 0.5) {
      count = n;
    } else {
      const budget = avail - moreW.current - gap;
      let used = 0;
      count = 0;
      for (let i = 0; i < n; i++) {
        const add = (widths.current[i] || 0) + (count > 0 ? gap : 0);
        if (used + add <= budget) { used += add; count += 1; } else break;
      }
    }
    setVisible((prev) => (prev === count ? prev : count));
  }, [n, gap]);

  useLayoutEffect(() => { measure(); });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    return () => ro.disconnect();
  }, [measure]);

  // Close the overflow menu on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const overflow = visible < n;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap, width: '100%', minWidth: 0, ...style }}
    >
      {items.slice(0, visible).map((item, i) => (
        <div key={i} ref={(el) => { itemRefs.current[i] = el; }} style={{ display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' }}>
          {item}
        </div>
      ))}

      {overflow && (
        <div style={{ position: 'relative', marginLeft: 'auto', flex: '0 0 auto' }}>
          <button
            ref={moreRef}
            type="button"
            aria-label={moreLabel}
            title={moreLabel}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            style={moreButtonStyle}
          >
            {moreIcon ?? '⋯'}
          </button>
          {open && (
            <>
              <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
              <div role="menu" style={{ ...popoverBase, ...popoverStyle }}>
                {items.slice(visible).map((item, i) => (
                  <div key={i} style={{ display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' }}>
                    {item}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
