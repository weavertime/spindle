// Core types for pagent-sheets

export type CellValue = string | number | boolean | null;

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  textWrap?: boolean;
  textDecoration?: 'none' | 'underline' | 'line-through';
}

export type FormatType =
  | 'text'
  | 'number'
  | 'currency'
  | 'accounting'
  | 'percentage'
  | 'scientific'
  | 'fraction'
  | 'date'
  | 'time'
  | 'datetime'
  | 'duration'
  | 'custom'
  | undefined;

export interface CellFormat {
  type?: FormatType;

  // Number format options
  decimalPlaces?: number; // 0-30
  useThousandsSeparator?: boolean;

  // Currency format options
  currencyCode?: string; // USD, EUR, GBP, JPY, etc.
  currencySymbolPosition?: 'prefix' | 'suffix';

  // Negative number display options
  negativeFormat?: 'minus' | 'parentheses' | 'red';

  // Date/Time format options
  dateFormat?: string; // e.g., 'MM/DD/YYYY', 'DD-MM-YYYY'
  timeFormat?: string; // e.g., 'HH:mm:ss', 'h:mm AM/PM'

  // Fraction format options
  fractionType?: 'upToOne' | 'upToTwo' | 'upToThree' | 'asHalves' | 'asQuarters' | 'asEighths' | 'asSixteenths' | 'asTenths' | 'asHundredths';

  // Duration format options
  durationFormat?: 'hours' | 'minutes' | 'seconds' | 'milliseconds';

  // Custom format pattern
  pattern?: string; // Custom number format pattern (e.g., "#,##0.00", "0.0%")
}

export interface Cell {
  value: CellValue;
  /**
   * Display string for the formula (A1 notation). When `formulaAst` is also
   * present, the AST is the source of truth and `formula` is a cache that
   * gets regenerated on every evaluation. A cell with only `formula` and no
   * `formulaAst` (e.g. set via legacy paths) is upgraded to a stable AST on
   * first evaluation.
   */
  formula?: string;
  /**
   * Stable-ID formula AST. Source of truth for the formula's structure; refs
   * point at rowId/colId so they survive insert/delete/sort. Imported lazily
   * to avoid pulling formula-parser types into every consumer of Cell.
   */
  formulaAst?: import('./formula-parser/stable-ast').StableFormulaNode;
  styleId?: string; // Reference to shared style in StylePool
  formatId?: string; // Reference to shared format in FormatPool
  comment?: string;
  hyperlink?: string;
}

export interface Range {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface Selection {
  ranges: Range[];
  activeCell: { row: number; col: number };
}

export interface SortOrder {
  column: number;
  direction: 'asc' | 'desc';
}

export interface ColumnFilter {
  column: number;
  type: 'text' | 'number' | 'date';
  criteria: FilterCriteria;
}

export type FilterCriteria =
  | { type: 'equals'; value: string | number }
  | { type: 'notEquals'; value: string | number }
  | { type: 'contains'; value: string }
  | { type: 'notContains'; value: string }
  | { type: 'startsWith'; value: string }
  | { type: 'endsWith'; value: string }
  | { type: 'greaterThan'; value: number }
  | { type: 'lessThan'; value: number }
  | { type: 'greaterThanOrEqual'; value: number }
  | { type: 'lessThanOrEqual'; value: number }
  | { type: 'between'; min: number; max: number }
  | { type: 'custom'; values: Set<string | number> }; // For multi-select

export interface SheetConfig {
  defaultRowHeight?: number;
  defaultColWidth?: number;
  // Row/column config keyed by stable rowId/colId (not numeric index).
  // Translate at the public API surface via SheetImpl.getRowId / getColId.
  rowHeights?: Map<string, number>; // rowId -> height
  colWidths?: Map<string, number>;  // colId -> width
  hiddenRows?: Set<string>;          // set of rowIds
  hiddenCols?: Set<string>;          // set of colIds
  frozenRows?: number;               // count; index-based by definition
  frozenCols?: number;               // count; index-based by definition
  showGridLines?: boolean;
  sortOrder?: SortOrder[];           // criteria still reference numeric columns (revisit in v2)
  filters?: Map<string, ColumnFilter>; // colId -> filter
}

export interface Sheet {
  id: string;
  name: string;
  cells: Map<string, Cell>; // key: "rowId:colId" (stable IDs — translate via SheetImpl helpers)
  config: SheetConfig;
  rowCount: number;
  colCount: number;

  // Stable-ID helpers (translate between numeric indices and stable rowId/colId)
  getRowId(row: number): string | undefined;
  getColId(col: number): string | undefined;
  ensureRowId(row: number): string;
  ensureColId(col: number): string;
  getRowIndex(rowId: string): number | undefined;
  getColIndex(colId: string): number | undefined;
  stableKeyToIndices(key: string): { row: number; col: number } | undefined;

