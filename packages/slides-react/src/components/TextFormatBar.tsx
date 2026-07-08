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

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 54, 66, 80];

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, border: '1px solid #d5d9e0', borderRadius: 5,
  background: '#fff', color: '#3e4c59', cursor: 'pointer',
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
      <span style={{ width: 1, height: 22, background: '#e2e4e8', margin: '0 4px' }} />
      <button title="Bold (⌘B)" style={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => fmt({ toggleMark: 'bold' })}><Bold size={15} /></button>
      <button title="Italic (⌘I)" style={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => fmt({ toggleMark: 'italic' })}><Italic size={15} /></button>
      <button title="Underline (⌘U)" style={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => fmt({ toggleMark: 'underline' })}><Underline size={15} /></button>
      <button title="Strikethrough" style={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => fmt({ toggleMark: 'strikethrough' })}><Strikethrough size={15} /></button>

      <span style={{ width: 1, height: 20, background: '#e2e4e8', margin: '0 4px' }} />

      <select
        title="Font size"
        defaultValue={18}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => fmt({ setMark: { type: 'fontSize', attrs: { size: Number(e.target.value) } } })}
        style={{ height: 28, border: '1px solid #d5d9e0', borderRadius: 5, background: '#fff', color: '#3e4c59', padding: '0 4px' }}
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
        style={{ width: 28, height: 28, border: '1px solid #d5d9e0', borderRadius: 5, background: '#fff', padding: 2, cursor: 'pointer' }}
      />

      <span style={{ width: 1, height: 20, background: '#e2e4e8', margin: '0 4px' }} />

      {(['left', 'center', 'right'] as TextAlign[]).map((a) => (
        <button key={a} title={`Align ${a}`} style={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => fmt({ paragraph: { align: a } })}>
          {a === 'left' ? <AlignLeft size={15} /> : a === 'center' ? <AlignCenter size={15} /> : <AlignRight size={15} />}
        </button>
      ))}
      {(['bullet', 'number'] as ListType[]).map((l) => (
        <button key={l} title={`${l === 'bullet' ? 'Bulleted' : 'Numbered'} list`} style={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => fmt({ paragraph: { listType: l } })}>
          {l === 'bullet' ? <List size={15} /> : <ListOrdered size={15} />}
        </button>
      ))}
    </>
  );
}
