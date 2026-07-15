# Spindle Sheets — Architecture

This page covers the spreadsheet architecture end to end: first the framework-agnostic **core package** — the data model, storage, and business logic — and then the **React layer** that renders it. For a high-level tour and the design principles, start with the **[Overview](../overview.md)**.

The core package implements the fundamental spreadsheet data model and business logic, designed to be framework-agnostic and optimized for performance.

## Workbook and Sheet Models

### Workbook Structure

The `WorkbookImpl` class in `packages/sheets-core/src/workbook.ts` is the central data model:

```typescript
export class WorkbookImpl implements Workbook {
  id: string;
  name: string;
  sheets: Map<string, Sheet> = new Map();
  activeSheetId: string;
  defaultRowHeight: number;
  defaultColWidth: number;

  // Core systems
  private events: EventEmitter;
  private formulaGraph: FormulaGraphImpl;
  private stylePool: StylePool;
  private formatPool: FormatPool;
  private formulaParser: FormulaParser;
  private selection: Selection;
}
```

Key responsibilities:

- **Sheet management**: Add, delete, and switch between sheets
- **Cell operations**: Set/get cell values, styles, and formulas
- **Selection management**: Track active cell and selection ranges
- **Undo/redo**: Maintain history stack for operations
- **Event coordination**: Emit events for UI updates
- **Data serialization**: Convert to/from JSON format

### Sheet Structure

Each sheet represents a single worksheet with sparse cell storage:

```typescript
interface Sheet {
  id: string;
  name: string;
  cells: Map<string, Cell>;  // Sparse storage: key format "row:col"
  config: SheetConfig;
  rowCount: number;
  colCount: number;
}
```

The sheet configuration includes:

- Default row/column dimensions
- Row heights and column widths (Map-based overrides)
- Hidden rows/columns
- Frozen panes settings
- Sort and filter configurations

## Sparse Cell Storage

### Cell Key Format

Cells are stored using a string key format `"row:col"` for efficient Map-based storage:

```typescript
// packages/sheets-core/src/utils/cell-key.ts
export function getCellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function parseCellKey(key: string): { row: number; col: number } {
  const [row, col] = key.split(':').map(Number);
  return { row, col };
}
```

This approach provides:

- **Memory efficiency**: Only non-empty cells consume memory
- **Fast lookups**: O(1) access time
- **Serialization compatibility**: String keys work well with JSON
- **Range operations**: Easy iteration over cell ranges

### Cell Structure

Each cell contains the core data:

```typescript
interface Cell {
  value: CellValue;           // string | number | boolean | null
  formula?: string;           // Raw formula text (e.g., "=A1+B1")
  styleId?: string;           // Reference to shared style
  formatId?: string;          // Reference to shared format
  comment?: string;
  hyperlink?: string;
}
```

Cell values are stored as raw data, with formulas parsed separately.

## Style and Format Pooling

### Style Pool

Styles are pooled to reduce memory usage and enable efficient rendering:

```typescript
// packages/sheets-core/src/style-pool.ts
export class StylePool {
  private styles: Map<string, CellStyle> = new Map();
  private styleToId: Map<string, string> = new Map();

  getOrCreate(style: CellStyle): string {
    const styleKey = this.getStyleKey(style);
    const existingId = this.styleToId.get(styleKey);
    if (existingId) return existingId;

    const id = `style_${this.nextId++}`;
    this.styles.set(id, style);
    this.styleToId.set(styleKey, id);
    return id;
  }
}
```

Benefits:

- **Memory sharing**: Identical styles share the same object
- **Serialization efficiency**: Style objects are not duplicated
- **Fast comparison**: Style keys enable quick equality checks
- **Render optimization**: Style pooling reduces DOM/CSS operations

### Format Pool

Similar pooling system for number/text formats:

```typescript
export class FormatPool {
  // Similar implementation to StylePool
  getOrCreate(format: CellFormat): string {
    // Creates deterministic key from format properties
  }
}
```

Format objects include:

- Number formatting (decimal places, thousands separators)
- Currency formatting (symbol, position)
- Date/time formatting patterns
- Custom format patterns

