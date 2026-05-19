import type { SortOrder, Sheet } from '../types';
import type { SheetImpl } from '../sheet';

/**
 * Row sorting via stable-ID order permutation.
 *
 * Cells stay attached to their original rowId; only the index → rowId mapping
 * shifts. Formulas don't need text rewriting because:
 *   - Relative refs are re-parsed against the cell's current position on every
 *     evaluation, so they naturally produce the correct absolute target.
 *   - Absolute refs ($A$1) point at a literal index and are unaffected by sort
 *     (consistent with Google Sheets' behavior).
 */
export class SortManager {
  static sortRows(
    sheet: Sheet,
    sortOrder: SortOrder[],
    dataRange?: { startRow: number; endRow: number },
  ): void {
    if (sortOrder.length === 0) return;

    const startRow = dataRange?.startRow ?? this.detectDataStartRow(sheet);
    const endRow = dataRange?.endRow ?? this.detectDataEndRow(sheet);
    if (startRow >= endRow) return;

    const impl = sheet as SheetImpl;

    // Capture each row's current rowId and its sort-key values.
    // ensureRowId so untouched rows in the sort range still participate
    // (they sort as null values, matching prior behavior).
    const rowsToSort: Array<{ rowId: string; values: unknown[] }> = [];
    for (let row = startRow; row <= endRow; row++) {
      const rowId = impl.ensureRowId(row);
      const values: unknown[] = [];
      for (let col = 0; col < sheet.colCount; col++) {
        values.push(sheet.getCell(row, col)?.value ?? null);
      }
      rowsToSort.push({ rowId, values });
    }

    rowsToSort.sort((a, b) => {
      for (const sort of sortOrder) {
        const aValue = a.values[sort.column];
        const bValue = b.values[sort.column];

        let comparison = 0;
        if (aValue === null && bValue === null) {
          comparison = 0;
        } else if (aValue === null) {
          comparison = sort.direction === 'asc' ? -1 : 1;
        } else if (bValue === null) {
          comparison = sort.direction === 'asc' ? 1 : -1;
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
          comparison = aValue === bValue ? 0 : aValue ? 1 : -1;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }

        if (sort.direction === 'desc') comparison = -comparison;
        if (comparison !== 0) return comparison;
      }
      return 0;
    });

    // Build the new order map for the sort range, leaving rows outside it untouched.
    const snapshot = impl.snapshotOrderMaps();
    const newRowOrder = new Map(snapshot.rowOrder);
    // Drop the rowIds that are being repositioned, then write them back in their new order.
    for (let row = startRow; row <= endRow; row++) {
      newRowOrder.delete(row);
    }
    for (let i = 0; i < rowsToSort.length; i++) {
      newRowOrder.set(startRow + i, rowsToSort[i].rowId);
    }
    impl.replaceOrderMaps(newRowOrder, snapshot.colOrder);
  }

  private static detectDataStartRow(sheet: Sheet): number {
    for (let row = 0; row < sheet.rowCount; row++) {
      for (let col = 0; col < sheet.colCount; col++) {
        const cell = sheet.getCell(row, col);
        if (cell && (cell.value !== null || cell.formula)) {
          return row;
        }
      }
    }
    return 0;
  }

  private static detectDataEndRow(sheet: Sheet): number {
    for (let row = sheet.rowCount - 1; row >= 0; row--) {
      for (let col = 0; col < sheet.colCount; col++) {
        const cell = sheet.getCell(row, col);
        if (cell && (cell.value !== null || cell.formula)) {
          return row;
        }
      }
    }
    return Math.max(0, sheet.rowCount - 1);
  }

  static getColumnSortDirection(
    column: number,
    currentSortOrder: SortOrder[],
  ): 'asc' | 'desc' | null {
    const sort = currentSortOrder.find((s) => s.column === column);
    return sort ? sort.direction : null;
  }

  static toggleColumnSort(
    column: number,
    currentSortOrder: SortOrder[],
    multiColumn: boolean = false,
  ): SortOrder[] {
    const existingSortIndex = currentSortOrder.findIndex((s) => s.column === column);

    if (existingSortIndex >= 0) {
      const existingSort = currentSortOrder[existingSortIndex];
      if (existingSort.direction === 'asc') {
        const newSortOrder = [...currentSortOrder];
        newSortOrder[existingSortIndex] = { ...existingSort, direction: 'desc' };
        return newSortOrder;
      } else {
        return currentSortOrder.filter((s) => s.column !== column);
      }
    } else {
      if (multiColumn && currentSortOrder.length > 0) {
        return [...currentSortOrder, { column, direction: 'asc' }];
      } else {
        return [{ column, direction: 'asc' }];
      }
    }
  }
}
