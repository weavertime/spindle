// ResponsiveToolbar — lays its children out in a single row and, when they
// don't all fit, collapses the trailing ones into a "⋯ More" menu. Shared by
// the docs, sheets, and slides toolbars so they behave identically at any width:
// wide → everything inline; narrow → some inline + overflow menu; mobile → the
// menu holds nearly everything (a menu-style toolbar).
//
// The overflow menu is a structured vertical list — each control on its own row
// with its label (read from the child's title/tooltip), real separators where
// the toolbar had dividers. Widths are measured from the real rendered items
// (no hidden double-render) and cached by index; on resize we recompute how many
// fit. The row itself never overflows — items that don't fit move into the menu —
// so tooltips/dropdowns that rely on `overflow: visible` keep working.

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
  /** Extra style for the overflow menu panel. */
  popoverStyle?: React.CSSProperties;
}

// Below this measured width an item is treated as a divider (toolbar dividers
// are ~1px wide + margins ≈ 13px; the smallest real control is ~28px).
const DIVIDER_MAX_W = 18;

const moreButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, flex: '0 0 auto', border: 'none', borderRadius: 8,
  background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 18,
  lineHeight: 1, fontFamily: 'inherit',
};

const menuStyle: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 10000,
  display: 'flex', flexDirection: 'column', gap: 1,
  minWidth: 210, maxWidth: 300, maxHeight: '70vh', overflowY: 'auto',
  padding: 6, borderRadius: 12, boxSizing: 'border-box',
  background: '#fff', border: '1px solid rgba(15,23,42,0.08)',
  boxShadow: '0 16px 40px -12px rgba(0,0,0,0.38), 0 2px 8px rgba(0,0,0,0.08)',
  fontFamily: 'inherit',
};

// Flatten fragments so a grouped `<>…</>` of controls becomes individual items
// (each measurable, each its own labelled row in the overflow menu) instead of
// one opaque cluster.
function flattenChildren(children: React.ReactNode): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      out.push(...flattenChildren((child.props as { children?: React.ReactNode }).children));
    } else if (child !== null && child !== undefined && typeof child !== 'boolean') {
      out.push(child);
    }
  });
  return out;
}

function getLabel(item: React.ReactNode): string | null {
  if (!React.isValidElement(item)) return null;
  const p = item.props as Record<string, unknown>;
  const cand = p.tooltip ?? p.title ?? p['aria-label'];
  return typeof cand === 'string' && cand.trim() ? cand : null;
}

function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById('sp-rt-styles')) return;
  const s = document.createElement('style');
  s.id = 'sp-rt-styles';
  s.textContent =
    '.sp-rt-menuitem{transition:background .12s ease}' +
    '.sp-rt-menuitem:hover{background:rgba(99,102,241,0.10)}' +
    '.sp-rt-more:hover{background:rgba(99,102,241,0.08);color:#6366f1}';
  document.head.appendChild(s);
}

export function ResponsiveToolbar({
  children, gap = 2, moreIcon, moreLabel = 'More tools', style, className, popoverStyle,
}: ResponsiveToolbarProps): React.ReactElement {
  // Flatten fragments to individual controls (see flattenChildren).
  const items = flattenChildren(children);
  const n = items.length;

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const moreRef = useRef<HTMLButtonElement>(null);
  const widths = useRef<number[]>([]);
  const moreW = useRef(40);

  const [visible, setVisible] = useState(n);
  const [open, setOpen] = useState(false);

  useEffect(ensureStyles, []);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const overflow = visible < n;

  // Build the menu rows: a labelled row per control, a thin rule where the
  // toolbar had a divider (skipping leading/duplicate/trailing dividers).
  const rows: React.ReactNode[] = [];
  if (overflow) {
    let lastDivider = true; // suppresses a leading rule
    for (let i = visible; i < n; i++) {
      const item = items[i];
      const w = widths.current[i];
      if (w != null && w > 0 && w < DIVIDER_MAX_W) {
        if (!lastDivider) { rows.push(<div key={`d${i}`} style={{ height: 1, margin: '4px 8px', background: 'rgba(15,23,42,0.08)', flex: '0 0 auto' }} />); lastDivider = true; }
        continue;
      }
      const label = getLabel(item);
      rows.push(
        <div
          key={`i${i}`}
          role="menuitem"
          className={label ? 'sp-rt-menuitem' : undefined}
          onClick={label ? () => setOpen(false) : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 10px 2px 4px', borderRadius: 8, cursor: label ? 'pointer' : 'default' }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' }}>{item}</span>
          {label && <span style={{ fontSize: 13, color: '#334155', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{label}</span>}
        </div>
      );
      lastDivider = false;
    }
    while (rows.length && (rows[rows.length - 1] as React.ReactElement).key?.toString().startsWith('d')) rows.pop();
  }

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
            className="sp-rt-more"
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
              <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999 }} />
              <div role="menu" style={{ ...menuStyle, ...popoverStyle }}>
                {rows}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
