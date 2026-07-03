/**
 * HiddenEditor - A hidden ProseMirror editor that receives keyboard input
 * 
 * This component creates a single ProseMirror instance that is positioned off-screen
 * but remains focusable. It receives all keyboard and composition input, while the
 * visual rendering is handled separately by the layout engine.
 * 
 * Key design decisions:
 * - Uses `opacity: 0` NOT `visibility: hidden` to keep it focusable
 * - Uses `position: fixed; left: -9999px` to move off-screen
 * - Does NOT set `aria-hidden` because it provides semantic structure for accessibility
 * - Sets `pointer-events: none` to prevent accidental interaction
 */

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { EditorState, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Node as PmNode } from 'prosemirror-model';
import { docsSchema, createPlugins } from '@weavertime/spindle-docs-core';

export interface HiddenEditorHandle {
  /** Get the ProseMirror EditorView */
  getView: () => EditorView | null;
  /** Get the current EditorState */
  getState: () => EditorState | null;
  /** Focus the hidden editor */
  focus: () => void;
  /** Check if the editor has focus */
  hasFocus: () => boolean;
  /** Get the DOM element containing the editor */
  getEditorElement: () => HTMLElement | null;
  /** Update the document content */
  updateDoc: (doc: PmNode) => void;
}

export interface HiddenEditorProps {
  /** Initial ProseMirror document */
  initialDoc: PmNode;
  /** Width of the content area in pixels (for proper text wrapping) */
  contentWidth: number;
  /** Called when the document changes */
  onDocChange?: (doc: PmNode, state: EditorState) => void;
  /** Called when the selection changes */
  onSelectionChange?: (state: EditorState) => void;
  /** Called when the editor is ready */
  onReady?: (view: EditorView) => void;
  /** Whether the editor is editable */
  editable?: boolean;
  /** Whether to hide the editor (default: true for backward compatibility) */
  hidden?: boolean;
}

/**
 * Creates styles for the editor host element.
 * 
 * When hidden=true, the editor is positioned off-screen but remains focusable.
 * When hidden=false, the editor is visible and interactive.
 */
function createEditorHostStyles(contentWidth: number, hidden: boolean): React.CSSProperties {
  if (hidden) {
    return {
      position: 'fixed',
      left: -9999,
      top: 0,
      width: contentWidth,
      // DO NOT use visibility:hidden - it prevents focusing!
      // Instead use opacity:0 and z-index to hide while keeping focusable
      opacity: 0,
      zIndex: -1,
      userSelect: 'none',
      pointerEvents: 'none',
      // Prevent scroll anchoring issues when content changes
      overflowAnchor: 'none',
    };
  }
  
  // Visible mode - editor is displayed and interactive
  // Use overflow: visible to allow content to flow beyond the container
  // The parent PageRenderer's overflow:hidden will clip the content
  return {
    width: contentWidth,
    outline: 'none',
    // Don't constrain height - let content flow naturally
    // The PageRenderer will handle clipping
  };
}

export const HiddenEditor = forwardRef<HiddenEditorHandle, HiddenEditorProps>(
  function HiddenEditor(
    { initialDoc, contentWidth, onDocChange, onSelectionChange, onReady, editable = true, hidden = true },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const stateRef = useRef<EditorState | null>(null);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getView: () => viewRef.current,
      getState: () => stateRef.current,
      focus: () => {
        if (viewRef.current) {
          viewRef.current.focus();
        }
      },
      hasFocus: () => {
        if (viewRef.current) {
          return viewRef.current.hasFocus();
        }
        return false;
      },
      getEditorElement: () => {
        return viewRef.current?.dom as HTMLElement | null;
      },
      updateDoc: (doc: PmNode) => {
        if (viewRef.current) {
          const newState = EditorState.create({
            doc,
            plugins: viewRef.current.state.plugins,
          });
          viewRef.current.updateState(newState);
          stateRef.current = newState;
        }
      },
    }), []);

    // Initialize ProseMirror
    useEffect(() => {
      if (!containerRef.current) return;

      const state = EditorState.create({
        doc: initialDoc,
        plugins: createPlugins(docsSchema),
      });

      const view = new EditorView(containerRef.current, {
        state,
        editable: () => editable,
        dispatchTransaction(transaction: Transaction) {
          const newState = view.state.apply(transaction);
          view.updateState(newState);
          stateRef.current = newState;

          if (transaction.docChanged) {
            onDocChange?.(newState.doc, newState);
          }

          if (transaction.selectionSet || transaction.docChanged) {
            onSelectionChange?.(newState);
          }
        },
        attributes: {
          class: 'hidden-prosemirror-editor',
          // DO NOT set aria-hidden="true" - this editor provides semantic structure
          role: 'textbox',
          'aria-multiline': 'true',
        },
        // Prevent automatic scroll-into-view when the editor is visible
        // We handle scrolling manually via the viewport
        scrollThreshold: hidden ? undefined : { top: 0, bottom: 0, left: 0, right: 0 },
        scrollMargin: hidden ? undefined : { top: 0, bottom: 0, left: 0, right: 0 },
      });

      viewRef.current = view;
      stateRef.current = state;
      onReady?.(view);

      return () => {
        view.destroy();
        viewRef.current = null;
        stateRef.current = null;
      };
    }, []); // Only run on mount

    // Update editable state
    useEffect(() => {
      if (viewRef.current) {
        // Force a state update to re-evaluate editable
        viewRef.current.setProps({ editable: () => editable });
      }
    }, [editable]);

    return (
      <div
        ref={containerRef}
        className={hidden ? "hidden-editor-host" : "visible-editor-host"}
        style={createEditorHostStyles(contentWidth, hidden)}
      />
    );
  }
);

