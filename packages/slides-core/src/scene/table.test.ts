import { evenFractions, makeGrid, insertRow, insertColumn, removeRow, removeColumn, resizeColumn, setRowHeight } from './table';
import type { TableElement } from './types';

function table(rows: number, cols: number): TableElement {
  return {
    id: 't', containerId: 's', index: 'a', type: 'table',
    x: 0, y: 0, w: 600, h: 300, rotation: 0,
    rows, cols,
    colFractions: evenFractions(cols),
    rowFractions: evenFractions(rows),
    cells: makeGrid(rows, cols),
  };
}
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe('table grid basics', () => {
  it('even fractions sum to 1', () => {
    expect(sum(evenFractions(4))).toBeCloseTo(1);
    expect(evenFractions(4)).toEqual([0.25, 0.25, 0.25, 0.25]);
  });
  it('makeGrid is rows×cols of empty cells', () => {
    const g = makeGrid(2, 3);
    expect(g).toHaveLength(2);
    expect(g[0]).toHaveLength(3);
    expect(g[0][0].richText.type).toBe('doc');
  });
});

describe('insert / remove rows & columns', () => {
  it('insertRow grows the grid and keeps fractions normalized', () => {
    const p = insertRow(table(2, 3), 1);
    expect(p.rows).toBe(3);
    expect(p.cells).toHaveLength(3);
    expect(p.cells![0]).toHaveLength(3);
    expect(sum(p.rowFractions!)).toBeCloseTo(1);
  });
  it('insertColumn adds a cell to every row', () => {
    const p = insertColumn(table(2, 3), 0);
    expect(p.cols).toBe(4);
    expect(p.cells!.every((r) => r.length === 4)).toBe(true);
    expect(sum(p.colFractions!)).toBeCloseTo(1);
  });
  it('removeRow shrinks and renormalizes', () => {
    const p = removeRow(table(3, 2), 0);
    expect(p.rows).toBe(2);
    expect(p.cells).toHaveLength(2);
    expect(sum(p.rowFractions!)).toBeCloseTo(1);
  });
  it('removeColumn shrinks and renormalizes', () => {
    const p = removeColumn(table(2, 3), 2);
    expect(p.cols).toBe(2);
    expect(p.cells!.every((r) => r.length === 2)).toBe(true);
    expect(sum(p.colFractions!)).toBeCloseTo(1);
  });
  it('refuses to remove the last row/column', () => {
    expect(removeRow(table(1, 3), 0)).toEqual({});
    expect(removeColumn(table(3, 1), 0)).toEqual({});
  });
});

describe('resizeColumn', () => {
  it('shifts width between adjacent columns, total preserved', () => {
    const p = resizeColumn(table(1, 3), 0, 0.1);
    expect(p.colFractions![0]).toBeCloseTo(1 / 3 + 0.1);
    expect(p.colFractions![1]).toBeCloseTo(1 / 3 - 0.1);
    expect(sum(p.colFractions!)).toBeCloseTo(1);
  });
  it('clamps so neither side collapses below the minimum', () => {
    const p = resizeColumn(table(1, 2), 0, 0.9); // would drive col 1 negative
    expect(p.colFractions![0]).toBeLessThan(1);
    expect(p.colFractions![1]).toBeGreaterThan(0);
    expect(sum(p.colFractions!)).toBeCloseTo(1);
  });
  it('no-op on the last boundary', () => {
    expect(resizeColumn(table(1, 3), 2, 0.1)).toEqual({});
  });
});

describe('setRowHeight (manual row minimum)', () => {
  it('sets a per-row minimum, initializing the array to the row count', () => {
    const p = setRowHeight(table(3, 2), 1, 80);
    expect(p.rowHeights).toEqual([0, 80, 0]);
  });
  it('clamps negatives to 0 (auto) and rounds', () => {
    expect(setRowHeight(table(2, 2), 0, -5).rowHeights).toEqual([0, 0]);
    expect(setRowHeight(table(2, 2), 0, 42.6).rowHeights).toEqual([43, 0]);
  });
  it('ignores an out-of-range index', () => {
    expect(setRowHeight(table(2, 2), 5, 80)).toEqual({});
  });
  it('keeps rowHeights aligned when rows are inserted/removed', () => {
    const t = { ...table(3, 2), rowHeights: [0, 80, 0] } as TableElement;
    expect(insertRow(t, 1).rowHeights).toEqual([0, 0, 80, 0]); // new row auto
    expect(removeRow(t, 1).rowHeights).toEqual([0, 0]); // dropped the 80
  });
});
