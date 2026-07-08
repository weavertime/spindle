// Toolbar — insert elements, edit, arrange, and align. Enabled state follows
// the current selection. Insertions drop near the slide centre and select the
// new element.

import React, { useRef } from 'react';
import {
  Type, Minus, MoveUpRight, Image as ImageIcon,
  Trash2, Copy, Undo2, Redo2, Group, Ungroup,
  BringToFront, SendToBack, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  AlignStartVertical, AlignEndVertical, AlignStartHorizontal, AlignEndHorizontal,
} from 'lucide-react';
import type { NewElementSpec, AlignMode } from '@weavertime/spindle-slides-core';
import { useDeck, useSelection } from '../hooks';
import { DeckControls } from './DeckControls';
import { TextFormatBar } from './TextFormatBar';
import { ShapePicker } from './ShapePicker';

const btn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  border: '1px solid #d5d9e0',
  borderRadius: 5,
  background: '#fff',
  color: '#3e4c59',
  cursor: 'pointer',
};
const sep: React.CSSProperties = { width: 1, height: 22, background: '#e2e4e8', margin: '0 4px' };

function IconButton({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }): React.ReactElement {
  return (
    <button title={title} onClick={onClick} disabled={disabled} style={{ ...btn, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer' }}>
      {children}
    </button>
  );
}

export function Toolbar(): React.ReactElement {
  const deck = useDeck();
  const selection = useSelection();
  const fileRef = useRef<HTMLInputElement>(null);
  const ids = selection.elementIds;
  const hasSel = ids.length > 0;
  const hasMulti = ids.length > 1;
  const { w, h } = deck.getSlideSize();

  const insert = (spec: NewElementSpec, size: { w: number; h: number }) => {
    const slideId = deck.getActiveSlideId();
    const el = deck.addElement(slideId, { ...spec, x: (w - size.w) / 2, y: (h - size.h) / 2 } as NewElementSpec);
    deck.setSelection({ slideId, elementIds: [el.id] });
  };

  const onImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxW = w * 0.6;
        const scale = Math.min(1, maxW / img.naturalWidth);
        insert(
          { type: 'image', src, naturalW: img.naturalWidth, naturalH: img.naturalHeight } as NewElementSpec,
          { w: img.naturalWidth * scale, h: img.naturalHeight * scale }
        );
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const align = (mode: AlignMode) => {
    if (ids.length >= 2) deck.alignElements(ids, mode);
    else if (ids.length === 1) deck.alignElements(ids, mode, { x: 0, y: 0, w, h });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', borderBottom: '1px solid #e2e4e8', background: '#fff', flexWrap: 'nowrap', overflowX: 'auto', minHeight: 46, boxSizing: 'border-box' }}>
      <DeckControls />
      <span style={sep} />

      <IconButton title="Text box" onClick={() => insert({ type: 'text' } as NewElementSpec, { w: 400, h: 100 })}>
        <Type size={16} />
      </IconButton>
      <ShapePicker />
      <IconButton title="Line" onClick={() => insert({ type: 'line' } as NewElementSpec, { w: 300, h: 0 })}>
        <Minus size={16} />
      </IconButton>
      <IconButton title="Arrow" onClick={() => insert({ type: 'line', endArrow: 'triangle' } as NewElementSpec, { w: 300, h: 0 })}>
        <MoveUpRight size={16} />
      </IconButton>
      <IconButton title="Image" onClick={() => fileRef.current?.click()}>
        <ImageIcon size={16} />
      </IconButton>
      <input ref={fileRef} type="file" accept="image/*" onChange={onImageFile} style={{ display: 'none' }} />
      <span style={sep} />

      <IconButton title="Duplicate (⌘D)" disabled={!hasSel} onClick={() => { const c = ids.map((id) => deck.duplicateElement(id)).filter(Boolean); if (c.length) deck.setSelection({ slideId: deck.getActiveSlideId(), elementIds: c.map((x) => x!.id) }); }}>
        <Copy size={16} />
      </IconButton>
      <IconButton title="Delete (⌦)" disabled={!hasSel} onClick={() => { deck.deleteElements(ids); deck.setSelection({ slideId: deck.getActiveSlideId(), elementIds: [] }); }}>
        <Trash2 size={16} />
      </IconButton>
      <span style={sep} />

      <IconButton title="Bring to front (⌘⇧])" disabled={!hasSel} onClick={() => deck.bringToFront(ids)}>
        <BringToFront size={16} />
      </IconButton>
      <IconButton title="Send to back (⌘⇧[)" disabled={!hasSel} onClick={() => deck.sendToBack(ids)}>
        <SendToBack size={16} />
      </IconButton>
      <IconButton title="Group (⌘G)" disabled={!hasMulti} onClick={() => deck.groupElements(ids)}>
        <Group size={16} />
      </IconButton>
      <IconButton title="Ungroup (⌘⇧G)" disabled={!hasSel} onClick={() => deck.ungroupElements(ids)}>
        <Ungroup size={16} />
      </IconButton>
      <span style={sep} />

      <IconButton title="Align left" disabled={!hasSel} onClick={() => align('left')}>
        <AlignStartVertical size={16} />
      </IconButton>
      <IconButton title="Align centre" disabled={!hasSel} onClick={() => align('centerH')}>
        <AlignHorizontalJustifyCenter size={16} />
      </IconButton>
      <IconButton title="Align right" disabled={!hasSel} onClick={() => align('right')}>
        <AlignEndVertical size={16} />
      </IconButton>
      <IconButton title="Align top" disabled={!hasSel} onClick={() => align('top')}>
        <AlignStartHorizontal size={16} />
      </IconButton>
      <IconButton title="Align middle" disabled={!hasSel} onClick={() => align('centerV')}>
        <AlignVerticalJustifyCenter size={16} />
      </IconButton>
      <IconButton title="Align bottom" disabled={!hasSel} onClick={() => align('bottom')}>
        <AlignEndHorizontal size={16} />
      </IconButton>
      <span style={sep} />

      <IconButton title="Undo (⌘Z)" onClick={() => deck.undo()}>
        <Undo2 size={16} />
      </IconButton>
      <IconButton title="Redo (⌘⇧Z)" onClick={() => deck.redo()}>
        <Redo2 size={16} />
      </IconButton>

      {/* Text formatting appears inline (same row) when a text/shape is selected. */}
      <TextFormatBar />
    </div>
  );
}
