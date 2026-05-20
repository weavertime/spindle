// Filter functionality for spreadsheet sheets

import type { ColumnFilter, FilterCriteria, Sheet } from '../types';

/**
 * Manages filtering operations for a spreadsheet sheet
 */
export class FilterManager {
  /**
   * Apply filters to get visible row indices
   * @param sheet The sheet to filter
   * @param filters Map of column filters
   * @param dataRange Optional range to filter, defaults to data rows (starting from row 1, assuming row 0 is header)
   * @returns Set of visible row indices
   */
  static getFilteredRows(
    sheet: Sheet,
    filters: Map<number, ColumnFilter>,
    dataRange?: { startRow: number; endRow: number }
  ): Set<number> {
    if (filters.size === 0) {
      // No filters, all rows visible (including header row 0)
      const visibleRows = new Set<number>();
      const startRow = dataRange?.startRow ?? 0;
      const endRow = dataRange?.endRow ?? sheet.rowCount - 1;
      for (let row = startRow; row <= endRow; row++) {
        visibleRows.add(row);
      }
      return visibleRows;
    }

    // Determine data range to filter (default to row 1+, assuming row 0 is header)
    const startRow = dataRange?.startRow ?? Math.max(1, this.detectDataStartRow(sheet));
    const endRow = dataRange?.endRow ?? this.detectDataEndRow(sheet);

    const visibleRows = new Set<number>();

    // Always include the header row (row 0) if we're starting from row 0 or earlier
    if (dataRange?.startRow === undefined || dataRange.startRow <= 0) {
      visibleRows.add(0);
    }

    // Check each data row against all filters
    for (let row = startRow; row <= endRow; row++) {
      let isVisible = true;

      for (const [, filter] of filters) {
        const cell = sheet.getCell(row, filter.column);
        const cellValue = cell?.value ?? null;

        if (!this.matchesFilter(cellValue, filter.criteria)) {
          isVisible = false;
          break;
        }
      }

      if (isVisible) {
        visibleRows.add(row);
      }
    }

    return visibleRows;
  }

  /**
   * Check if a cell value matches a filter criteria
   * @param cellValue The cell value to check
   * @param criteria The filter criteria
   * @returns true if the value matches the filter
   */
  private static matchesFilter(cellValue: unknown, criteria: FilterCriteria): boolean {
    // Handle null/undefined values
    if (cellValue === null || cellValue === undefined) {
      // Null values only match if criteria allows empty values
      return criteria.type === 'equals' && criteria.value === '';
    }

    // Convert cell value to string for text operations
    const strValue = String(cellValue) as string;

    switch (criteria.type) {
      case 'equals':
        return strValue === String(criteria.value);

      case 'notEquals':
        return strValue !== String(criteria.value);

      case 'contains':
        return strValue.toLowerCase().includes(criteria.value.toLowerCase());

      case 'notContains':
        return !strValue.toLowerCase().includes(criteria.value.toLowerCase());

      case 'startsWith':
        return strValue.toLowerCase().startsWith(criteria.value.toLowerCase());

      case 'endsWith':
        return strValue.toLowerCase().endsWith(criteria.value.toLowerCase());

      case 'greaterThan': {
        const numValue = Number(cellValue);
        return !isNaN(numValue) && numValue > criteria.value;
      }

      case 'lessThan': {
        const numValue = Number(cellValue);
        return !isNaN(numValue) && numValue < criteria.value;
      }

      case 'greaterThanOrEqual': {
        const numValue = Number(cellValue);
        return !isNaN(numValue) && numValue >= criteria.value;
      }

      case 'lessThanOrEqual': {
        const numValue = Number(cellValue);
        return !isNaN(numValue) && numValue <= criteria.value;
      }

      case 'between': {
        const numValue = Number(cellValue);
        return !isNaN(numValue) && numValue >= criteria.min && numValue <= criteria.max;
      }

      case 'custom':
        return criteria.values.has(cellValue as string | number);

      default:
        return true; // Unknown criteria type, show the row
    }
  }

  /**
   * Get unique values in a column for filter dropdowns
   * @param sheet The sheet to analyze
   * @param column Column index
   * @param dataRange Optional range to analyze, defaults to data rows (starting from row 1, assuming row 0 is header)
   * @returns Set of unique values in the column
   */
  static getUniqueColumnValues(
    sheet: Sheet,
    column: number,
    dataRange?: { startRow: number; endRow: number }
  ): Set<string | number> {
    const uniqueValues = new Set<string | number>();

    // Default to data rows only (skip header row 0), unless explicitly specified
    const startRow = dataRange?.startRow ?? Math.max(1, this.detectDataStartRow(sheet));
    const endRow = dataRange?.endRow ?? this.detectDataEndRow(sheet);

    for (let row = startRow; row <= endRow; row++) {
      const cell = sheet.getCell(row, column);
      if (cell?.value !== null && cell?.value !== undefined) {
        uniqueValues.add(cell.value as string | number);
      }
    }

    return uniqueValues;
  }

  /**
   * Detect the first row that contains data (skip empty rows at the top)
   */
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

  /**
   * Detect the last row that contains data (skip empty rows at the bottom)
   */
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

  /**
   * Check if a column has an active filter
   * @param column Column index
   * @param filters Current filters map
   * @returns true if column has a filter
   */
  static hasFilter(column: number, filters: Map<number, ColumnFilter>): boolean {
    return filters.has(column);
  }

  /**
   * Get filter type based on column data
   * @param sheet The sheet to analyze
   * @param column Column index
   * @returns 'text', 'number', or 'date' based on data analysis
   */
  static detectColumnType(sheet: Sheet, column: number): 'text' | 'number' | 'date' {
    const uniqueValues = this.getUniqueColumnValues(sheet, column);
    let hasNumbers = false;
    let hasDates = false;

    for (const value of uniqueValues) {
      if (typeof value === 'number') {
        hasNumbers = true;
      } else if (typeof value === 'string') {
        // Check if string looks like a date
        const date = new Date(value);
        if (!isNaN(date.getTime()) && value.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/)) {
          hasDates = true;
        }
      }
    }

    if (hasDates) return 'date';
    if (hasNumbers) return 'number';
    return 'text';
  }
}
