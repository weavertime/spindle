// RichTextEditor — the single live ProseMirror mount. It swaps in over the
// actively-edited element with identical box metrics (no visual jump vs
// StaticRichText). Non-collab: builds state from the element's JSON, keeps a
// local prosemirror-history for the session, and commits on blur/Escape as one
// engine history entry. Never unmounts mid-IME (composing guard on blur).

import React, { useEffect, useRef } from 'react';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { slidesSchema, type ThemeData, type BodyStyle, type RichTextDoc } from '@weavertime/spindle-slides-core';
import { useDeck } from '../hooks';
import { useDeckContext } from '../context/DeckContext';

const V_ALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const;

export function RichTextEditor({
  elementId,
  theme,
  bodyStyle,
  centered = false,
}: {
  elementId: string;
  theme: ThemeData;
  bodyStyle?: BodyStyle;
  centered?: boolean;
}): React.ReactElement {
  const deck = useDeck();
  const { editing } = useDeckContext();
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    const el = deck.getElement(elementId);
    if (!mount || !el || !('richText' in el) || !el.richText) return;

    const doc = slidesSchema.nodeFromJSON(el.richText as RichTextDoc);
    const bold = slidesSchema.marks.bold;
    const italic = slidesSchema.marks.italic;
    const underline = slidesSchema.marks.underline;

    let view: EditorView;

    const commit = () => {
      deck.setElementRichText(elementId, view.state.doc.toJSON() as RichTextDoc);
    };
    const exit = () => {
      commit();
      editing.setEditingId(null);
    };

    const state = EditorState.create({
      doc,
      plugins: [
        history(),
        keymap({
          'Mod-b': toggleMark(bold),
          'Mod-i': toggleMark(italic),
          'Mod-u': toggleMark(underline),
          'Mod-z': undo,
          'Mod-y': redo,
          'Shift-Mod-z': redo,
          Escape: () => {
            exit();
            return true;
          },
        }),
        keymap(baseKeymap),
      ],
    });

    view = new EditorView(mount, { state });
    editing.setView(view);

    // Focus and place the caret at the end of the body.
    view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
    view.focus();

    const onBlur = () => {
      if (view.composing) return; // never tear down mid-IME
      exit();
    };
    view.dom.addEventListener('blur', onBlur);

    return () => {
      view.dom.removeEventListener('blur', onBlur);
      // Commit any uncommitted edits (e.g. slide switch) before tearing down.
      if (editing.getView() === view) {
        deck.setElementRichText(elementId, view.state.doc.toJSON() as RichTextDoc);
        editing.setView(null);
      }
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementId]);

  return (
    <div
      className="spindle-pm-editor"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      ref={mountRef}
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: bodyStyle?.padding ?? 8,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: V_ALIGN[bodyStyle?.vAlign ?? 'top'],
        fontFamily: theme.fonts.minor,
        fontSize: 18,
        color: '#1f2933',
        textAlign: centered ? 'center' : 'left',
        cursor: 'text',
      }}
    />
  );
}
