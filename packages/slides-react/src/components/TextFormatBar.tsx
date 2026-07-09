// TextFormatBar — inline text-formatting controls, rendered *inside* the main
// Toolbar row (not as a separate bar) so selecting a text element doesn't shift
// the layout. Routes each action through applyFormat, which targets the live
// editor (range formatting) when one is open, or the selected element's stored
// JSON (idle, whole-body) otherwise. Renders nothing unless a single text/shape
// element is selected or being edited.

import React from 'react';
import { Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, List, ListOrdered } from 'lucide-react';
import type { TextFormatSpec, TextAlign, ListType } from '@weavertime/spindle-slides-core';
import { useDeck, useSelection, useEditingId } from '../hooks';
import { useDeckContext } from '../context/DeckContext';
import { applyFormat } from '../interactions/formatting';
import { ToolbarButton, ToolbarDivider } from './toolbarUI';

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 54, 66, 80];

const field: React.CSSProperties = {
  height: 30, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8,
  background: 'rgba(255,255,255,0.8)', color: '#334155', padding: '0 6px',
  fontSize: 13, fontFamily: '"Inter", sans-serif', cursor: 'pointer',
};

/** The single text/shape element eligible for idle formatting, if any. */
function idleTextTarget(deck: ReturnType<typeof useDeck>, ids: string[]): string | null {
  if (ids.length !== 1) return null;
  const el = deck.getElement(ids[0]);
  return el && (el.type === 'text' || el.type === 'shape') ? ids[0] : null;
}

export function TextFormatBar(): React.ReactElement | null {
  const deck = useDeck();
  const { editing } = useDeckContext();
  const selection = useSelection();
  const editingId = useEditingId();

  const elementId = editingId ?? idleTextTarget(deck, selection.elementIds);
  if (!elementId) return null;

  const fmt = (spec: TextFormatSpec) => {
    applyFormat({ editingView: editing.getView(), deck, elementId }, spec);
  };

  return (
    <>
      <ToolbarDivider />
      <ToolbarButton title="Bold (⌘B)" onClick={() => fmt({ toggleMark: 'bold' })}><Bold size={15} /></ToolbarButton>
      <ToolbarButton title="Italic (⌘I)" onClick={() => fmt({ toggleMark: 'italic' })}><Italic size={15} /></ToolbarButton>
      <ToolbarButton title="Underline (⌘U)" onClick={() => fmt({ toggleMark: 'underline' })}><Underline size={15} /></ToolbarButton>
      <ToolbarButton title="Strikethrough" onClick={() => fmt({ toggleMark: 'strikethrough' })}><Strikethrough size={15} /></ToolbarButton>

      <ToolbarDivider />

      <select
        title="Font size"
        defaultValue={18}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => fmt({ setMark: { type: 'fontSize', attrs: { size: Number(e.target.value) } } })}
        style={field}
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <input
        type="color"
        title="Text color"
        onMouseDown={(e) => e.preventDefault()}
        onChange={(e) => fmt({ setMark: { type: 'textColor', attrs: { color: { kind: 'rgb', hex: e.target.value } } } })}
        style={{ ...field, width: 30, padding: 3, marginLeft: 2 }}
      />

      <ToolbarDivider />

      {(['left', 'center', 'right'] as TextAlign[]).map((a) => (
        <ToolbarButton key={a} title={`Align ${a}`} onClick={() => fmt({ paragraph: { align: a } })}>
          {a === 'left' ? <AlignLeft size={15} /> : a === 'center' ? <AlignCenter size={15} /> : <AlignRight size={15} />}
        </ToolbarButton>
      ))}
      {(['bullet', 'number'] as ListType[]).map((l) => (
        <ToolbarButton key={l} title={`${l === 'bullet' ? 'Bulleted' : 'Numbered'} list`} onClick={() => fmt({ paragraph: { listType: l } })}>
          {l === 'bullet' ? <List size={15} /> : <ListOrdered size={15} />}
        </ToolbarButton>
      ))}
    </>
  );
}