## Event System

### Event Architecture

The event system enables loose coupling between the core and UI layers:

```typescript
// packages/sheets-core/src/event-emitter.ts
export class EventEmitter {
  private handlers: Map<EventType, Set<EventHandler>> = new Map();
  private batchQueue: EventData[] = [];
  private isBatching = false;

  emit(event: EventType, payload: unknown): void {
    if (this.isBatching) {
      this.batchQueue.push(data);
      return;
    }
    this.dispatch(data);
  }

  batch(operations: () => void): void {
    this.isBatching = true;
    this.batchQueue = [];
    try {
      operations();
    } finally {
      this.isBatching = false;
      // Dispatch all batched events
      for (const event of events) {
        this.dispatch(event);
      }
    }
  }
}
```

### Event Types

Core events include:

```typescript
type EventType =
  | 'cellChange'
  | 'cellSelection'
  | 'sheetChange'
  | 'sheetAdd'
  | 'sheetDelete'
  | 'sheetRename'
  | 'workbookChange';
```

### Event Batching

Operations that modify multiple cells batch events to prevent excessive re-renders:

```typescript
workbook.batch(() => {
  // Multiple cell updates batched into single event dispatch
  workbook.setCellValue(undefined, 0, 0, 'A');
  workbook.setCellValue(undefined, 0, 1, 'B');
  workbook.setCellValue(undefined, 0, 2, 'C');
});
// All changes dispatched as single batch
```

## Undo/Redo Mechanism

### History Management

The undo/redo system maintains snapshots of workbook state:

```typescript
// packages/sheets-core/src/workbook.ts
interface WorkbookSnapshot {
  sheets: Map<string, SheetSnapshot>;
  activeSheetId: string;
  selection: Selection;
}

private undoStack: WorkbookSnapshot[] = [];
private redoStack: WorkbookSnapshot[] = [];
private maxHistorySize = 50;
```

### Operation Recording

History is recorded automatically for destructive operations:

```typescript
private recordHistory(): void {
  if (this.isUndoing || this.isRedoing) return;

  const snapshot = this.createSnapshot();
  this.undoStack.push(snapshot);

  // Limit history size
  if (this.undoStack.length > this.maxHistorySize) {
    this.undoStack.shift();
  }

  // Clear redo stack on new operation
  this.redoStack = [];
}
```

### Undo/Redo Implementation

```typescript
undo(): boolean {
  if (this.undoStack.length === 0) return false;

  const currentSnapshot = this.createSnapshot();
  const previousSnapshot = this.undoStack.pop()!;

  this.redoStack.push(currentSnapshot);
  this.restoreSnapshot(previousSnapshot);

  return true;
}
```

## Data Serialization

### WorkbookData Format

The serialization format is optimized for size and compatibility:

```typescript
interface WorkbookData {
  id: string;
  name: string;
  activeSheetId: string;
  defaultRowHeight: number;
  defaultColWidth: number;
  stylePool: Record<string, CellStyle>;    // styleId -> style object
  formatPool?: Record<string, CellFormat>; // formatId -> format object
  sheets: SheetData[];
  selection?: Selection;
}
```

### SheetData Format

Sheet data includes sparse cell storage:

```typescript
interface SheetData {
  id: string;
  name: string;
  cells: Array<{ key: string; cell: Cell }>; // key format: "row:col"
  config: SheetConfig;
  rowCount: number;
  colCount: number;
}
```

### Serialization Benefits

- **Compact**: Only non-empty cells are stored
- **Efficient**: Style/format objects are deduplicated
- **Compatible**: Plain JSON format works across platforms
- **Version safe**: Optional fields allow backward compatibility

## Core Systems Integration

The workbook coordinates multiple specialized systems:

```mermaid
graph TD
    A[WorkbookImpl] --> B[EventEmitter]
    A --> C[FormulaGraph]
    A --> D[StylePool]
    A --> E[FormatPool]
    A --> F[FormulaParser]
    A --> G[CanvasRenderer]
    A --> H[CollaborationProvider]

    B --> I[UI Updates]
    C --> J[Formula Recalculation]
    D --> K[Style Sharing]
    E --> L[Format Sharing]
    F --> M[Formula Parsing]
    G --> N[Canvas Rendering]
    H --> O[Real-time Sync]
```

