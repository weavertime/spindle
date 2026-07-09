// Tracks which element currently hosts the single live ProseMirror editor (and,
// for a table, which [row, col] cell), plus a handle to its EditorView so the
// toolbar can dispatch formatting transactions into it. Exactly one element
// edits at a time (tldraw's pattern).

import type { EditorView } from 'prosemirror-view';

export interface EditingState {
  id: string | null;
  cell: readonly [number, number] | null;
}

const IDLE: EditingState = { id: null, cell: null };

export class EditingStore {
  private state: EditingState = IDLE;
  private view: EditorView | null = null;
  private listeners = new Set<() => void>();

  getEditingId = (): string | null => this.state.id;
  getCell = (): readonly [number, number] | null => this.state.cell;
  /** Stable snapshot for useSyncExternalStore. */
  getState = (): EditingState => this.state;

  setEditingId(id: string | null, cell: readonly [number, number] | null = null): void {
    const next = id ? cell : null;
    if (this.state.id === id && sameCell(this.state.cell, next)) return;
    this.state = id ? { id, cell: next } : IDLE;
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

function sameCell(a: readonly [number, number] | null, b: readonly [number, number] | null): boolean {
  if (a === b) return true;
  return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}
