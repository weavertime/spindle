# Data Structures Reference

This document provides comprehensive reference for all data structures and type definitions used throughout the Spindle library.

## Core Types

### CellValue

The basic data type for cell content.

```typescript
type CellValue = string | number | boolean | null;
```

**Usage:**
- `string`: Text content
- `number`: Numeric values (integers, floats)
- `boolean`: True/false values
- `null`: Empty cells

### Cell

Represents a single cell's complete state.

```typescript
interface Cell {
  value: CellValue;
  formula?: string;        // Raw formula text (e.g., "=A1+B1")
  styleId?: string;        // Reference to shared style
  formatId?: string;       // Reference to shared format
  comment?: string;        // Cell comment/note
  hyperlink?: string;      // URL for hyperlinks
}
```

**Key Properties:**
- **value**: The computed/display value
- **formula**: Original formula text (if applicable)
- **styleId/formatId**: References to pooled style/format objects
- **comment**: User annotations
- **hyperlink**: Clickable URLs

## Style and Formatting

### CellStyle

Defines visual appearance of cells.

```typescript
interface CellStyle {
  // Font properties
  bold?: boolean;
  italic?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;

  // Background
  backgroundColor?: string;

  // Text alignment
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';

  // Borders (individual edges)
  borderTop?: string;      // CSS border shorthand (e.g., "1px solid #000")
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;

  // Text formatting
  textWrap?: boolean;
  textDecoration?: 'none' | 'underline' | 'line-through';
}
```

**CSS Integration:**
Styles are designed to work directly with CSS properties, making rendering straightforward.

### CellFormat

Defines number/text formatting rules.

```typescript
interface CellFormat {
  type?: FormatType;

  // Number format options
  decimalPlaces?: number;     // 0-30
  useThousandsSeparator?: boolean;

  // Currency format options
  currencyCode?: string;      // USD, EUR, GBP, etc.
  currencySymbolPosition?: 'prefix' | 'suffix';

  // Negative number display
  negativeFormat?: 'minus' | 'parentheses' | 'red';

  // Date/Time format options
  dateFormat?: string;        // e.g., 'MM/DD/YYYY', 'DD-MM-YYYY'
  timeFormat?: string;        // e.g., 'HH:mm:ss', 'h:mm AM/PM'

  // Fraction format options
  fractionType?: 'upToOne' | 'upToTwo' | 'upToThree' | 'asHalves' | 'asQuarters';

  // Duration format options
  durationFormat?: 'hours' | 'minutes' | 'seconds' | 'milliseconds';

  // Custom format pattern
  pattern?: string;           // Custom number format pattern
}

type FormatType =
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
  | 'custom';
```

**Format Types:**
- **text**: No special formatting
- **number**: Decimal numbers with separators
- **currency**: Monetary values with symbols
- **percentage**: Values multiplied by 100 with % symbol
- **date/time**: Date and time representations
- **custom**: User-defined patterns

## Geometric Types

### Range

Represents a rectangular cell range.

```typescript
interface Range {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}
```

**Usage:**
- Selection ranges
- Formula ranges (e.g., SUM(A1:B10))
- Fill operations
- Copy/paste operations

### Selection

Represents the current user selection state.

```typescript
interface Selection {
  ranges: Range[];           // Multiple ranges can be selected
  activeCell: { row: number; col: number };  // Primary cursor position
}
```

**Selection Types:**
- **Single cell**: One range with startRow === endRow && startCol === endCol
- **Cell range**: Rectangular selection
- **Multiple ranges**: Non-contiguous selections (Ctrl+click)

### CellPosition

Simple coordinate for a specific cell.

```typescript
interface CellPosition {
  row: number;
  col: number;
}
```

Used throughout the API for cell identification.

## Sheet and Workbook

### SheetConfig

Configuration for sheet appearance and behavior.

```typescript
interface SheetConfig {
  // Dimensions
  defaultRowHeight?: number;
  defaultColWidth?: number;
  rowHeights?: Map<number, number>;    // row -> height overrides
  colWidths?: Map<number, number>;     // col -> width overrides

  // Visibility
  hiddenRows?: Set<number>;
  hiddenCols?: Set<number>;

  // Freeze panes
  frozenRows?: number;
  frozenCols?: number;

  // Appearance
  showGridLines?: boolean;

  // Data operations
  sortOrder?: SortOrder[];
  filters?: Map<number, ColumnFilter>;
}
```