Each system is designed for specific responsibilities while maintaining clean interfaces for integration.


---

## React Layer Architecture

The sheets package provides React components that create the spreadsheet UI, bridging the framework-agnostic core with React's component model.

At its core, the sheets implementation combines the efficiency of HTML5 canvas rendering with the flexibility of DOM-based editing. The canvas element handles the heavy lifting of drawing the spreadsheet grid, cell borders, text content, and visual formatting for thousands of cells simultaneously, providing smooth scrolling and high performance even with large datasets. When a user double-clicks a cell or starts typing, a DOM-based edit overlay appears positioned exactly over that cell, providing the familiar text input experience that browsers excel at.

All spreadsheet state is managed through a central workbook object that acts as the single source of truth, containing sheets, cells, formulas, and metadata. This workbook uses an event-driven approach, emitting notifications whenever data changes, which triggers React components to update their displays and keeps the entire UI synchronized. The workbook also manages complex features like multi-sheet navigation, cell references, and calculation dependencies.

Visual styling and data formatting are handled through dedicated style and format pools that store reusable definitions separately from cell data. This approach minimizes memory usage by avoiding duplication - a style definition is stored once and referenced by multiple cells. During rendering, these pools are consulted to apply the correct visual appearance, from number formatting (currency, percentages) to cell styling (colors, borders, fonts), ensuring consistent presentation across the spreadsheet.

Keyboard handling is split between the canvas and the edit overlay. When not editing, the canvas handles navigation keys (arrow keys, Tab, Enter) to move between cells and selection keys (Shift+arrows) to extend selections. Once editing begins, focus shifts to the edit overlay, which handles text input, formula editing (such as reference insertion), and commit/cancel actions (Enter to save, Escape to cancel).

### Architecture Overview

#### Component Hierarchy

The sheets package follows a layered architecture:

```mermaid
graph TD
    A[WorkbookProvider] --> B[WorkbookCanvas]
    B --> C[Toolbar]
    B --> D[FormulaBar]
    B --> E[CanvasGrid]
    B --> F[EditOverlay]
    B --> G[SheetTabs]
    B --> H[Modal Components]

    E --> I[CanvasRenderer]
    I --> J[GridRenderer]
    I --> K[CellRenderer]
    I --> L[TextRenderer]

    F --> M[DOM Input]
    F --> N[Formula Reference Overlay]
```

#### WorkbookContext Pattern

State management uses React Context with event-driven updates:

```typescript
// packages/sheets-react/src/context/WorkbookContext.tsx
interface WorkbookContextValue {
  workbook: WorkbookImpl;
  updateWorkbook: (updater: (wb: WorkbookImpl) => void) => void;
}

export function WorkbookProvider({ workbook: initialWorkbook, children }) {
  const [workbook] = useState<WorkbookImpl>(initialWorkbook);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // Subscribe to workbook events
  useEffect(() => {
    const handleCellChange = () => setUpdateTrigger(prev => prev + 1);
    const handleSheetChange = () => setUpdateTrigger(prev => prev + 1);

    workbook.on('cellChange', handleCellChange);
    workbook.on('sheetChange', handleSheetChange);
    // ... other event handlers

    return () => {
      workbook.off('cellChange', handleCellChange);
      workbook.off('sheetChange', handleSheetChange);
      // ... cleanup
    };
  }, [workbook]);

  const updateWorkbook = useCallback((updater: (wb: WorkbookImpl) => void) => {
    updater(workbook);
    setUpdateTrigger(prev => prev + 1);
  }, [workbook]);

  return (
    <WorkbookContext.Provider value={{ workbook, updateWorkbook }}>
      {children}
    </WorkbookContext.Provider>
  );
}
```

### WorkbookCanvas Component

#### Main Component Structure

WorkbookCanvas is the root component that orchestrates all UI elements:

