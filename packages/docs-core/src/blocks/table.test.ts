import {
  createTable,
  insertTableColumn,
  deleteTableColumn,
  mergeCells,
  getTableColCount,
} from './table';
import type { TableBlock } from '../types';

/**
 * Logical column width of every row, computed with an independent grid
 * placement so it can cross-check the production code. A table is "consistent"
 * when every row reports the same width (a rectangular logical grid).
 */
function rowLogicalWidths(table: TableBlock): number[] {
  const grid: boolean[][] = table.rows.map(() => []);
  for (let r = 0; r < table.rows.length; r++) {
    let col = 0;
    for (const cell of table.rows[r].cells) {
      while (grid[r][col]) col++;
      const cs = cell.colspan || 1;
      const rs = cell.rowspan || 1;
      for (let dr = 0; dr < rs && r + dr < table.rows.length; dr++) {
        for (let dc = 0; dc < cs; dc++) grid[r + dr][col + dc] = true;
      }
      col += cs;
    }
  }
  return grid.map((row) => row.length);
}

describe('insertTableColumn — colWidths stays aligned with columns', () => {
  it('clamps both the cell and the width insertion index for an out-of-range position', () => {
    const table = createTable(2, 3, { colWidths: [10, 20, 30] });
    // A negative position previously clamped the cell index to 0 but spliced
    // colWidths at a *different* (from-the-end) spot — misaligning widths.
    const result = insertTableColumn(table, -1, 99);

    // Every row gains exactly one column at the front.
    expect(getTableColCount(result)).toBe(4);
    result.rows.forEach((row) => expect(row.cells).toHaveLength(4));

    // The new width sits at index 0, aligned with the newly inserted column.
    expect(result.colWidths).toEqual([99, 10, 20, 30]);
  });

  it('inserts in the middle consistently', () => {
    const table = createTable(1, 3, { colWidths: [10, 20, 30] });
    const result = insertTableColumn(table, 1, 99);
    expect(result.colWidths).toEqual([10, 99, 20, 30]);
    expect(result.rows[0].cells).toHaveLength(4);
  });
});

describe('mergeCells — covered cells are removed, not left as phantoms', () => {
  it('drops the spanned neighbor cells and sets colspan/rowspan on the top-left', () => {
    const table = createTable(3, 3);
    const merged = mergeCells(table, 0, 0, 1, 1);

    // Top-left cell carries the span.
    expect(merged.rows[0].cells[0].colspan).toBe(2);
    expect(merged.rows[0].cells[0].rowspan).toBe(2);

    // Row 0: merged cell + the untouched third column = 2 cells (was 3).
    expect(merged.rows[0].cells).toHaveLength(2);
    // Row 1: both covered cells removed, only the third column remains.
    expect(merged.rows[1].cells).toHaveLength(1);
    // Row 2 is outside the merge range and unchanged.
    expect(merged.rows[2].cells).toHaveLength(3);
  });

  it('merges by logical column on an already-spanned table (physical ≠ logical index)', () => {
    // Start with a 2x2 merge at the top-left, so row 0 has 2 physical cells and
    // row 1 has 1 — physical indices no longer equal logical columns.
    const base = mergeCells(createTable(3, 3), 0, 0, 1, 1);
    // Merge logical column 2 down rows 0-1 (the right column, above the merge).
    const merged = mergeCells(base, 0, 2, 1, 2);

    // Grid stays a rectangular 3 logical columns on every row.
    expect(getTableColCount(merged)).toBe(3);
    expect(rowLogicalWidths(merged)).toEqual([3, 3, 3]);
    // The new span sits on logical column 2 of row 0 (physically the 2nd cell).
    expect(merged.rows[0].cells[1].rowspan).toBe(2);
    expect(merged.rows[0].cells[1].colspan).toBe(1);
  });

  it('expands a merge that partially overlaps an existing span to contain it', () => {
    // Existing 2x2 span at cols 0-1, rows 0-1. Request a merge of just logical
    // col 1, rows 0-1 — which bisects the span. It must expand to cover cols 0-1.
    const base = mergeCells(createTable(3, 3), 0, 0, 1, 1);
    const merged = mergeCells(base, 0, 1, 1, 1);

    expect(getTableColCount(merged)).toBe(3);
    expect(rowLogicalWidths(merged)).toEqual([3, 3, 3]);
    // Still the same 2x2 span (expanded back to the full existing span).
    expect(merged.rows[0].cells[0].colspan).toBe(2);
    expect(merged.rows[0].cells[0].rowspan).toBe(2);
    expect(merged.rows[0].cells).toHaveLength(2); // merged + untouched col 2
    expect(merged.rows[1].cells).toHaveLength(1);
  });
});

