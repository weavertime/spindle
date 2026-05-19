// Sheet model with sparse cell storage

import type { Sheet, SheetConfig, Cell, Range, SortOrder } from './types';
import { getCellKey, parseCellKey } from './utils/cell-key';
import { generateId } from './utils/id';
import { getRangeCells } from './utils/range';

export class SheetImpl implements Sheet {
  id: string;
  name: string;
  cells: Map<string, Cell> = new Map();
  config: SheetConfig;
  rowCount: number;
  colCount: number;

  // Stable IDs for rows and columns. Sparse: only rows/cols that have been
  // touched (cell set, height/width customized, hidden, etc.) get an entry.
  // Untouched indices are virtual until something attaches to them.
  // Phase 2a.1: populated but not yet consumed by storage paths.
  protected rowOrder: Map<number, string> = new Map();
  protected colOrder: Map<number, string> = new Map();

  constructor(id: string, name: string, config: Partial<SheetConfig> = {}) {
    this.id = id;
    this.name = name;
    this.config = {
      defaultRowHeight: 20,
      defaultColWidth: 100,
      showGridLines: true,
      ...config,
    };
    this.rowCount = 1000;
    this.colCount = 100;
  }

  // ============================================
  // Stable ID helpers (Phase 2a.1)
  // ============================================

  /** Return the stable rowId at the given index, or undefined if untouched. */
  getRowId(row: number): string | undefined {
    return this.rowOrder.get(row);
  }

  /** Return the stable colId at the given index, or undefined if untouched. */
  getColId(col: number): string | undefined {
    return this.colOrder.get(col);
  }

  /** Return the stable rowId at the given index, generating one if absent. */
  ensureRowId(row: number): string {
    let id = this.rowOrder.get(row);
    if (!id) {
      id = generateId();
      this.rowOrder.set(row, id);
    }
    return id;
  }

  /** Return the stable colId at the given index, generating one if absent. */
  ensureColId(col: number): string {
    let id = this.colOrder.get(col);
    if (!id) {
      id = generateId();
      this.colOrder.set(col, id);
    }
    return id;
  }

  getCell(row: number, col: number): Cell | undefined {
    const key = getCellKey(row, col);
    return this.cells.get(key);
  }

  setCell(row: number, col: number, cell: Partial<Cell>): void {
    const key = getCellKey(row, col);
    const existing = this.cells.get(key);

    if (existing) {
      // Merge with existing cell
      this.cells.set(key, { ...existing, ...cell });
    } else {
      // Create new cell
      this.cells.set(key, {
        value: cell.value ?? null,
        ...cell,
      });
    }
  }


  deleteCell(row: number, col: number): void {
    const key = getCellKey(row, col);
    this.cells.delete(key);
  }

  getCellValue(row: number, col: number): unknown {
    const cell = this.getCell(row, col);
    return cell?.value ?? null;
  }

  setCellValue(row: number, col: number, value: unknown): void {
    this.setCell(row, col, { value: value as string | number | boolean | null });
  }

  getRange(range: Range): Map<string, Cell> {
    const result = new Map<string, Cell>();
    const cells = getRangeCells(range);

    for (const { row, col } of cells) {
      const cell = this.getCell(row, col);
      if (cell) {
        result.set(getCellKey(row, col), cell);
      }
    }

    return result;
  }

  setRange(range: Range, cells: Map<string, Cell> | Cell[][]): void {
    if (cells instanceof Map) {
      // Map of cellKey -> Cell
      for (const [key, cell] of cells) {
        const { row, col } = parseCellKey(key);
        this.setCell(row, col, cell);
      }
    } else {
      // 2D array
      const rangeCells = getRangeCells(range);
      for (let i = 0; i < rangeCells.length && i < cells.flat().length; i++) {
        const { row, col } = rangeCells[i];
        const cell = cells.flat()[i];
        if (cell) {
          this.setCell(row, col, cell);
        }
      }
    }
  }

  clearRange(range: Range): void {
    const cells = getRangeCells(range);
    for (const { row, col } of cells) {
      this.deleteCell(row, col);
    }
  }

  getRowHeight(row: number): number {
    return this.config.rowHeights?.get(row) ?? this.config.defaultRowHeight ?? 20;
  }

  setRowHeight(row: number, height: number): void {
    if (!this.config.rowHeights) {
      this.config.rowHeights = new Map();
    }
    this.config.rowHeights.set(row, height);
  }

  getColWidth(col: number): number {
    return this.config.colWidths?.get(col) ?? this.config.defaultColWidth ?? 100;
  }

  setColWidth(col: number, width: number): void {
    if (!this.config.colWidths) {
      this.config.colWidths = new Map();
    }
    this.config.colWidths.set(col, width);
  }

