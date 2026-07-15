// Table block creation and manipulation

import type { TableBlock, TableRow, TableCell, InlineContent } from '../types';
import { generateBlockId, generateRowId, generateCellId, createTextRun } from './utils';

/**
 * Create a new table cell
 */
export function createTableCell(
  content: InlineContent[] = [],
  options?: {
    colspan?: number;
    rowspan?: number;
    styleId?: string;
  }
): TableCell {
  return {
    id: generateCellId(),
    content,
    colspan: options?.colspan,
    rowspan: options?.rowspan,
    styleId: options?.styleId,
  };
}

/**
 * Create a table cell from plain text
 */
export function createTableCellFromText(
  text: string,
  options?: {
    colspan?: number;
    rowspan?: number;
    styleId?: string;
  }
): TableCell {
  return createTableCell(
    text ? [createTextRun(text)] : [],
    options
  );
}

/**
 * Create a new table row
 */
export function createTableRow(
  cells: TableCell[],
  height?: number
): TableRow {
  return {
    id: generateRowId(),
    cells,
    height,
  };
}

/**
 * Create a new table block
 */
export function createTable(
  rows: number,
  cols: number,
  options?: {
    colWidths?: number[];
    styleId?: string;
  }
): TableBlock {
  const tableRows: TableRow[] = [];
  
  for (let r = 0; r < rows; r++) {
    const cells: TableCell[] = [];
    for (let c = 0; c < cols; c++) {
      cells.push(createTableCell());
    }
    tableRows.push(createTableRow(cells));
  }
  
  return {
    id: generateBlockId(),
    type: 'table',
    rows: tableRows,
    colWidths: options?.colWidths,
    styleId: options?.styleId,
  };
}

/**
 * Create a table from a 2D array of strings
 */
export function createTableFromData(
  data: string[][],
  options?: {
    colWidths?: number[];
    styleId?: string;
  }
): TableBlock {
  const tableRows: TableRow[] = data.map(rowData => {
    const cells = rowData.map(cellText => createTableCellFromText(cellText));
    return createTableRow(cells);
  });
  
  return {
    id: generateBlockId(),
    type: 'table',
    rows: tableRows,
    colWidths: options?.colWidths,
    styleId: options?.styleId,
  };
}

/**
 * Get the number of logical columns in a table.
 *
 * Span-aware: after a merge, covered cells are removed from the model, so a raw
 * `rows[0].cells.length` undercounts. The first row is never covered by a
 * rowspan from above, so summing its cells' `colspan` (default 1) yields the
 * true logical column count.
 */
export function getTableColCount(table: TableBlock): number {
  if (table.rows.length === 0) return 0;
  return table.rows[0].cells.reduce((sum, cell) => sum + (cell.colspan || 1), 0);
}

/**
 * A reference to the origin cell that owns a logical grid slot: `r`/`ci` index
 * into `table.rows[r].cells[ci]`.
 */
interface CellRef {
  r: number;
  ci: number;
}

/**
 * Expand the (possibly ragged, span-carrying) row model into a dense logical
 * grid. `grid[row][logicalCol]` points at the origin cell occupying that slot;
 * `starts[row][ci]` is the logical column where physical cell `ci` begins. This
 * is the standard HTML table placement algorithm and is what lets column
 * insert/delete reason in logical columns rather than physical cell indices.
 */
function buildTableGrid(table: TableBlock): { grid: (CellRef | null)[][]; starts: number[][] } {
  const grid: (CellRef | null)[][] = [];
  const starts: number[][] = [];
  const ensureRow = (r: number) => {
    while (grid.length <= r) grid.push([]);
  };

  for (let r = 0; r < table.rows.length; r++) {
    ensureRow(r);
    starts[r] = [];
    let col = 0;
    const cells = table.rows[r].cells;
    for (let ci = 0; ci < cells.length; ci++) {
      // Skip slots already taken by a rowspan from an earlier row.
      while (grid[r][col]) col++;
      starts[r][ci] = col;
      const cs = cells[ci].colspan || 1;
      const rs = cells[ci].rowspan || 1;
      for (let dr = 0; dr < rs; dr++) {
        ensureRow(r + dr);
        for (let dc = 0; dc < cs; dc++) {
          grid[r + dr][col + dc] = { r, ci };
        }
      }
      col += cs;
    }
  }

  return { grid, starts };
}

/**
 * Get the number of rows in a table
 */
export function getTableRowCount(table: TableBlock): number {
  return table.rows.length;
}

/**
 * Get a cell at a specific position
 */
export function getTableCell(
  table: TableBlock,
  row: number,
  col: number
): TableCell | undefined {
  if (row < 0 || row >= table.rows.length) return undefined;
  const tableRow = table.rows[row];
  if (col < 0 || col >= tableRow.cells.length) return undefined;
  return tableRow.cells[col];
}

/**
 * Set cell content at a specific position
 */
export function setTableCellContent(
  table: TableBlock,
  row: number,
  col: number,
  content: InlineContent[]
): TableBlock {
  if (row < 0 || row >= table.rows.length) return table;
  const tableRow = table.rows[row];
  if (col < 0 || col >= tableRow.cells.length) return table;
  
  const newRows = [...table.rows];
  const newRow = { ...tableRow, cells: [...tableRow.cells] };
  newRow.cells[col] = { ...newRow.cells[col], content };
  newRows[row] = newRow;
  
  return { ...table, rows: newRows };
}

/**
 * Insert a row at a specific position
 */