### Sheet

Represents a single worksheet.

```typescript
interface Sheet {
  id: string;
  name: string;
  cells: Map<string, Cell>;  // Key format: "row:col"
  config: SheetConfig;
  rowCount: number;
  colCount: number;

  // Sorting methods
  setSortOrder(sortOrder: SortOrder[]): void;
  getSortOrder(): SortOrder[];
  clearSort(): void;
  hasSort(): boolean;

  // Filtering methods
  setFilter(column: number, filter: ColumnFilter): void;
  clearFilter(column: number): void;
  getFilters(): Map<number, ColumnFilter>;
  hasFilter(column: number): boolean;
  clearAllFilters(): void;
}
```

**Key Properties:**
- **cells**: Sparse storage using string keys
- **config**: Sheet-specific configuration
- **rowCount/colCount**: Virtual sheet size (not actual data bounds)

### Workbook

The main spreadsheet document interface.

```typescript
interface Workbook {
  id: string;
  name: string;
  sheets: Map<string, Sheet>;
  activeSheetId: string;
  defaultRowHeight: number;
  defaultColWidth: number;

  // Sheet management
  addSheet(name: string): Sheet;
  deleteSheet(sheetId: string): void;
  getSheet(sheetId?: string): Sheet;

  // Cell operations
  setCellValue(sheetId: string | undefined, row: number, col: number, value: CellValue): void;
  getCellValue(sheetId: string | undefined, row: number, col: number): CellValue;
  getCell(sheetId: string | undefined, row: number, col: number): Cell | undefined;

  // Selection
  getSelection(sheetId?: string): Selection;
  setSelection(selection: Selection, sheetId?: string): void;

  // Sorting
  setSortOrder(sortOrder: SortOrder[], sheetId?: string): void;
  clearSort(sheetId?: string): void;
  sortSheet(sheetId?: string): void;

  // Filtering
  setFilter(column: number, filter: ColumnFilter, sheetId?: string): void;
  clearFilter(column: number, sheetId?: string): void;
  getFilters(sheetId?: string): Map<number, ColumnFilter>;
  clearAllFilters(sheetId?: string): void;

  // History
  recordHistory(): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;

  // Serialization
  getData(): WorkbookData;
  setData(data: WorkbookData): void;
  setOnSave(callback: (data: WorkbookData) => void): void;
}
```

## Serialization

### WorkbookData

Complete workbook serialization format.

```typescript
interface WorkbookData {
  id: string;
  name: string;
  activeSheetId: string;
  defaultRowHeight: number;
  defaultColWidth: number;

  // Pooled resources
  stylePool: Record<string, CellStyle>;      // styleId -> style object
  formatPool?: Record<string, CellFormat>;   // formatId -> format object

  // Sheet data
  sheets: SheetData[];

  // UI state (optional)
  selection?: Selection;
}
```

### SheetData

Individual sheet serialization.

```typescript
interface SheetData {
  id: string;
  name: string;

  // Sparse cell data
  cells: Array<{ key: string; cell: Cell }>;  // key format: "row:col"

  // Configuration
  config: {
    defaultRowHeight?: number;
    defaultColWidth?: number;
    rowHeights?: Array<[number, number]>;     // [row, height] pairs
    colWidths?: Array<[number, number]>;      // [col, width] pairs
    hiddenRows?: number[];
    hiddenCols?: number[];
    frozenRows?: number;
    frozenCols?: number;
    showGridLines?: boolean;
    sortOrder?: SortOrder[];
    filters?: Array<[number, ColumnFilter]>;  // [column, filter] pairs
  };

  rowCount: number;
  colCount: number;
}
```

**Serialization Benefits:**
- **Compact**: Only non-empty cells stored
- **Efficient**: Style/format objects deduplicated
- **Compatible**: Plain JSON format
- **Version-safe**: Optional fields for backward compatibility

## Formula Engine

### FormulaNode

Represents a formula in the dependency graph.

