import { TableSelectionStore, selectionRect, cellsInSelection, inSelection } from './table-selection-store';
import type { TableSelection } from './table-selection-store';

const sel = (anchor: [number, number], focus: [number, number]): TableSelection => ({ tableId: 't', anchor, focus });

describe('table selection geometry', () => {
  it('normalises anchor/focus regardless of drag direction', () => {
    expect(selectionRect(sel([2, 3], [0, 1]))).toEqual({ r0: 0, c0: 1, r1: 2, c1: 3 });
  });

  it('enumerates every cell in the rectangle, row-major', () => {
    expect(cellsInSelection(sel([0, 0], [1, 1]))).toEqual([[0, 0], [0, 1], [1, 0], [1, 1]]);
  });

  it('tests cell membership', () => {
    const s = sel([1, 1], [1, 2]);
    expect(inSelection(s, 1, 1)).toBe(true);
    expect(inSelection(s, 1, 2)).toBe(true);
    expect(inSelection(s, 0, 1)).toBe(false);
    expect(inSelection(s, 1, 0)).toBe(false);
  });
});

describe('TableSelectionStore', () => {
  it('sets, extends focus, and clears with notifications', () => {
    const store = new TableSelectionStore();
    let ticks = 0;
    store.subscribe(() => ticks++);

    store.set('t', [0, 0]);
    expect(store.getState()).toEqual({ tableId: 't', anchor: [0, 0], focus: [0, 0] });

    store.setFocus([2, 1]);
    expect(store.getState()?.focus).toEqual([2, 1]);

    store.setFocus([2, 1]); // no change → no extra tick
    store.clear();
    expect(store.getState()).toBeNull();
    expect(ticks).toBe(3); // set, setFocus, clear
  });

  it('setFocus is a no-op when idle', () => {
    const store = new TableSelectionStore();
    store.setFocus([1, 1]);
    expect(store.getState()).toBeNull();
  });
});
