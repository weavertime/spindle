// ResponsiveToolbar — lays its children out in a single full-width row and, when
// they don't all fit, collapses the trailing ones into an overflow menu. Shared
// by the docs, sheets, and slides toolbars so they behave identically at any
// width: wide → everything inline; narrow → some inline + overflow; the menu
// holds nearly everything at the smallest sizes (a menu-style toolbar).
//
// The overflow surface is PORTALED to <body> so it can't be clipped or covered
// by the editor's own stacking contexts / overflow — a plain absolutely-
// positioned popover inside the toolbar gets trapped by those. On desktop it's a
// dropdown anchored under the "⋯"; on mobile (≤640px) it's a bottom sheet. Both
// show the same structured icon + label list, with real separators where the
// toolbar had dividers.
//
// Widths are measured from the real rendered items (no hidden double-render) and
// cached by index; on resize we recompute how many fit. The inline row never
// overflows — items that don't fit move into the menu — so tooltips/dropdowns
// that rely on `overflow: visible` keep working.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
}

// Below this measured width an item is treated as a divider (toolbar dividers
// are ~1px wide + margins ≈ 13px; the smallest real control is ~28px).
const DIVIDER_MAX_W = 18;
const MOBILE_MAX_W = 640;
const Z = 2147483000; // above any editor overlay

const moreButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, flex: '0 0 auto', border: 'none', borderRadius: 8,
  background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 18,
  lineHeight: 1, fontFamily: 'inherit',
};

const panelBase: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 1,
  background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit',
  overflowY: 'auto', overflowX: 'hidden',
};

// Flatten fragments so a grouped `<>…</>` of controls becomes individual items
// (each measurable, each its own labelled row) instead of one opaque cluster.
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
    '.sp-rt-more:hover{background:rgba(99,102,241,0.08);color:#6366f1}' +
    '@keyframes sp-rt-pop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}' +
    '@keyframes sp-rt-sheet{from{transform:translateY(100%)}to{transform:translateY(0)}}' +
    '@keyframes sp-rt-fade{from{opacity:0}to{opacity:1}}';
  document.head.appendChild(s);
}

export function ResponsiveToolbar({
  children, gap = 2, moreIcon, moreLabel = 'More tools', style, className,
}: ResponsiveToolbarProps): React.ReactElement {
  const items = flattenChildren(children);
  const n = items.length;

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const moreRef = useRef<HTMLButtonElement>(null);
  const widths = useRef<number[]>([]);
  const moreW = useRef(40);

  const [visible, setVisible] = useState(n);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  useEffect(ensureStyles, []);

  // Track the mobile breakpoint.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_W}px)`);
    const on = () => setIsMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

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

  // Keep the desktop dropdown anchored to the "⋯" button (follows scroll/resize).
  useLayoutEffect(() => {
    if (!open || isMobile) return;
    const update = () => {
      const b = moreRef.current;
      if (!b) return;
      const r = b.getBoundingClientRect();
      setAnchor({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [open, isMobile]);

  // Close on Escape.
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
    let lastDivider = true;
    for (let i = visible; i < n; i++) {
      const item = items[i];
      const w = widths.current[i];
      // Skip controls that render nothing (e.g. a contextual format bar that's
      // inactive) — they measured to 0 width and would leave blank rows.
      if (w === 0) continue;
      if (w != null && w > 0 && w < DIVIDER_MAX_W) {
        if (!lastDivider) { rows.push(<div key={`d${i}`} style={{ height: 1, margin: '4px 10px', background: 'rgba(15,23,42,0.08)', flex: '0 0 auto' }} />); lastDivider = true; }
        continue;
      }
      const label = getLabel(item);
      rows.push(
        <div
          key={`i${i}`}
          role="menuitem"
          className={label ? 'sp-rt-menuitem' : undefined}
          onClick={label ? () => setOpen(false) : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 34, padding: '2px 12px 2px 6px', borderRadius: 8, cursor: label ? 'pointer' : 'default' }}
        >
          {/* Labelled single controls: icon then label. Unlabelled clusters
              (e.g. a whole format bar): let the controls wrap to fill the row. */}
          <span style={label
            ? { display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' }
            : { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, flex: '1 1 auto', minWidth: 0 }}>{item}</span>
          {label && <span style={{ fontSize: 14, color: '#334155', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{label}</span>}
        </div>
      );
      lastDivider = false;
    }
    while (rows.length && (rows[rows.length - 1] as React.ReactElement).key?.toString().startsWith('d')) rows.pop();
  }

  const backdrop = (dim: boolean): React.CSSProperties => ({
    position: 'fixed', inset: 0, zIndex: Z,
    background: dim ? 'rgba(15,23,42,0.35)' : 'transparent',
    animation: dim ? 'sp-rt-fade .15s ease' : undefined,
  });

  const dropdown = anchor && (
    <>
      <div onClick={() => setOpen(false)} style={backdrop(false)} />
      <div
        role="menu"
        style={{
          ...panelBase, position: 'fixed', top: anchor.top, right: anchor.right, zIndex: Z + 1,
          minWidth: 216, maxWidth: 340, maxHeight: '70vh', padding: 6, borderRadius: 12,
          border: '1px solid rgba(15,23,42,0.08)',
          boxShadow: '0 16px 40px -12px rgba(0,0,0,0.38), 0 2px 8px rgba(0,0,0,0.08)',
          animation: 'sp-rt-pop .12s ease',
        }}
      >
        {rows}
      </div>
    </>
  );

  const sheet = (
    <>
      <div onClick={() => setOpen(false)} style={backdrop(true)} />
      <div
        role="menu"
        style={{
          ...panelBase, position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: Z + 1,
          maxHeight: '78vh', padding: '6px 8px calc(16px + env(safe-area-inset-bottom))',
          borderTopLeftRadius: 18, borderTopRightRadius: 18,
          boxShadow: '0 -12px 40px -8px rgba(0,0,0,0.35)',
          animation: 'sp-rt-sheet .22s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 6px 8px', position: 'sticky', top: 0, background: '#fff' }}>
          <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', width: 36, height: 4, borderRadius: 2, background: 'rgba(15,23,42,0.18)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', letterSpacing: 0.2 }}>{moreLabel}</span>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#64748b', fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 4 }}>×</button>
        </div>
        {rows}
      </div>
    </>
  );

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
        <div style={{ marginLeft: 'auto', flex: '0 0 auto', display: 'inline-flex' }}>
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
        </div>
      )}

      {open && overflow && typeof document !== 'undefined' && createPortal(isMobile ? sheet : dropdown, document.body)}
    </div>
  );
}