```typescript
interface FormulaNode {
  cellKey: string;
  formula: string;
  dependencies: Set<string>;    // Cell keys this formula depends on
  dependents: Set<string>;      // Cell keys that depend on this formula
  cachedValue?: CellValue;
  isDirty: boolean;
}
```

### FormulaGraph

Manages formula dependencies for efficient recalculation.

```typescript
interface FormulaGraph {
  nodes: Map<string, FormulaNode>;

  addFormula(cellKey: string, formula: string, dependencies: Set<string>): void;
  removeFormula(cellKey: string): void;
  getDependents(cellKey: string): Set<string>;
  getDependencies(cellKey: string): Set<string>;
  invalidate(cellKey: string): void;
  getDirtyCells(): Set<string>;
}
```

## Sorting and Filtering

### SortOrder

Defines column sorting configuration.

```typescript
interface SortOrder {
  column: number;
  direction: 'asc' | 'desc';
}
```

### ColumnFilter

Defines filtering criteria for columns.

```typescript
interface ColumnFilter {
  column: number;
  type: 'text' | 'number' | 'date';
  criteria: FilterCriteria;
}

type FilterCriteria =
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
  | { type: 'custom'; values: Set<string | number> };
```

## Rendering Types

### RenderState

Complete state needed for canvas rendering.

```typescript
interface RenderState {
  cells: Map<string, Cell>;
  styles: Map<string, CellStyle>;
  formats: Map<string, CellFormat>;
  selection: Selection | null;
  activeCell: CellPosition | null;
  editingCell: CellPosition | null;
  rowHeights: Map<number, number>;
  colWidths: Map<number, number>;
  rowCount: number;
  colCount: number;
  formulaRanges?: FormulaRangeHighlight[];
  hiddenRows?: Set<number>;
  hiddenCols?: Set<number>;
  frozenRows?: number;
  frozenCols?: number;
  filters?: Map<number, ColumnFilter>;
  filteredRows?: Set<number>;
}
```

### Viewport

Current visible area state.

```typescript
interface Viewport {
  scrollTop: number;
  scrollLeft: number;
  width: number;
  height: number;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}
```

## Collaboration Types

### CollaborationOperation

Operations for real-time synchronization.

```typescript
interface CollaborationOperation {
  type: 'cellChange' | 'selectionChange' | 'sheetChange';
  sheetId: string;
  row?: number;
  col?: number;
  value?: unknown;
  selection?: { row: number; col: number };
  timestamp: number;
  userId: string;
}
```

### Presence

User presence information for collaboration.

```typescript
interface Presence {
  userId: string;
  username: string;
  color: string;
  selection?: { row: number; col: number };
  cursor?: { row: number; col: number };
  lastSeen?: number;
}
```

## Event System

### Event Types

```typescript
type EventType =
  | 'cellChange'
  | 'cellSelection'
  | 'sheetChange'
  | 'sheetAdd'
  | 'sheetDelete'
  | 'sheetRename'
  | 'workbookChange';

interface EventData {
  type: EventType;
  payload: unknown;
}

type EventHandler = (data: EventData) => void;
```

## Canvas Rendering

### Canvas Types

```typescript
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  textDecoration?: 'none' | 'underline' | 'line-through';
}

interface CanvasTheme {
  // Grid appearance
  gridLineColor: string;
  gridLineWidth: number;

  // Cell appearance
  cellBackgroundColor: string;
  cellBorderColor: string;

  // Selection colors
  selectionColor: string;
  activeCellColor: string;

  // Header colors
  headerBackgroundColor: string;
  headerTextColor: string;

  // Font settings
  defaultFontFamily: string;
  defaultFontSize: number;
}
```

## React Component Types

### Component Props

```typescript
interface WorkbookCanvasProps {
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
  rowHeight?: number;
  colWidth?: number;
}

type ContextMenuType =
  | { type: 'cell'; cell: CellPosition; x: number; y: number }
  | { type: 'row'; index: number; x: number; y: number }
  | { type: 'column'; index: number; x: number; y: number };
```

These data structures provide the foundation for the entire Spindle architecture, enabling efficient storage, rendering, and manipulation of spreadsheet data.