```typescript
// packages/sheets-react/src/components/WorkbookCanvas.tsx
export const WorkbookCanvas = memo(function WorkbookCanvas({
  className,
  style,
  width = 800,
  height = 600,
  rowHeight = 20,
  colWidth = 100,
}: WorkbookCanvasProps) {
  const { workbook } = useWorkbook();

  // State management
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [editValue, setEditValue] = useState('');

  // Layout calculations
  const toolbarHeight = 44;
  const formulaBarHeight = 32;
  const sheetTabsHeight = 36;
  const canvasAreaHeight = height - toolbarHeight - formulaBarHeight - sheetTabsHeight;

  return (
    <div className={className} style={{ ...style, width, height }}>
      <Toolbar
        onFormatCells={() => setFormatModal({ isOpen: true })}
        onFilter={() => setFilterModal({ isOpen: true, column: activeCell?.col })}
      />

      <FormulaBar
        activeCell={activeCell}
        value={editingCell ? editValue : workbook.getCellValue()?.toString() || ''}
        onChange={setEditValue}
        onCommit={handleFormulaBarCommit}
      />

      <div style={{ height: canvasAreaHeight, position: 'relative' }}>
        <CanvasGrid
          width={width}
          height={canvasAreaHeight}
          activeCell={activeCell}
          onActiveCellChange={setActiveCell}
          onCellEdit={handleCellEdit}
          // ... other props
        />

        {editingCell && (
          <EditOverlay
            cell={editingCell}
            value={editValue}
            onChange={setEditValue}
            onCommit={handleCellCommit}
            onCancel={handleCellCancel}
            // ... positioning props
          />
        )}
      </div>

      <SheetTabs
        sheets={workbook.sheets}
        activeSheetId={workbook.activeSheetId}
        onSheetSelect={handleSheetSelect}
        onSheetAdd={handleSheetAdd}
        onSheetDelete={handleSheetDelete}
      />

      {/* Modal dialogs */}
      {filterModal?.isOpen && (
        <FilterModal
          column={filterModal.column}
          existingFilter={filterModal.existingFilter}
          onApply={handleFilterApply}
          onClose={() => setFilterModal(null)}
        />
      )}
    </div>
  );
});
```

#### Layout Management

The component manages complex layout calculations:

```typescript
// Calculate available space for canvas
const toolbarHeight = 44;
const formulaBarHeight = 32;
const sheetTabsHeight = 36;
const canvasAreaHeight = height - toolbarHeight - formulaBarHeight - sheetTabsHeight;
const canvasAreaWidth = width;

// Position edit overlay relative to cell
const cellBounds = calculateCellBounds(editingCell.row, editingCell.col);
const overlayX = cellBounds.x;
const overlayY = cellBounds.y;
const overlayWidth = Math.max(cellBounds.width, 100); // Minimum width
```

#### Event Coordination

WorkbookCanvas coordinates between multiple event sources:

```typescript
// Handle cell editing workflow
const handleCellEdit = useCallback((cell: CellPosition, initialValue: string) => {
  setEditingCell(cell);
  setEditValue(initialValue);
  setOriginalEditingSheetId(workbook.activeSheetId);
}, [workbook.activeSheetId]);

const handleCellCommit = useCallback((value: string) => {
  if (editingCell) {
    workbook.setCellValue(undefined, editingCell.row, editingCell.col, value);
  }
  setEditingCell(null);
  setEditValue('');
  setOriginalEditingSheetId(null);
}, [editingCell, workbook]);

const handleCellCancel = useCallback(() => {
  setEditingCell(null);
  setEditValue('');
  setOriginalEditingSheetId(null);
}, [editingCell]);
```

### CanvasGrid Component

#### Canvas Integration

CanvasGrid bridges React with the canvas rendering system:

