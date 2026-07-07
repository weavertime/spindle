// ContextMenu — a right-click menu over the stage. Controlled by SlidesEditor
// (position + open state); actions operate on the current selection.

import React, { useEffect } from 'react';
import { useDeck, useSelection, useClipboard } from '../hooks';

export interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

interface Item {
  label: string;
  run: () => void;
  disabled?: boolean;
}

export function ContextMenu({ x, y, onClose }: ContextMenuProps): React.ReactElement {
  const deck = useDeck();
  const selection = useSelection();
  const clipboard = useClipboard();
  const ids = selection.elementIds;
  const hasSel = ids.length > 0;

  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
    };
  }, [onClose]);

  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const items: Array<Item | 'sep'> = [
    { label: 'Cut', run: act(() => clipboard.cut()), disabled: !hasSel },
    { label: 'Copy', run: act(() => clipboard.copy()), disabled: !hasSel },
    { label: 'Paste', run: act(() => clipboard.paste()), disabled: !clipboard.hasContent() },
    { label: 'Duplicate', run: act(() => { const c = ids.map((id) => deck.duplicateElement(id)).filter(Boolean); if (c.length) deck.setSelection({ slideId: deck.getActiveSlideId(), elementIds: c.map((x) => x!.id) }); }), disabled: !hasSel },
    'sep',
    { label: 'Bring to front', run: act(() => deck.bringToFront(ids)), disabled: !hasSel },
    { label: 'Bring forward', run: act(() => deck.bringForward(ids)), disabled: !hasSel },
    { label: 'Send backward', run: act(() => deck.sendBackward(ids)), disabled: !hasSel },
    { label: 'Send to back', run: act(() => deck.sendToBack(ids)), disabled: !hasSel },
    'sep',
    { label: 'Group', run: act(() => deck.groupElements(ids)), disabled: ids.length < 2 },
    { label: 'Ungroup', run: act(() => deck.ungroupElements(ids)), disabled: !hasSel },
    'sep',
    { label: 'Delete', run: act(() => { deck.deleteElements(ids); deck.setSelection({ slideId: deck.getActiveSlideId(), elementIds: [] }); }), disabled: !hasSel },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
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
            onPointerDown={(e) => { e.stopPropagation(); if (!it.disabled) it.run(); }}
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
    </div>
  );
}