  insertRows(startRow: number, count: number): void {
    // Shift existing cells down
    const cellsToMove: Array<{ key: string; cell: Cell; newRow: number }> = [];

    for (const [key, cell] of this.cells) {
      const { row } = parseCellKey(key);
      if (row >= startRow) {
        cellsToMove.push({ key, cell, newRow: row + count });
      }
    }

    // Remove old cells
    for (const { key } of cellsToMove) {
      this.cells.delete(key);
    }

    // Add cells at new positions
    for (const { cell, newRow, key } of cellsToMove) {
      const { col } = parseCellKey(key);
      this.setCell(newRow, col, cell);
    }

    this.rowCount += count;
  }

  deleteRows(startRow: number, count: number): void {
    // Delete cells in range
    for (let row = startRow; row < startRow + count; row++) {
      for (let col = 0; col < this.colCount; col++) {
        this.deleteCell(row, col);
      }
    }

    // Shift cells up
    const cellsToMove: Array<{ key: string; cell: Cell; newRow: number }> = [];

    for (const [key, cell] of this.cells) {
      const { row } = parseCellKey(key);
      if (row > startRow + count - 1) {
        cellsToMove.push({ key, cell, newRow: row - count });
      }
    }

    // Remove old cells
    for (const { key } of cellsToMove) {
      this.cells.delete(key);
    }

    // Add cells at new positions
    for (const { cell, newRow, key } of cellsToMove) {
      const { col } = parseCellKey(key);
      this.setCell(newRow, col, cell);
    }

    this.rowCount = Math.max(0, this.rowCount - count);
  }

  insertCols(startCol: number, count: number): void {
    // Shift existing cells right
    const cellsToMove: Array<{ key: string; cell: Cell; newCol: number }> = [];

    for (const [key, cell] of this.cells) {
      const { col } = parseCellKey(key);
      if (col >= startCol) {
        cellsToMove.push({ key, cell, newCol: col + count });
      }
    }

    // Remove old cells
    for (const { key } of cellsToMove) {
      this.cells.delete(key);
    }

    // Add cells at new positions
    for (const { cell, newCol, key } of cellsToMove) {
      const { row } = parseCellKey(key);
      this.setCell(row, newCol, cell);
    }

    this.colCount += count;
  }

  deleteCols(startCol: number, count: number): void {
    // Delete cells in range
    for (let col = startCol; col < startCol + count; col++) {
      for (let row = 0; row < this.rowCount; row++) {
        this.deleteCell(row, col);
      }
    }

    // Shift cells left
    const cellsToMove: Array<{ key: string; cell: Cell; newCol: number }> = [];

    for (const [key, cell] of this.cells) {
      const { col } = parseCellKey(key);
      if (col > startCol + count - 1) {
        cellsToMove.push({ key, cell, newCol: col - count });
      }
    }

    // Remove old cells
    for (const { key } of cellsToMove) {
      this.cells.delete(key);
    }

    // Add cells at new positions
    for (const { cell, newCol, key } of cellsToMove) {
      const { row } = parseCellKey(key);
      this.setCell(row, newCol, cell);
    }

    this.colCount = Math.max(0, this.colCount - count);
  }

  isRowHidden(row: number): boolean {
    return this.config.hiddenRows?.has(row) ?? false;
  }

  hideRow(row: number): void {
    if (!this.config.hiddenRows) {
      this.config.hiddenRows = new Set();
    }
    this.config.hiddenRows.add(row);
  }

  showRow(row: number): void {
    this.config.hiddenRows?.delete(row);
  }

  isColHidden(col: number): boolean {
    return this.config.hiddenCols?.has(col) ?? false;
  }

  hideCol(col: number): void {
    if (!this.config.hiddenCols) {
      this.config.hiddenCols = new Set();
    }
    this.config.hiddenCols.add(col);
  }

  showCol(col: number): void {
    this.config.hiddenCols?.delete(col);
  }

  // Find hidden columns adjacent to a given column (before and after)
  getHiddenColsAdjacent(col: number): { before: number[]; after: number[] } {
    const hiddenCols = this.config.hiddenCols;
    if (!hiddenCols || hiddenCols.size === 0) {
      return { before: [], after: [] };
    }

    const before: number[] = [];
    const after: number[] = [];

    for (let c = col - 1; c >= 0; c--) {
      if (hiddenCols.has(c)) {
        before.push(c);
      } else {
        break; // Stop at first visible column
      }
    }

    for (let c = col + 1; c < this.colCount; c++) {
      if (hiddenCols.has(c)) {
        after.push(c);
      } else {
        break; // Stop at first visible column
      }
    }

    return { before, after };
  }

