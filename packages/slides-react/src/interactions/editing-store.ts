// Tracks which element currently hosts the single live ProseMirror editor, and
// a handle to its EditorView so the toolbar can dispatch formatting
// transactions into it. Exactly one element edits at a time (tldraw's pattern).

import type { EditorView } from 'prosemirror-view';

export class EditingStore {
  private editingId: string | null = null;
  private view: EditorView | null = null;
  private listeners = new Set<() => void>();

  getEditingId = (): string | null => this.editingId;

  setEditingId(id: string | null): void {
    if (this.editingId === id) return;
    this.editingId = id;
    if (id === null) this.view = null;
    for (const l of this.listeners) l();
  }

  setView(view: EditorView | null): void {
    this.view = view;
  }

  getView(): EditorView | null {
    return this.view;
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
}
