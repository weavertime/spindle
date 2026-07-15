import {
  createTable,
  insertTableColumn,
  mergeCells,
  getTableColCount,
} from './table';

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
});