```typescript
// packages/sheets-react/src/components/CanvasGrid.tsx
export const CanvasGrid = memo(function CanvasGrid({
  width,
  height,
  rowHeight = 20,
  colWidth = 100,
  activeCell,
  onActiveCellChange,
  onCellEdit,
  onSelectionChange,
  onScroll,
  // ... other props
}: CanvasGridProps) {
  const { workbook } = useWorkbook();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

  // Initialize renderer
  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new CanvasRenderer({
        canvas: canvasRef.current,
        defaultRowHeight: rowHeight,
        defaultColWidth: colWidth,
        // ... config
      });
    }
  }, [rowHeight, colWidth]);

  // Update render state when workbook changes
  useEffect(() => {
    if (!rendererRef.current) return;

    const sheet = workbook.getSheet();
    const renderState: RenderState = {
      cells: sheet.cells,
      styles: workbook.stylePool.getAllStyles(),
      formats: workbook.formatPool.getAllFormats(),
      selection: workbook.selection,
      activeCell,
      editingCell,
      // ... other state
    };

    rendererRef.current.updateRenderState(renderState);
    rendererRef.current.render();
  }, [workbook, activeCell, editingCell, dimensionVersion]);
});
```

#### Mouse Event Handling

CanvasGrid translates canvas events to React callbacks:

```typescript
const handleCanvasClick = useCallback((event: React.MouseEvent) => {
  if (!canvasRef.current || !rendererRef.current) return;

  const rect = canvasRef.current.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const hitResult = rendererRef.current.hitTest(x, y);

  if (hitResult.type === 'cell') {
    onActiveCellChange(hitResult.cell);
  } else if (hitResult.type === 'header') {
    handleHeaderClick(hitResult);
  }
}, [onActiveCellChange]);

const handleCanvasDoubleClick = useCallback((event: React.MouseEvent) => {
  const hitResult = getHitResult(event);

  if (hitResult.type === 'cell') {
    const cell = workbook.getCell(hitResult.cell.row, hitResult.cell.col);
    const initialValue = cell?.value?.toString() || '';
    onCellEdit(hitResult.cell, initialValue);
  }
}, [workbook, onCellEdit]);
```

#### Scroll Synchronization

CanvasGrid manages scroll state and synchronization:

```typescript
const [scrollTop, setScrollTop] = useState(0);
const [scrollLeft, setScrollLeft] = useState(0);

const handleScroll = useCallback((newScrollTop: number, newScrollLeft: number) => {
  setScrollTop(newScrollTop);
  setScrollLeft(newScrollLeft);

  // Update renderer viewport
  rendererRef.current?.setViewport({
    scrollTop: newScrollTop,
    scrollLeft: newScrollLeft,
    width,
    height,
  });

  // Notify parent
  onScroll?.(newScrollTop, newScrollLeft);
}, [width, height, onScroll]);
```

### EditOverlay Component

#### DOM Overlay Architecture

EditOverlay provides DOM-based text input over the canvas:

```typescript
// packages/sheets-react/src/components/EditOverlay.tsx
export const EditOverlay = memo(forwardRef<EditOverlayRef, EditOverlayProps>(
  function EditOverlay({
    cell,
    value,
    onChange,
    onCommit,
    onCancel,
    x,
    y,
    width,
    height,
    minWidth = 100,
    fontSize = 11,
    fontFamily = 'Arial',
    isEditingFormula = false,
    cellFormat,
  }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Position overlay to match cell bounds
    const overlayStyle: React.CSSProperties = {
      position: 'absolute',
      left: x,
      top: y,
      width: Math.max(width, minWidth),
      height: height,
      fontSize,
      fontFamily,
      // Match canvas cell styling
      border: '2px solid #0078d4',
      backgroundColor: 'white',
      padding: '0 2px',
      outline: 'none',
      zIndex: 1000,
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        onCommit(value);
      } else if (event.key === 'Escape') {
        onCancel();
      } else if (event.key === 'Tab') {
        // Handle tab navigation
        event.preventDefault();
        handleTabNavigation(event.shiftKey);
      }
    };

    useImperativeHandle(ref, () => ({
      insertAtCursor: (text: string, replaceExisting = false) => {
        // Insert text at cursor position
      },
      getCursorPosition: () => {
        return inputRef.current?.selectionStart || 0;
      },
      focus: () => {
        inputRef.current?.focus();
      },
    }), []);

    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        style={overlayStyle}
        autoFocus
      />
    );
  }
));
```

#### Formula Editing Features

EditOverlay supports advanced formula editing:

