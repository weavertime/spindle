// Tracks a table's *cell* selection — a rectangle of cells inside one table,
// held as an (anchor, focus) pair so drag/shift-extend grows it naturally. This
// is local view state (like element selection), never synced through the CRDT.
// The bounding rectangle covers every case: a single cell (anchor === focus), a
// dragged range, a whole row (anchor col 0 → focus last col), a whole column,
// or the entire grid.

export interface TableSelection {
  tableId: string;
  anchor: readonly [number, number];
  focus: readonly [number, number];
}

export interface CellRect {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

/** Normalised min/max bounds of a selection's anchor+focus. */
export function selectionRect(sel: TableSelection): CellRect {
  const [ar, ac] = sel.anchor;
  const [fr, fc] = sel.focus;
  return { r0: Math.min(ar, fr), c0: Math.min(ac, fc), r1: Math.max(ar, fr), c1: Math.max(ac, fc) };
}

/** Every [row, col] inside the selection rectangle, row-major. */
export function cellsInSelection(sel: TableSelection): Array<[number, number]> {
  const { r0, c0, r1, c1 } = selectionRect(sel);
  const out: Array<[number, number]> = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push([r, c]);
  return out;
}

/** Is a specific cell within the selection rectangle? */
export function inSelection(sel: TableSelection, row: number, col: number): boolean {
  const { r0, c0, r1, c1 } = selectionRect(sel);
  return row >= r0 && row <= r1 && col >= c0 && col <= c1;
}

export class TableSelectionStore {
  private state: TableSelection | null = null;
  private listeners = new Set<() => void>();

  /** Stable snapshot for useSyncExternalStore. */
  getState = (): TableSelection | null => this.state;

  /** Start a selection at `anchor`; `focus` defaults to the same cell. */
  set(tableId: string, anchor: readonly [number, number], focus: readonly [number, number] = anchor): void {
    this.state = { tableId, anchor, focus };
    this.emit();
  }

  /** Extend the current selection's focus (drag / shift-click). No-op if idle. */
  setFocus(focus: readonly [number, number]): void {
    if (!this.state) return;
    if (this.state.focus[0] === focus[0] && this.state.focus[1] === focus[1]) return;
    this.state = { ...this.state, focus };
    this.emit();
  }

  clear(): void {
    if (!this.state) return;
    this.state = null;
    this.emit();
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