  getCell(row: number, col: number): Cell | undefined;
  setCell(row: number, col: number, cell: Partial<Cell>): void;
  deleteCell(row: number, col: number): void;
  getCellValue(row: number, col: number): unknown;
  setCellValue(row: number, col: number, value: unknown): void;
  getRange(range: Range): Map<string, Cell>;
  setRange(range: Range, cells: Map<string, Cell> | Cell[][]): void;
  clearRange(range: Range): void;
  entries(): IterableIterator<[number, number, Cell]>;
  getRowHeight(row: number): number;
  setRowHeight(row: number, height: number): void;
  getColWidth(col: number): number;
  setColWidth(col: number, width: number): void;
  insertRows(startRow: number, count: number): void;
  deleteRows(startRow: number, count: number): void;
  insertCols(startCol: number, count: number): void;
  deleteCols(startCol: number, count: number): void;
  isRowHidden(row: number): boolean;
  hideRow(row: number): void;
  showRow(row: number): void;
  isColHidden(col: number): boolean;
  hideCol(col: number): void;
  showCol(col: number): void;
  getHiddenColsAdjacent(col: number): { before: number[]; after: number[] };
  getHiddenRowsAdjacent(row: number): { above: number[]; below: number[] };
  showColsInRange(startCol: number, endCol: number): void;
  showRowsInRange(startRow: number, endRow: number): void;
  getFrozenRows(): number;
  setFrozenRows(count: number): void;
  getFrozenCols(): number;
  setFrozenCols(count: number): void;
  setFreeze(rows: number, cols: number): void;
  clearFreeze(): void;
  hasFrozenPanes(): boolean;
  setSortOrder(sortOrder: SortOrder[]): void;
  getSortOrder(): SortOrder[];
  clearSort(): void;
  hasSort(): boolean;
  setFilter(column: number, filter: ColumnFilter): void;
  clearFilter(column: number): void;
  getFilters(): Map<number, ColumnFilter>;
  hasFilter(column: number): boolean;
  clearAllFilters(): void;

  // Order-map plumbing (used by sort, history snapshot/restore, and the
  // future CRDT binding). Cells are not touched by these calls.
  replaceOrderMaps(rowOrder: Map<number, string>, colOrder: Map<number, string>): void;
  snapshotOrderMaps(): { rowOrder: Map<number, string>; colOrder: Map<number, string> };
}

export interface Workbook {
  id: string;
  name: string;
  sheets: Map<string, Sheet>;
  activeSheetId: string;
  defaultRowHeight: number;
  defaultColWidth: number;

  // Undo/Redo
  recordHistory(): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;

  // Sorting
  setSortOrder(sortOrder: SortOrder[], sheetId?: string): void;
  getSortOrder(sheetId?: string): SortOrder[];
  clearSort(sheetId?: string): void;
  sortSheet(sheetId?: string): void;

  // Filtering
  setFilter(column: number, filter: ColumnFilter, sheetId?: string): void;
  clearFilter(column: number, sheetId?: string): void;
  getFilters(sheetId?: string): Map<number, ColumnFilter>;
  clearAllFilters(sheetId?: string): void;

  // Data serialization/deserialization
  getData(): WorkbookData;
  setData(data: WorkbookData): void;
}

export interface StylePool {
  styles: Map<string, CellStyle>;
  getOrCreate(style: CellStyle): string;
  get(styleId: string): CellStyle | undefined;
  getAllStyles(): Map<string, CellStyle>;
}

export interface FormatPool {
  getOrCreate(format: CellFormat): string;
  get(formatId: string): CellFormat | undefined;
  getAllFormats(): Map<string, CellFormat>;
}

// Workbook data serialization interfaces
export interface WorkbookData {
  id: string;
  name: string;
  activeSheetId: string;
  defaultRowHeight: number;
  defaultColWidth: number;
  stylePool: Record<string, CellStyle>; // styleId -> style object
  formatPool?: Record<string, CellFormat>; // formatId -> format object (optional for backward compatibility)
  sheets: SheetData[];
  selection?: Selection; // Optional UI state
}

export interface SheetData {
  id: string;
  name: string;
  cells: Array<{ key: string; cell: Cell }>; // key format: "row:col"
  config: {
    defaultRowHeight?: number;
    defaultColWidth?: number;
    rowHeights?: Array<[number, number]>; // [row, height] pairs
    colWidths?: Array<[number, number]>; // [col, width] pairs
    hiddenRows?: number[];
    hiddenCols?: number[];
    frozenRows?: number;
    frozenCols?: number;
    showGridLines?: boolean;
    sortOrder?: SortOrder[];
    filters?: Array<[number, ColumnFilter]>; // [column, filter] pairs
  };
  rowCount: number;
  colCount: number;
}

export interface FormulaNode {
  cellKey: string;
  formula: string;
  dependencies: Set<string>; // cellKeys this formula depends on
  dependents: Set<string>; // cellKeys that depend on this formula
  cachedValue?: CellValue;
  isDirty: boolean;
}

export interface FormulaGraph {
  nodes: Map<string, FormulaNode>;
  addFormula(cellKey: string, formula: string, dependencies: Set<string>): void;
  removeFormula(cellKey: string): void;
  getDependents(cellKey: string): Set<string>;
  getDependencies(cellKey: string): Set<string>;
  invalidate(cellKey: string): void;
  getDirtyCells(): Set<string>;
}

export type EventType =
  | 'cellChange'
  | 'cellSelection'
  | 'sheetChange'
  | 'sheetAdd'
  | 'sheetDelete'
  | 'sheetRename'
  | 'workbookChange';

export interface EventData {
  type: EventType;
  payload: unknown;
}

export type EventHandler = (data: EventData) => void;