export function insertTableRow(
  table: TableBlock,
  position: number,
  row?: TableRow
): TableBlock {
  const colCount = getTableColCount(table);
  const newRow = row || createTableRow(
    Array.from({ length: colCount }, () => createTableCell())
  );
  
  const newRows = [...table.rows];
  newRows.splice(Math.max(0, Math.min(position, table.rows.length)), 0, newRow);
  
  return { ...table, rows: newRows };
}

/**
 * Delete a row at a specific position
 */
export function deleteTableRow(
  table: TableBlock,
  position: number
): TableBlock {
  if (position < 0 || position >= table.rows.length) return table;
  if (table.rows.length <= 1) return table; // Keep at least one row
  
  const newRows = [...table.rows];
  newRows.splice(position, 1);
  
  return { ...table, rows: newRows };
}

/**
 * Insert a column at a specific logical position.
 *
 * Operates on logical columns so it stays correct across merged/spanning cells:
 * a spanning cell straddling the insertion boundary absorbs the new column by
 * widening its `colspan` (once, even though a rowspan makes it appear in several
 * rows); otherwise a fresh empty cell is spliced in at the physical index that
 * corresponds to the logical column in that row.
 */
export function insertTableColumn(
  table: TableBlock,
  position: number,
  width?: number
): TableBlock {
  if (table.rows.length === 0) return table;

  const colCount = getTableColCount(table);
  const p = Math.max(0, Math.min(position, colCount));
  const { grid, starts } = buildTableGrid(table);

  // Origin cells that straddle the boundary and should widen; and, per row, the
  // physical index at which to splice a new cell (null = absorbed by a span).
  const toWiden = new Set<string>();
  const insertAt: (number | null)[] = table.rows.map((_row, r) => {
    const gRow = grid[r];
    if (p > 0 && p < gRow.length) {
      const left = gRow[p - 1];
      const right = gRow[p];
      if (left && right && left.r === right.r && left.ci === right.ci) {
        toWiden.add(`${left.r}:${left.ci}`);
        return null;
      }
    }
    // First physical cell whose logical start is at/after the boundary.
    let phys = 0;
    const rowStarts = starts[r];
    while (phys < rowStarts.length && rowStarts[phys] < p) phys++;
    return phys;
  });

  const newRows = table.rows.map((row, r) => {
    let cells = row.cells.map((cell, ci) =>
      toWiden.has(`${r}:${ci}`) ? { ...cell, colspan: (cell.colspan || 1) + 1 } : cell
    );
    const at = insertAt[r];
    if (at !== null) {
      cells = [...cells];
      cells.splice(at, 0, createTableCell());
    }
    return { ...row, cells };
  });

  const newColWidths = table.colWidths ? [...table.colWidths] : undefined;
  if (newColWidths) {
    newColWidths.splice(Math.min(p, newColWidths.length), 0, width || 100);
  }

  return { ...table, rows: newRows, colWidths: newColWidths };
}

/**
 * Delete a column at a specific logical position.
 *
 * Span-aware: an origin cell intersecting the column is either shrunk
 * (`colspan > 1`) or removed entirely (`colspan === 1`); each origin cell is
 * touched once regardless of how many rows a rowspan makes it span.
 */
export function deleteTableColumn(
  table: TableBlock,
  position: number
): TableBlock {
  const colCount = getTableColCount(table);
  if (position < 0 || position >= colCount) return table;
  if (colCount <= 1) return table; // Keep at least one column

  const p = position;
  const { grid } = buildTableGrid(table);

  // Classify each origin cell that touches column p.
  const shrink = new Set<string>();
  const remove = new Set<string>();
  for (let r = 0; r < grid.length; r++) {
    const owner = grid[r][p];
    if (!owner) continue;
    const key = `${owner.r}:${owner.ci}`;
    const cell = table.rows[owner.r].cells[owner.ci];
    if ((cell.colspan || 1) > 1) shrink.add(key);
    else remove.add(key);
  }

  const newRows = table.rows.map((row, r) => {
    const newCells: TableCell[] = [];
    row.cells.forEach((cell, ci) => {
      const key = `${r}:${ci}`;
      if (remove.has(key)) return; // covered cell for this column disappears
      if (shrink.has(key)) {
        newCells.push({ ...cell, colspan: (cell.colspan || 1) - 1 });
        return;
      }
      newCells.push(cell);
    });
    return { ...row, cells: newCells };
  });

  const newColWidths = table.colWidths ? [...table.colWidths] : undefined;
  if (newColWidths) {
    newColWidths.splice(p, 1);
  }

  return { ...table, rows: newRows, colWidths: newColWidths };
}

/**
 * Merge cells in a table
 */
export function mergeCells(
  table: TableBlock,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): TableBlock {
  // Validate range
  if (startRow > endRow || startCol > endCol) return table;
  if (startRow < 0 || endRow >= table.rows.length) return table;
  if (startCol < 0 || endCol >= getTableColCount(table)) return table;
  
  const newRows = table.rows.map((row, rowIndex) => {
    if (rowIndex < startRow || rowIndex > endRow) return row;

    const newCells: TableCell[] = [];
    row.cells.forEach((cell, colIndex) => {
      // Cells outside the merged range are untouched.
      if (colIndex < startCol || colIndex > endCol) {
        newCells.push(cell);
        return;
      }

      // The top-left cell absorbs the span.
      if (rowIndex === startRow && colIndex === startCol) {
        newCells.push({
          ...cell,
          colspan: endCol - startCol + 1,
          rowspan: endRow - startRow + 1,
        });
      }

      // Every other covered cell is removed entirely — leaving it (even empty)
      // renders/serializes as a phantom extra column under the spanning cell.
    });

    return { ...row, cells: newCells };
  });

  return { ...table, rows: newRows };
}