  // Find hidden rows adjacent to a given row (above and below)
  getHiddenRowsAdjacent(row: number): { above: number[]; below: number[] } {
    const hiddenRows = this.config.hiddenRows;
    if (!hiddenRows || hiddenRows.size === 0) {
      return { above: [], below: [] };
    }

    const above: number[] = [];
    const below: number[] = [];

    for (let r = row - 1; r >= 0; r--) {
      if (hiddenRows.has(r)) {
        above.push(r);
      } else {
        break; // Stop at first visible row
      }
    }

    for (let r = row + 1; r < this.rowCount; r++) {
      if (hiddenRows.has(r)) {
        below.push(r);
      } else {
        break; // Stop at first visible row
      }
    }

    return { above, below };
  }

  // Show all hidden columns in a range
  showColsInRange(startCol: number, endCol: number): void {
    if (!this.config.hiddenCols) return;
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    for (let c = minCol; c <= maxCol; c++) {
      this.config.hiddenCols.delete(c);
    }
  }

  // Show all hidden rows in a range
  showRowsInRange(startRow: number, endRow: number): void {
    if (!this.config.hiddenRows) return;
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    for (let r = minRow; r <= maxRow; r++) {
      this.config.hiddenRows.delete(r);
    }
  }

  // ============================================
  // Freeze Panes Methods
  // ============================================

  /**
   * Get the number of frozen rows
   */
  getFrozenRows(): number {
    return this.config.frozenRows ?? 0;
  }

  /**
   * Set the number of frozen rows
   * @param count Number of rows to freeze (0 to unfreeze rows)
   */
  setFrozenRows(count: number): void {
    if (count < 0) {
      throw new Error('Frozen row count cannot be negative');
    }
    if (count >= this.rowCount) {
      throw new Error('Cannot freeze all rows');
    }
    this.config.frozenRows = count > 0 ? count : undefined;
  }

  /**
   * Get the number of frozen columns
   */
  getFrozenCols(): number {
    return this.config.frozenCols ?? 0;
  }

  /**
   * Set the number of frozen columns
   * @param count Number of columns to freeze (0 to unfreeze columns)
   */
  setFrozenCols(count: number): void {
    if (count < 0) {
      throw new Error('Frozen column count cannot be negative');
    }
    if (count >= this.colCount) {
      throw new Error('Cannot freeze all columns');
    }
    this.config.frozenCols = count > 0 ? count : undefined;
  }

  /**
   * Freeze rows and columns at the specified position
   * @param rows Number of rows to freeze
   * @param cols Number of columns to freeze
   */
  setFreeze(rows: number, cols: number): void {
    this.setFrozenRows(rows);
    this.setFrozenCols(cols);
  }

  /**
   * Clear all freeze panes (unfreeze both rows and columns)
   */
  clearFreeze(): void {
    this.config.frozenRows = undefined;
    this.config.frozenCols = undefined;
  }

  /**
   * Check if freeze panes are active
   */
  hasFrozenPanes(): boolean {
    return (this.config.frozenRows ?? 0) > 0 || (this.config.frozenCols ?? 0) > 0;
  }

  // ============================================
  // Sorting Methods
  // ============================================

  /**
   * Set the sort order for the sheet
   * @param sortOrder Array of sort criteria
   */
  setSortOrder(sortOrder: SortOrder[]): void {
    this.config.sortOrder = [...sortOrder];
  }

  /**
   * Get the current sort order
   * @returns Current sort order array
   */
  getSortOrder(): SortOrder[] {
    return this.config.sortOrder ?? [];
  }

  /**
   * Clear all sorting
   */
  clearSort(): void {
    this.config.sortOrder = undefined;
  }

  /**
   * Check if the sheet has any sorting applied
   */
  hasSort(): boolean {
    return (this.config.sortOrder?.length ?? 0) > 0;
  }

  // ============================================
  // Filtering Methods
  // ============================================

  /**
   * Set a filter for a column
   * @param column Column index
   * @param filter Filter configuration
   */
  setFilter(column: number, filter: import('./types').ColumnFilter): void {
    if (!this.config.filters) {
      this.config.filters = new Map();
    }
    this.config.filters.set(column, filter);
  }

  /**
   * Clear filter for a specific column
   * @param column Column index
   */
  clearFilter(column: number): void {
    this.config.filters?.delete(column);
  }

  /**
   * Get all active filters
   * @returns Map of column -> filter
   */
  getFilters(): Map<number, import('./types').ColumnFilter> {
    return this.config.filters ?? new Map();
  }

  /**
   * Check if a column has an active filter
   * @param column Column index
   * @returns true if column has a filter
   */
  hasFilter(column: number): boolean {
    return this.config.filters?.has(column) ?? false;
  }

  /**
   * Clear all filters from the sheet
   */
  clearAllFilters(): void {
    this.config.filters = undefined;
  }
}