```typescript
// Handle formula reference insertion
const handleReferenceInsert = useCallback((reference: string) => {
  if (!inputRef.current) return;

  const start = inputRef.current.selectionStart || 0;
  const end = inputRef.current.selectionEnd || 0;
  const newValue = value.substring(0, start) + reference + value.substring(end);

  onChange(newValue);

  // Restore cursor position after reference
  setTimeout(() => {
    inputRef.current?.setSelectionRange(start + reference.length, start + reference.length);
  }, 0);
}, [value, onChange]);
```

### Context Menu System

#### Dynamic Context Menus

Context menus adapt based on selection type:

```typescript
type ContextMenuType =
  | { type: 'cell'; cell: CellPosition; x: number; y: number }
  | { type: 'row'; index: number; x: number; y: number }
  | { type: 'column'; index: number; x: number; y: number };

const handleContextMenu = useCallback((menuType: ContextMenuType) => {
  setContextMenu(menuType);
}, []);

const renderContextMenu = () => {
  if (!contextMenu) return null;

  switch (contextMenu.type) {
    case 'cell':
      return (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onDelete={handleDelete}
          onInsertRow={handleInsertRow}
          onInsertColumn={handleInsertColumn}
        />
      );
    case 'row':
      return (
        <HeaderContextMenu
          type="row"
          index={contextMenu.index}
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={handleDeleteRow}
          onInsert={handleInsertRow}
        />
      );
  }
};
```

### Modal Dialog Management

#### State-Based Modals

Modals are managed through component state:

```typescript
const [filterModal, setFilterModal] = useState<{
  isOpen: boolean;
  column: number;
  existingFilter?: ColumnFilter;
} | null>(null);

const [formatModal, setFormatModal] = useState<{
  isOpen: boolean;
  currentFormat?: CellFormat;
  sampleValue?: number;
} | null>(null);

// Open filter modal
const handleFilterClick = useCallback(() => {
  if (!activeCell) return;

  const sheet = workbook.getSheet();
  const existingFilter = sheet.config.filters?.get(activeCell.col);

  setFilterModal({
    isOpen: true,
    column: activeCell.col,
    existingFilter,
  });
}, [activeCell, workbook]);

// Handle filter application
const handleFilterApply = useCallback((filter: ColumnFilter) => {
  workbook.setFilter(activeCell!.col, filter);
  setFilterModal(null);
}, [activeCell, workbook]);
```

### Performance Optimizations

#### Memoization

Components use React.memo to prevent unnecessary re-renders:

```typescript
export const WorkbookCanvas = memo(function WorkbookCanvas(props) {
  // Component logic
});

export const CanvasGrid = memo(function CanvasGrid(props) {
  // Component logic
});
```

#### Ref-Based Communication

Direct refs avoid prop drilling for performance-critical operations:

```typescript
const editOverlayRef = useRef<EditOverlayRef>(null);

// Direct communication with edit overlay
const insertCellReference = useCallback((reference: string) => {
  editOverlayRef.current?.insertAtCursor(reference, false);
}, []);
```

#### Event Debouncing

Rapid events are debounced to improve performance:

```typescript
const debouncedScroll = useMemo(
  () => debounce((scrollTop: number, scrollLeft: number) => {
    handleScroll(scrollTop, scrollLeft);
  }, 16), // ~60fps
  [handleScroll]
);
```

### State Synchronization

#### Workbook to React State

Workbook changes trigger React re-renders through context:

```typescript
// In WorkbookProvider
useEffect(() => {
  const handleCellChange = () => {
    setUpdateTrigger(prev => prev + 1);
  };

  workbook.on('cellChange', handleCellChange);

  return () => {
    workbook.off('cellChange', handleCellChange);
  };
}, [workbook]);
```

#### React to Workbook Updates

UI actions update the workbook directly:

```typescript
const updateWorkbook = useCallback((updater: (wb: WorkbookImpl) => void) => {
  updater(workbook);
  setUpdateTrigger(prev => prev + 1); // Trigger re-render
}, [workbook]);
```

The sheets package provides a clean React interface to the core spreadsheet engine, with optimized rendering and comprehensive user interactions.