describe('logical columns stay consistent across a merge', () => {
  it('reports 3 logical columns after mergeCells(0,0,1,1) on a 3x3 table', () => {
    const merged = mergeCells(createTable(3, 3), 0, 0, 1, 1);
    // Physically row 0 has 2 cells and row 1 has 1, but the logical grid is 3 wide.
    expect(getTableColCount(merged)).toBe(3);
    expect(rowLogicalWidths(merged)).toEqual([3, 3, 3]);
  });

  it('appends a logical column without corrupting the merged grid', () => {
    const merged = mergeCells(createTable(3, 3), 0, 0, 1, 1);
    const grown = insertTableColumn(merged, 3);

    expect(getTableColCount(grown)).toBe(4);
    // Every row is still a rectangular 4-wide grid.
    expect(rowLogicalWidths(grown)).toEqual([4, 4, 4]);
    // The append does not widen the merged cell — it stays 2x2.
    expect(grown.rows[0].cells[0].colspan).toBe(2);
    expect(grown.rows[0].cells[0].rowspan).toBe(2);
    // A new physical cell landed in each row (row 1 was down to a single cell).
    expect(grown.rows[0].cells).toHaveLength(3);
    expect(grown.rows[1].cells).toHaveLength(2);
    expect(grown.rows[2].cells).toHaveLength(4);
  });

  it('inserts a logical column through the merged span by widening it', () => {
    const merged = mergeCells(createTable(3, 3), 0, 0, 1, 1);
    const grown = insertTableColumn(merged, 1); // boundary runs through the 2x2 span

    expect(getTableColCount(grown)).toBe(4);
    expect(rowLogicalWidths(grown)).toEqual([4, 4, 4]);
    // The spanning cell absorbed the new column (colspan 2 -> 3), once.
    expect(grown.rows[0].cells[0].colspan).toBe(3);
    expect(grown.rows[0].cells[0].rowspan).toBe(2);
    expect(grown.rows[0].cells).toHaveLength(2); // no extra cell in the merged rows
    expect(grown.rows[1].cells).toHaveLength(1);
    expect(grown.rows[2].cells).toHaveLength(4); // plain row gains a real cell
  });

  it('deletes a logical column by shrinking the span and dropping covered cells', () => {
    const merged = mergeCells(createTable(3, 3), 0, 0, 1, 1);
    const shrunk = deleteTableColumn(merged, 0);

    expect(getTableColCount(shrunk)).toBe(2);
    expect(rowLogicalWidths(shrunk)).toEqual([2, 2, 2]);
    // The merged cell shrank from colspan 2 to 1 (still rowspan 2).
    expect(shrunk.rows[0].cells[0].colspan).toBe(1);
    expect(shrunk.rows[0].cells[0].rowspan).toBe(2);
    expect(shrunk.rows[2].cells).toHaveLength(2); // plain row lost one cell
  });

  it('keeps plain tables consistent through insert then delete', () => {
    const t0 = createTable(3, 3, { colWidths: [10, 20, 30] });
    const t1 = insertTableColumn(t0, 1, 99);
    expect(getTableColCount(t1)).toBe(4);
    expect(rowLogicalWidths(t1)).toEqual([4, 4, 4]);
    expect(t1.colWidths).toEqual([10, 99, 20, 30]);

    const t2 = deleteTableColumn(t1, 1);
    expect(getTableColCount(t2)).toBe(3);
    expect(rowLogicalWidths(t2)).toEqual([3, 3, 3]);
    expect(t2.colWidths).toEqual([10, 20, 30]);
  });
});
