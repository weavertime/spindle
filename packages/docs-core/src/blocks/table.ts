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
 * Get the number of columns in a table
 */
export function getTableColCount(table: TableBlock): number {
  if (table.rows.length === 0) return 0;
  return table.rows[0].cells.length;
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
 * Insert a column at a specific position
 */
export function insertTableColumn(
  table: TableBlock,
  position: number,
  width?: number
): TableBlock {
  // Clamp the insertion index once and use it for both the cells and the
  // colWidths, so the widths array stays aligned with the columns (a raw
  // negative/overflowing position would otherwise splice at a different spot).
  const insertAt = Math.max(0, Math.min(position, getTableColCount(table)));

  const newRows = table.rows.map(row => {
    const newCells = [...row.cells];
    newCells.splice(insertAt, 0, createTableCell());
    return { ...row, cells: newCells };
  });

  const newColWidths = table.colWidths ? [...table.colWidths] : undefined;
  if (newColWidths) {
    newColWidths.splice(insertAt, 0, width || 100);
  }

  return { ...table, rows: newRows, colWidths: newColWidths };
}

/**
 * Delete a column at a specific position
 */
export function deleteTableColumn(
  table: TableBlock,
  position: number
): TableBlock {
  const colCount = getTableColCount(table);
  if (position < 0 || position >= colCount) return table;
  if (colCount <= 1) return table; // Keep at least one column
  
  const newRows = table.rows.map(row => {
    const newCells = [...row.cells];
    newCells.splice(position, 1);
    return { ...row, cells: newCells };
  });
  
  const newColWidths = table.colWidths ? [...table.colWidths] : undefined;
  if (newColWidths) {
    newColWidths.splice(position, 1);
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

