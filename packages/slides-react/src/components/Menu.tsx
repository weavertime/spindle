// Menu — a generic positioned popup (context menus). Renders a list of items at
// a fixed (x, y); closes on outside pointerdown, blur, or Escape. Callers supply
// the items, so the same primitive backs both the element and slide menus.

import React, { useEffect } from 'react';

export interface MenuItem {
  label: string;
  run: () => void;
  disabled?: boolean;
}

export function Menu({ x, y, items, onClose, footer }: { x: number; y: number; items: Array<MenuItem | 'sep'>; onClose: () => void; footer?: React.ReactNode }): React.ReactElement {
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 2100,
        minWidth: 180,
        background: '#fff',
        border: '1px solid #d5d9e0',
        borderRadius: 6,
        boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
        padding: '4px 0',
        fontSize: 13,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) =>
        it === 'sep' ? (
          <div key={i} style={{ height: 1, background: '#eceef1', margin: '4px 0' }} />
        ) : (
          <div
            key={i}
            onPointerDown={(e) => { e.stopPropagation(); if (!it.disabled) { it.run(); onClose(); } }}
            style={{
              padding: '6px 14px',
              color: it.disabled ? '#b3bac4' : '#2b3440',
              cursor: it.disabled ? 'default' : 'pointer',
            }}
            onMouseEnter={(e) => { if (!it.disabled) (e.currentTarget as HTMLElement).style.background = '#f1f4f8'; }}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            {it.label}
          </div>
        )
      )}
      {footer !== undefined && (
        <div onPointerDown={(e) => e.stopPropagation()}>
          <div style={{ height: 1, background: '#eceef1', margin: '4px 0' }} />
          {footer}
        </div>
      )}
    </div>
  );
}
