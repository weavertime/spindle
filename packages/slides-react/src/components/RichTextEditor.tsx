// RichTextEditor — the single live ProseMirror mount. It swaps in over the
// actively-edited element with identical box metrics (no visual jump vs
// StaticRichText).
//
// Non-collab: builds state from the element's JSON, keeps a local
// prosemirror-history for the session, and commits on blur/Escape as one engine
// history entry.
//
// Collab: binds directly to the element's Y.XmlFragment via y-prosemirror
// (ySyncPlugin) — the fragment is the source of truth, so there's no commit;
// the binding's observer keeps the engine record in sync. yUndoPlugin routes
// undo through the shared Y.UndoManager. Per-element fragments mean yCursorPlugin
// is skipped (it assumes one fragment per doc); remote presence is shown via
// awareness + RemotePresenceOverlay instead.
//
// Never unmounts mid-IME (composing guard on blur).

import React, { useEffect, useRef } from 'react';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { ySyncPlugin, yUndoPlugin, undo as yUndo, redo as yRedo } from 'y-prosemirror';
import { slidesSchema, resolveColor, resolveFont, type ThemeData, type BodyStyle, type RichTextDoc } from '@weavertime/spindle-slides-core';
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
    if (!mount || !el || !('richText' in el)) return;

    const bold = slidesSchema.marks.bold;
    const italic = slidesSchema.marks.italic;
    const underline = slidesSchema.marks.underline;

    const handle = deck.getCollabHandle();
    const fragment = handle?.getElementFragment(elementId);
    const collab = !!(handle && fragment);

    let view: EditorView;

    const commit = () => {
      if (!collab) deck.setElementRichText(elementId, view.state.doc.toJSON() as RichTextDoc);
    };
    const exit = () => {
      commit();
      editing.setEditingId(null);
    };

    const markKeys = {
      'Mod-b': toggleMark(bold),
      'Mod-i': toggleMark(italic),
      'Mod-u': toggleMark(underline),
      Escape: () => {
        exit();
        return true;
      },
    };

    if (collab) {
      const state = EditorState.create({
        schema: slidesSchema,
        plugins: [
          ySyncPlugin(fragment!),
          yUndoPlugin({ undoManager: handle!.undoManager }),
          keymap({ ...markKeys, 'Mod-z': yUndo, 'Mod-y': yRedo, 'Shift-Mod-z': yRedo }),
          keymap(baseKeymap),
        ],
      });
      view = new EditorView(mount, { state });
      handle!.awareness.setLocalStateField('editing', { slideId: el.containerId, elementId });
    } else {
      const state = EditorState.create({
        doc: slidesSchema.nodeFromJSON((el as { richText: RichTextDoc }).richText),
        plugins: [
          history(),
          keymap({ ...markKeys, 'Mod-z': undo, 'Mod-y': redo, 'Shift-Mod-z': redo }),
          keymap(baseKeymap),
        ],
      });
      view = new EditorView(mount, { state });
      view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
    }

    editing.setView(view);

    // Focus on the next frame, after the pointer sequence that opened the
    // editor (the double-click's mouseup would otherwise blur the freshly
    // focused contenteditable and immediately exit). Ignore any blur that
    // fires before we've actually taken focus.
    let focused = false;
    const raf = requestAnimationFrame(() => {
      focused = true;
      view.focus();
    });

    const onBlur = () => {
      if (view.composing || !focused) return; // never commit mid-IME or pre-focus
      // Commit on blur, but DON'T leave edit mode here — a transient blur during
      // a re-render must not close the editor. Exit is driven explicitly by
      // Escape or a pointerdown outside the editor (see InteractiveSlide).
      commit();
    };
    view.dom.addEventListener('blur', onBlur);

    return () => {
      cancelAnimationFrame(raf);
      view.dom.removeEventListener('blur', onBlur);
      if (collab) {
        handle!.awareness.setLocalStateField('editing', null);
      } else if (editing.getView() === view) {
        // Commit any uncommitted edits (e.g. slide switch) before tearing down.
        deck.setElementRichText(elementId, view.state.doc.toJSON() as RichTextDoc);
      }
      if (editing.getView() === view) editing.setView(null);
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
        fontFamily: resolveFont(bodyStyle?.fontFamily, theme),
        fontSize: bodyStyle?.fontSize ?? 18,
        fontWeight: bodyStyle?.bold ? 700 : 400,
        color: bodyStyle?.color ? resolveColor(bodyStyle.color, theme) : resolveColor({ kind: 'theme', slot: 'dk1' }, theme),
        textAlign: centered ? 'center' : 'left',
        cursor: 'text',
      }}
    />
  );
}
