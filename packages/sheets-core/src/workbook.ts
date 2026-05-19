// Workbook model

import type { Workbook, Sheet, Cell, Selection, CellValue, SortOrder, CellFormat, CellStyle, EventType, EventHandler } from './types';
import { SheetImpl } from './sheet';
import { EventEmitter } from './event-emitter';
import { FormulaGraphImpl } from './formula-graph';
import { StylePool } from './style-pool';
import { FormatPool } from './format-pool';
import { SortManager } from './features/sort';
import { getCellKey, getStableCellKey, parseCellKey } from './utils/cell-key';
import { FormulaParser } from './formula-parser';
import type { RangeReference, StableFormulaNode, SheetResolver } from './formula-parser';
import * as Y from 'yjs';
import { attachCollabToWorkbook } from './collab/binding';
import type { CollabHandle, AttachCollabOptions } from './collab/binding';
import {
  getWorkbookYTypes,
  getSheetYTypes,
  createSheetYMap,
} from './collab/y-schema';
import {
  toStableAst,
  fromStableAst,
  renderStableAst,
  collectStableDependencies,
  StableRefDeletedError,
} from './formula-parser/stable-ast';

// Snapshot for undo/redo
interface WorkbookSnapshot {
  sheets: Map<string, SheetSnapshot>;
  activeSheetId: string;
  selection: Selection;
}

interface SheetSnapshot {
  id: string;
  name: string;
  cells: Map<string, Cell>; // key: "rowId:colId"
  rowOrder: Map<number, string>;
  colOrder: Map<number, string>;
  config: Sheet['config'];
  rowCount: number;
  colCount: number;
}

export class WorkbookImpl implements Workbook {
  id: string;
  name: string;
  sheets: Map<string, Sheet> = new Map();
  activeSheetId: string;
  defaultRowHeight: number;
  defaultColWidth: number;

  private events: EventEmitter = new EventEmitter();
  private formulaGraph: FormulaGraphImpl = new FormulaGraphImpl();
  private stylePool: StylePool = new StylePool();
  private formatPool: FormatPool = new FormatPool();
  private formulaParser: FormulaParser = new FormulaParser();
  private selection: Selection = {
    ranges: [],
    activeCell: { row: 0, col: 0 },
  };
  private evaluatingCells: Set<string> = new Set(); // Track cells being evaluated to detect circular references
  private undoStack: WorkbookSnapshot[] = [];
  private redoStack: WorkbookSnapshot[] = [];
  private maxHistorySize = 50; // Limit history size to prevent memory issues
  private isUndoing = false; // Flag to prevent recording history during undo/redo
  private isRedoing = false;
  private isBatching = false; // Flag to track if we're in a batch operation
  // Set by attachCollab; consulted in places that need to know whether the
  // workbook is currently sourcing state from a Y.Doc.
  private collabHandle: CollabHandle | null = null;
  // True while _reloadFromCollab is rebuilding internal state from a remote
  // Y.Doc update. Mirror calls in mutation methods short-circuit when set,
  // otherwise we'd echo every remote write back over the wire.
  private isApplyingRemoteChange = false;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.defaultRowHeight = 20;
    this.defaultColWidth = 100;

    // Create default sheet
    const defaultSheet = this.addSheet('Sheet1');
    this.activeSheetId = defaultSheet.id;
  }

  addSheet(name: string): Sheet {
    const id = `sheet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sheet = new SheetImpl(id, name);
    this.sheets.set(id, sheet);
    this.mirrorSheetAdd(id, name, sheet);
    this.events.emit('sheetAdd', { sheetId: id, name });
    return sheet;
  }

  deleteSheet(sheetId: string): void {
    if (this.sheets.size <= 1) {
      throw new Error('Cannot delete the last sheet');
    }
    this.sheets.delete(sheetId);
    if (this.activeSheetId === sheetId) {
      // Switch to first available sheet
      this.activeSheetId = Array.from(this.sheets.keys())[0];
    }
    this.events.emit('sheetDelete', { sheetId });
  }

  getSheet(sheetId?: string): SheetImpl {
    const id = sheetId ?? this.activeSheetId;
    const sheet = this.sheets.get(id);
    if (!sheet) {
      throw new Error(`Sheet not found: ${id}`);
    }
    return sheet as SheetImpl;
  }

  setActiveSheet(sheetId: string): void {
    if (!this.sheets.has(sheetId)) {
      throw new Error(`Sheet not found: ${sheetId}`);
    }
    this.activeSheetId = sheetId;
    this.events.emit('sheetChange', { sheetId });
  }

  renameSheet(sheetId: string, newName: string): void {
    const sheet = this.getSheet(sheetId);
    const oldName = sheet.name;
    sheet.name = newName;
    this.events.emit('sheetRename', { sheetId, oldName, newName });
  }

  getSheetIdByName(sheetName: string): string | undefined {
    for (const [id, sheet] of this.sheets.entries()) {
      if (sheet.name === sheetName) {
        return id;
      }
    }
    return undefined;
  }

  getCell(sheetId: string | undefined, row: number, col: number): Cell | undefined {
    const sheet = this.getSheet(sheetId);
    return sheet.getCell(row, col);
  }

  /**
   * Build the FormulaGraph key for a (row, col) on the given sheet,
   * lazily materializing stable IDs if needed.
   */
  private graphKey(sheetId: string | undefined, row: number, col: number): string {
    const sheet = this.getSheet(sheetId);
    return getStableCellKey(sheet.ensureRowId(row), sheet.ensureColId(col));
  }

  /**
   * Resolver passed to the stable-AST converters so cross-sheet refs can
   * look up the target sheet's order maps.
   */
  private buildSheetResolver(): SheetResolver {
    return {
      getSheet: (name?: string): Sheet | undefined => {
        if (!name) return undefined;
        const id = this.getSheetIdByName(name);
        return id ? this.sheets.get(id) : undefined;
      },
    };
  }

  setCell(
    sheetId: string | undefined,
    row: number,
    col: number,
    cell: Partial<Cell>
  ): void {
    // Handle style pooling before storing
    if (cell.styleId) {
      // Style already pooled
    } else if (cell.styleId === undefined && 'style' in cell) {
      // Need to pool the style
      const styleId = this.stylePool.getOrCreate(cell.style as CellStyle);
      cell.styleId = styleId;
      delete (cell as Partial<Cell> & { style?: CellStyle }).style;
    }

    // Handle format pooling before storing
    if (cell.formatId) {
      // Format already pooled
    } else if (cell.formatId === undefined && 'format' in cell) {
      // Clean the format before pooling to ensure consistent keys
      const cleanedFormat = this.cleanFormat(cell.format as CellFormat);
      const formatId = this.formatPool.getOrCreate(cleanedFormat);
      cell.formatId = formatId;
      delete (cell as Partial<Cell> & { format?: CellFormat }).format;
    }

    const sheet = this.getSheet(sheetId);
    sheet.setCell(row, col, cell);

    this.mirrorCellWrite(sheet.id, row, col);

    this.events.emit('cellChange', {
      sheetId: sheet.id,
      row,
      col,
      cellKey: getCellKey(row, col),
    });
  }

  setCellValue(sheetId: string | undefined, row: number, col: number, value: unknown): void {
    // Record history before making changes (unless we're undoing/redoing or in a batch)
    if (!this.isUndoing && !this.isRedoing && !this.isBatching) {
      const currentCell = this.getCell(sheetId, row, col);
      const currentValue = currentCell?.value;
      if (currentValue !== value) {
        this.recordHistory();
      }
    }
    
    const cellKey = this.graphKey(sheetId, row, col);
    const hadFormula = this.formulaGraph.nodes.has(cellKey);

    // Remove formula if setting a direct value
    if (hadFormula) {
      this.formulaGraph.removeFormula(cellKey);
    }

    this.setCell(sheetId, row, col, { value: value as string | number | boolean | null });

    // Invalidate dependents of this cell
    if (hadFormula || this.getCell(sheetId, row, col)?.value !== undefined) {
      this.formulaGraph.invalidate(cellKey);
      this.recalculateDependents(cellKey, sheetId);
    }
  }

  getCellValue(sheetId: string | undefined, row: number, col: number): unknown {
    const cell = this.getCell(sheetId, row, col);
    return cell?.value ?? null;
  }

  setFormula(sheetId: string | undefined, row: number, col: number, formula: string): void {
    // Record history before making changes (unless we're undoing/redoing or in a batch)
    if (!this.isUndoing && !this.isRedoing && !this.isBatching) {
      const currentCell = this.getCell(sheetId, row, col);
      const currentFormula = currentCell?.formula;
      if (currentFormula !== formula) {
        this.recordHistory();
      }
    }
    
    const cellKey = this.graphKey(sheetId, row, col);
    const sheet = this.getSheet(sheetId);

    // Parse to numeric AST, then convert to stable AST (the source of truth).
    const parseResult = this.formulaParser.parse(formula, row, col);

    if (parseResult.error) {
      this.setCell(sheetId, row, col, { formula, value: parseResult.error as CellValue });
      return;
    }

    const resolver = this.buildSheetResolver();
    const formulaAst = toStableAst(parseResult.ast, resolver, sheet, row, col);
    const stableDeps = collectStableDependencies(formulaAst, sheet);

    this.formulaGraph.addFormula(cellKey, formula, stableDeps);

    // Store both AST (truth) and input string (display cache; gets refreshed
    // from the AST on every evaluation).
    this.setCell(sheetId, row, col, { formula, formulaAst });

    // Evaluate and store result
    this.evaluateFormula(sheetId, row, col);

    // Recalculate dependents
    this.recalculateDependents(cellKey, sheetId);
  }

  getSelection(): Selection {
    return { ...this.selection };
  }

  setSelection(selection: Selection): void {
    this.selection = selection;
    this.events.emit('cellSelection', { selection });
  }

  batch(operations: () => void): void {
    // Record history before batch operations (unless we're undoing/redoing)
    if (!this.isUndoing && !this.isRedoing) {
      this.isBatching = true;
      this.recordHistory();
    }
    this.events.batch(operations);
    this.isBatching = false;
  }

  on(event: EventType, handler: EventHandler): () => void {
    return this.events.on(event, handler);
  }

  off(event: EventType, handler: EventHandler): void {
    this.events.off(event, handler);
  }

  getFormulaGraph(): FormulaGraphImpl {
    return this.formulaGraph;
  }

  getStylePool(): StylePool {
    return this.stylePool;
  }

  getFormatPool(): FormatPool {
    return this.formatPool;
  }

  /**
   * Get the calculated value of a cell (evaluates formulas)
   */
  getCellCalculatedValue(sheetId: string | undefined, row: number, col: number): unknown {
    const cell = this.getCell(sheetId, row, col);
    const cellKey = this.graphKey(sheetId, row, col);
    
    // If cell has a formula, evaluate it
    if (cell?.formula) {
      const formulaNode = this.formulaGraph.nodes.get(cellKey);
      
      // Return cached value if available and not dirty
      if (formulaNode && !formulaNode.isDirty && formulaNode.cachedValue !== undefined) {
        return formulaNode.cachedValue;
      }
      
      // Check for circular reference BEFORE evaluating
      if (this.evaluatingCells.has(cellKey)) {
        // This cell is already being evaluated - circular reference!
        return '#CIRCULAR!';
      }
      
      // Evaluate formula
      return this.evaluateFormula(sheetId, row, col);
    }
    
    // Return direct value
    // For empty cells, return 0 (standard spreadsheet behavior for numeric formulas)
    // For cells with values, return the actual value (string, number, boolean, etc.)
    if (!cell) return 0;
    
    // Return the actual value - don't convert null/undefined to 0 here
    // The formula parser will handle type conversion as needed
    if (cell.value === null || cell.value === undefined) {
      return 0; // Empty cells return 0 for numeric calculations
    }
    
    return cell.value;
  }

  /**
   * Evaluate a formula and store the result
   */
  private evaluateFormula(sheetId: string | undefined, row: number, col: number): unknown {
    const cellKey = this.graphKey(sheetId, row, col);
    const cell = this.getCell(sheetId, row, col);
    
    if (!cell?.formula) {
      return cell?.value ?? null;
    }

    // Check for circular reference BEFORE adding to evaluatingCells
    if (this.evaluatingCells.has(cellKey)) {
      const error = '#CIRCULAR!';
      this.formulaGraph.markClean(cellKey, error);
      this.setCell(sheetId, row, col, { value: error });
      return error;
    }

    // Add to evaluating cells to detect circular references
    this.evaluatingCells.add(cellKey);

    try {
      const sheet = this.getSheet(sheetId);
      const resolver = this.buildSheetResolver();

      // Source of truth is cell.formulaAst (stable). If only the legacy
      // string is present, parse it and upgrade in place.
      let stableAst: StableFormulaNode | undefined = cell.formulaAst;
      if (!stableAst) {
        const parsed = this.formulaParser.parse(cell.formula, row, col);
        if (parsed.error) {
          this.evaluatingCells.delete(cellKey);
          this.formulaGraph.markClean(cellKey, parsed.error as CellValue);
          this.setCell(sheetId, row, col, { value: parsed.error as CellValue });
          return parsed.error;
        }
        stableAst = toStableAst(parsed.ast, resolver, sheet, row, col);
        // Persist the upgraded AST so future evaluations skip the re-parse.
        this.setCell(sheetId, row, col, { formulaAst: stableAst });
      }

      // Convert stable refs back to numeric for the evaluator. Any ref whose
      // target row/col ID has been deleted bubbles up as a #REF! error.
      let numericAst;
      try {
        numericAst = fromStableAst(stableAst, resolver, sheet, row, col);
      } catch (e) {
        if (e instanceof StableRefDeletedError) {
          this.evaluatingCells.delete(cellKey);
          this.formulaGraph.markClean(cellKey, '#REF!' as CellValue);
          this.setCell(sheetId, row, col, {
            value: '#REF!' as CellValue,
            formula: renderStableAst(stableAst, resolver, sheet),
          });
          return '#REF!';
        }
        throw e;
      }

      // Refresh the display string from the AST so the user sees A1
      // notation that tracks structural edits (insert/delete/sort).
      const refreshedFormula = renderStableAst(stableAst, resolver, sheet);

      const evaluationContext = {
        getCellValue: (r: number, c: number, sId?: string, sheetName?: string) => {
          let targetSheetId = sId ?? sheetId;
          if (sheetName) {
            const resolvedSheetId = this.getSheetIdByName(sheetName);
            if (resolvedSheetId) {
              targetSheetId = resolvedSheetId;
            } else {
              return '#REF!';
            }
          }
          return this.getCellCalculatedValue(targetSheetId, r, c);
        },
        getRangeValues: (range: RangeReference, sId?: string, sheetName?: string) => {
          let targetSheetId = sId ?? sheetId;
          if (sheetName) {
            const resolvedSheetId = this.getSheetIdByName(sheetName);
            if (resolvedSheetId) {
              targetSheetId = resolvedSheetId;
            } else {
              return [];
            }
          }
          return this.getRangeValues(targetSheetId, range, row, col);
        },
        getSheetIdByName: (sheetName: string) => {
          return this.getSheetIdByName(sheetName);
        },
      };

      const result = this.formulaParser.evaluate(numericAst, evaluationContext, row, col);
      
      // Handle division by zero
      if (typeof result === 'number' && !isFinite(result)) {
        const error = result === Infinity || result === -Infinity ? '#DIV/0!' : '#NUM!';
        this.evaluatingCells.delete(cellKey);
        this.formulaGraph.markClean(cellKey, error);
        this.setCell(sheetId, row, col, { value: error });
        return error;
      }

      // Store result with the refreshed display string. Keep formula AST.
      const cellValue = result as CellValue;
      this.evaluatingCells.delete(cellKey);
      this.formulaGraph.markClean(cellKey, cellValue);

      const currentCell = this.getCell(sheetId, row, col);
      if (currentCell) {
        this.setCell(sheetId, row, col, {
          ...currentCell,
          value: cellValue,
          formula: refreshedFormula,
        });
      }

      return result;
    } catch (error) {
      this.evaluatingCells.delete(cellKey);
      const errorMsg = error instanceof Error ? error.message : '#ERROR!';
      this.formulaGraph.markClean(cellKey, errorMsg as CellValue);
      this.setCell(sheetId, row, col, { value: errorMsg as CellValue });
      return errorMsg;
    }
  }

  /**
   * Get values from a range for formula evaluation
   * Note: Range references are already resolved to absolute positions during parsing,
   * but we keep the currentRow/currentCol parameters for consistency with the API
   */
  private getRangeValues(
    sheetId: string | undefined,
    range: RangeReference,
    currentRow: number,
    currentCol: number
  ): unknown[][] {
    const { start, end } = range;
    
    // Resolve relative references to absolute positions
    const startRow = start.rowAbsolute ? start.row : currentRow + start.row;
    const endRow = end.rowAbsolute ? end.row : currentRow + end.row;
    const startCol = start.colAbsolute ? start.col : currentCol + start.col;
    const endCol = end.colAbsolute ? end.col : currentCol + end.col;
    
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    
    const values: unknown[][] = [];
    for (let row = minRow; row <= maxRow; row++) {
      const rowValues: unknown[] = [];
      for (let col = minCol; col <= maxCol; col++) {
        rowValues.push(this.getCellCalculatedValue(sheetId, row, col));
      }
      values.push(rowValues);
    }
    
    return values;
  }

  /**
   * Recalculate all cells that depend on the given cell
   */
  private recalculateDependents(cellKey: string, sheetId: string | undefined): void {
    const dependents = this.formulaGraph.getDependents(cellKey);
    const sheet = this.getSheet(sheetId);

    for (const dependentKey of dependents) {
      // Invalidate dependent
      this.formulaGraph.invalidate(dependentKey);

      // Recalculate dependent (translate stable graph key back to current indices)
      const indices = sheet.stableKeyToIndices(dependentKey);
      if (!indices) continue;
      this.evaluateFormula(sheetId, indices.row, indices.col);
    }
  }

  /**
   * Create a snapshot of the current workbook state
   */
  private createSnapshot(): WorkbookSnapshot {
    const sheets = new Map<string, SheetSnapshot>();

    for (const [sheetId, sheet] of this.sheets.entries()) {
      // Deep clone cells (stable keys are immutable strings; cells get shallow-cloned)
      const cells = new Map<string, Cell>();
      for (const [key, cell] of sheet.cells.entries()) {
        cells.set(key, { ...cell });
      }

      // Snapshot order maps (cloned so later mutations don't leak in)
      const { rowOrder, colOrder } = sheet.snapshotOrderMaps();

      // Deep clone config
      const config = {
        ...sheet.config,
        rowHeights: sheet.config.rowHeights ? new Map(sheet.config.rowHeights) : undefined,
        colWidths: sheet.config.colWidths ? new Map(sheet.config.colWidths) : undefined,
        hiddenRows: sheet.config.hiddenRows ? new Set(sheet.config.hiddenRows) : undefined,
        hiddenCols: sheet.config.hiddenCols ? new Set(sheet.config.hiddenCols) : undefined,
      };

      sheets.set(sheetId, {
        id: sheet.id,
        name: sheet.name,
        cells,
        rowOrder,
        colOrder,
        config,
        rowCount: sheet.rowCount,
        colCount: sheet.colCount,
      });
    }

    return {
      sheets,
      activeSheetId: this.activeSheetId,
      selection: { ...this.selection },
    };
  }

  /**
   * Restore workbook state from a snapshot
   */
  private restoreSnapshot(snapshot: WorkbookSnapshot): void {
    // Clear existing sheets
    this.sheets.clear();
    
    // Restore sheets
    for (const [sheetId, sheetSnapshot] of snapshot.sheets.entries()) {
      const sheet = new SheetImpl(sheetSnapshot.id, sheetSnapshot.name, sheetSnapshot.config);
      sheet.rowCount = sheetSnapshot.rowCount;
      sheet.colCount = sheetSnapshot.colCount;

      // Restore order maps first so cell keys resolve to indices correctly.
      sheet.replaceOrderMaps(sheetSnapshot.rowOrder, sheetSnapshot.colOrder);

      // Restore cells (keys are already stable from the snapshot)
      for (const [key, cell] of sheetSnapshot.cells.entries()) {
        sheet.cells.set(key, { ...cell });
      }

      this.sheets.set(sheetId, sheet);
    }

    // Restore active sheet
    this.activeSheetId = snapshot.activeSheetId;

    // Restore selection
    this.selection = { ...snapshot.selection };

    // Rebuild formula graph. Prefer existing stable AST; parse + upgrade if absent.
    this.formulaGraph = new FormulaGraphImpl();
    const resolver = this.buildSheetResolver();
    for (const [sheetId, sheet] of this.sheets.entries()) {
      for (const [row, col, cell] of sheet.entries()) {
        if (!cell.formula && !cell.formulaAst) continue;
        let ast = cell.formulaAst;
        if (!ast && cell.formula) {
          const parsed = this.formulaParser.parse(cell.formula, row, col);
          if (parsed.error) continue;
          ast = toStableAst(parsed.ast, resolver, sheet, row, col);
          cell.formulaAst = ast;
        }
        if (!ast) continue;
        const cellKey = this.graphKey(sheetId, row, col);
        const deps = collectStableDependencies(ast, sheet);
        this.formulaGraph.addFormula(cellKey, cell.formula ?? '', deps);
      }
    }

    // Recalculate all formulas
    for (const [sheetId, sheet] of this.sheets.entries()) {
      for (const [row, col, cell] of sheet.entries()) {
        if (cell.formula) {
          this.evaluateFormula(sheetId, row, col);
        }
      }
    }
    
    // Emit change events
    this.events.emit('workbookChange', {});
    this.events.emit('sheetChange', { sheetId: this.activeSheetId });
    this.events.emit('cellSelection', { selection: this.selection });
  }

  /**
   * Record current state for undo
   */
  recordHistory(): void {
    if (this.isUndoing || this.isRedoing) {
      return; // Don't record history during undo/redo operations
    }
    
    const snapshot = this.createSnapshot();
    this.undoStack.push(snapshot);
    
    // Limit history size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
    
    // Clear redo stack when new action is performed
    this.redoStack = [];
  }

  /**
   * Undo the last operation
   */
  undo(): boolean {
    if (this.undoStack.length === 0) {
      return false;
    }
    
    // Save current state to redo stack
    const currentSnapshot = this.createSnapshot();
    this.redoStack.push(currentSnapshot);
    
    // Restore previous state
    const previousSnapshot = this.undoStack.pop()!;
    this.isUndoing = true;
    try {
      this.restoreSnapshot(previousSnapshot);
    } finally {
      this.isUndoing = false;
    }
    
    return true;
  }

  /**
   * Redo the last undone operation
   */
  redo(): boolean {
    if (this.redoStack.length === 0) {
      return false;
    }
    
    // Save current state to undo stack
    const currentSnapshot = this.createSnapshot();
    this.undoStack.push(currentSnapshot);
    
    // Restore next state
    const nextSnapshot = this.redoStack.pop()!;
    this.isRedoing = true;
    try {
      this.restoreSnapshot(nextSnapshot);
    } finally {
      this.isRedoing = false;
    }
    
    return true;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // ============================================
  // Data Serialization Methods
  // ============================================

  /**
   * Get complete workbook data for serialization
   */
  getData(): import('./types').WorkbookData {
    // Serialize style pool
    const stylePool: Record<string, import('./types').CellStyle> = {};
    for (const [styleId, style] of this.stylePool.getAllStyles()) {
      stylePool[styleId] = style;
    }

    // Serialize format pool
    const formatPool: Record<string, import('./types').CellFormat> = {};
    for (const [formatId, format] of this.formatPool.getAllFormats()) {
      formatPool[formatId] = format;
    }

    // Serialize sheets in the stable-ID wire format (phase 2a.6).
    const sheets: import('./types').SheetData[] = [];
    for (const sheet of this.sheets.values()) {
      // Cells: emit stable keys directly. The accompanying rowOrder/colOrder
      // entries below let consumers reconstruct numeric layout.
      const cells: Array<{ key: string; cell: import('./types').Cell }> = [];
      for (const [row, col, cell] of sheet.entries()) {
        const rowId = sheet.getRowId(row);
        const colId = sheet.getColId(col);
        if (!rowId || !colId) continue; // unreachable: entries() only yields cells with IDs
        cells.push({ key: `${rowId}:${colId}`, cell });
      }

      const orderSnapshot = sheet.snapshotOrderMaps();
      const rowOrder = Array.from(orderSnapshot.rowOrder.entries());
      const colOrder = Array.from(orderSnapshot.colOrder.entries());

      const config = {
        defaultRowHeight: sheet.config.defaultRowHeight,
        defaultColWidth: sheet.config.defaultColWidth,
        // Row/col config entries already use stable IDs internally — pass
        // them through directly.
        rowHeights: sheet.config.rowHeights
          ? Array.from(sheet.config.rowHeights.entries()) as Array<[string, number]>
          : undefined,
        colWidths: sheet.config.colWidths
          ? Array.from(sheet.config.colWidths.entries()) as Array<[string, number]>
          : undefined,
        hiddenRows: sheet.config.hiddenRows
          ? Array.from(sheet.config.hiddenRows) as string[]
          : undefined,
        hiddenCols: sheet.config.hiddenCols
          ? Array.from(sheet.config.hiddenCols) as string[]
          : undefined,
        frozenRows: sheet.config.frozenRows,
        frozenCols: sheet.config.frozenCols,
        showGridLines: sheet.config.showGridLines,
        sortOrder: sheet.config.sortOrder,
        filters: sheet.config.filters
          ? Array.from(sheet.config.filters.entries()) as Array<[string, import('./types').ColumnFilter]>
          : undefined,
      };

      sheets.push({
        id: sheet.id,
        name: sheet.name,
        cells,
        rowOrder,
        colOrder,
        config,
        rowCount: sheet.rowCount,
        colCount: sheet.colCount,
      });
    }

    return {
      id: this.id,
      name: this.name,
      activeSheetId: this.activeSheetId,
      defaultRowHeight: this.defaultRowHeight,
      defaultColWidth: this.defaultColWidth,
      stylePool,
      formatPool,
      sheets,
      selection: { ...this.selection },
    };
  }

  /**
   * Set complete workbook data from serialized data
   */
  setData(data: import('./types').WorkbookData): void {
    // Clear existing state
    this.sheets.clear();
    this.formulaGraph = new FormulaGraphImpl();
    this.stylePool.clear();
    this.undoStack.length = 0;
    this.redoStack.length = 0;

    // Restore workbook metadata
    this.id = data.id;
    this.name = data.name;
    this.activeSheetId = data.activeSheetId;
    this.defaultRowHeight = data.defaultRowHeight;
    this.defaultColWidth = data.defaultColWidth;

    // Restore selection if provided
    if (data.selection) {
      this.selection = { ...data.selection };
    }

    // Restore style pool
    for (const [styleId, style] of Object.entries(data.stylePool)) {
      // We need to manually set the style since we cleared the pool
      (this.stylePool as StylePool).setStyles(new Map([[styleId, style]]));
      (this.stylePool as StylePool).setStyleToId(new Map([[this.stylePool.getStyleKey(style), styleId]]));
      // Update nextId to avoid conflicts
      const idNum = parseInt(styleId.split('_')[1] || '0');
      if (idNum >= (this.stylePool as StylePool).getNextId()) {
        (this.stylePool as StylePool).setNextId(idNum + 1);
      }
    }

    // Restore format pool (if present - for backward compatibility)
    if (data.formatPool) {
      for (const [formatId, format] of Object.entries(data.formatPool)) {
        // We need to manually set the format since we cleared the pool
        (this.formatPool as FormatPool).setFormats(new Map([[formatId, format]]));
        (this.formatPool as FormatPool).setFormatToId(new Map([[this.formatPool.getFormatKey(format), formatId]]));
        // Update nextId to avoid conflicts
        const idNum = parseInt(formatId.split('_')[1] || '0');
        if (idNum >= (this.formatPool as FormatPool).getNextId()) {
          (this.formatPool as FormatPool).setNextId(idNum + 1);
        }
      }
    }

    // Restore sheets. Accept two wire formats:
    //   1. Stable form  — rowOrder/colOrder present; cell keys are stable.
    //      Produced by getData(). Pass-through with no translation.
    //   2. Legacy form  — no rowOrder; cell keys are numeric "r:c". Convenient
    //      for hand- or AI-authored JSON. We materialize stable IDs as we
    //      load.
    for (const sheetData of data.sheets) {
      const useStable = !!(sheetData.rowOrder || sheetData.colOrder);

      // 1. Create the sheet with only the config fields that don't need ID
      //    translation. The rest are filled in below.
      const sheet = new SheetImpl(sheetData.id, sheetData.name, {
        defaultRowHeight: sheetData.config.defaultRowHeight,
        defaultColWidth: sheetData.config.defaultColWidth,
        showGridLines: sheetData.config.showGridLines,
        frozenRows: sheetData.config.frozenRows,
        frozenCols: sheetData.config.frozenCols,
        sortOrder: sheetData.config.sortOrder,
      });
      sheet.rowCount = sheetData.rowCount;
      sheet.colCount = sheetData.colCount;

      // 2. Populate the order maps. In stable form they're explicit; in
      //    legacy form they get materialized below as cells load.
      if (useStable) {
        const rowOrder = new Map(sheetData.rowOrder ?? []);
        const colOrder = new Map(sheetData.colOrder ?? []);
        sheet.replaceOrderMaps(rowOrder, colOrder);
      }

      // 3. Restore cells.
      for (const { key, cell } of sheetData.cells) {
        const cellToStore = { ...cell };
        if ('format' in cellToStore && cellToStore.format && !cellToStore.formatId) {
          const cleanedFormat = this.cleanFormat(cellToStore.format as CellFormat);
          const formatId = this.formatPool.getOrCreate(cleanedFormat);
          cellToStore.formatId = formatId;
          delete (cellToStore as Partial<Cell> & { format?: CellFormat }).format;
        }

        let stableKey: string;
        if (useStable) {
          stableKey = key; // already "rowId:colId"
        } else {
          const { row, col } = parseCellKey(key);
          if (!Number.isFinite(row) || !Number.isFinite(col)) continue;
          stableKey = getStableCellKey(sheet.ensureRowId(row), sheet.ensureColId(col));
        }
        sheet.cells.set(stableKey, cellToStore);
      }

      // 4. Restore ID-keyed config — stable input pass-through; legacy
      //    input gets ensureRowId/ensureColId.
      if (sheetData.config.rowHeights) {
        sheet.config.rowHeights = new Map();
        for (const [key, h] of sheetData.config.rowHeights) {
          const rowId = useStable ? (key as string) : sheet.ensureRowId(key as number);
          sheet.config.rowHeights.set(rowId, h);
        }
      }
      if (sheetData.config.colWidths) {
        sheet.config.colWidths = new Map();
        for (const [key, w] of sheetData.config.colWidths) {
          const colId = useStable ? (key as string) : sheet.ensureColId(key as number);
          sheet.config.colWidths.set(colId, w);
        }
      }
      if (sheetData.config.hiddenRows) {
        sheet.config.hiddenRows = new Set();
        for (const key of sheetData.config.hiddenRows) {
          const rowId = useStable ? (key as string) : sheet.ensureRowId(key as number);
          sheet.config.hiddenRows.add(rowId);
        }
      }
      if (sheetData.config.hiddenCols) {
        sheet.config.hiddenCols = new Set();
        for (const key of sheetData.config.hiddenCols) {
          const colId = useStable ? (key as string) : sheet.ensureColId(key as number);
          sheet.config.hiddenCols.add(colId);
        }
      }
      if (sheetData.config.filters) {
        sheet.config.filters = new Map();
        for (const [key, filter] of sheetData.config.filters) {
          const colId = useStable ? (key as string) : sheet.ensureColId(key as number);
          sheet.config.filters.set(colId, filter);
        }
      }

      this.sheets.set(sheetData.id, sheet);
    }

    // Rebuild formula graph and evaluate formulas
    this.rebuildFormulaGraph();

    // Emit change events
    this.events.emit('workbookChange', {});
    this.events.emit('sheetChange', { sheetId: this.activeSheetId });
    this.events.emit('cellSelection', { selection: this.selection });
  }

  /**
   * Clean up format object to only include properties relevant to the format type
   */
  private cleanFormat(format: CellFormat): CellFormat {
    if (!format.type) {
      return format;
    }

    const cleaned: CellFormat = { type: format.type };

    switch (format.type) {
      case 'number':
        cleaned.decimalPlaces = format.decimalPlaces;
        cleaned.useThousandsSeparator = format.useThousandsSeparator;
        cleaned.negativeFormat = format.negativeFormat;
        break;

      case 'currency':
        cleaned.decimalPlaces = format.decimalPlaces;
        cleaned.currencyCode = format.currencyCode;
        cleaned.currencySymbolPosition = format.currencySymbolPosition;
        cleaned.negativeFormat = format.negativeFormat;
        break;

      case 'accounting':
        cleaned.decimalPlaces = format.decimalPlaces;
        cleaned.currencyCode = format.currencyCode;
        cleaned.negativeFormat = format.negativeFormat;
        break;

      case 'percentage':
        cleaned.decimalPlaces = format.decimalPlaces;
        break;

      case 'scientific':
        cleaned.decimalPlaces = format.decimalPlaces;
        break;

      case 'fraction':
        cleaned.fractionType = format.fractionType;
        break;

      case 'date':
        cleaned.dateFormat = format.dateFormat;
        break;

      case 'time':
        cleaned.timeFormat = format.timeFormat;
        break;

      case 'datetime':
        cleaned.dateFormat = format.dateFormat;
        cleaned.timeFormat = format.timeFormat;
        break;

      case 'duration':
        cleaned.durationFormat = format.durationFormat;
        break;

      case 'custom':
        cleaned.pattern = format.pattern;
        break;

      case 'text':
      default:
        // Text format doesn't need additional properties
        break;
    }

    return cleaned;
  }

  /**
   * Rebuild formula graph from current cells and evaluate all formulas
   */
  private rebuildFormulaGraph(): void {
    const resolver = this.buildSheetResolver();
    for (const [sheetId, sheet] of this.sheets.entries()) {
      for (const [row, col, cell] of sheet.entries()) {
        if (!cell.formula && !cell.formulaAst) continue;
        let ast = cell.formulaAst;
        if (!ast && cell.formula) {
          const parsed = this.formulaParser.parse(cell.formula, row, col);
          if (parsed.error) continue;
          ast = toStableAst(parsed.ast, resolver, sheet, row, col);
          cell.formulaAst = ast;
        }
        if (!ast) continue;
        const cellKey = this.graphKey(sheetId, row, col);
        const deps = collectStableDependencies(ast, sheet);
        this.formulaGraph.addFormula(cellKey, cell.formula ?? '', deps);
        this.evaluateFormula(sheetId, row, col);
      }
    }
  }

  // ============================================
  // Sorting Methods
  // ============================================

  /**
   * Set the sort order for a sheet
   * @param sortOrder Sort order to apply
   * @param sheetId Target sheet ID (defaults to active sheet)
   */
  setSortOrder(sortOrder: SortOrder[], sheetId?: string): void {
    const targetSheetId = sheetId ?? this.activeSheetId;
    const sheet = this.sheets.get(targetSheetId);
    if (sheet) {
      // Record history before making changes
      if (!this.isUndoing && !this.isRedoing && !this.isBatching) {
        this.recordHistory();
      }
      sheet.setSortOrder(sortOrder);
    }
  }

  /**
   * Get the sort order for a sheet
   * @param sheetId Target sheet ID (defaults to active sheet)
   * @returns Current sort order
   */
  getSortOrder(sheetId?: string): SortOrder[] {
    const targetSheetId = sheetId ?? this.activeSheetId;
    const sheet = this.sheets.get(targetSheetId);
    return sheet ? sheet.getSortOrder() : [];
  }

  /**
   * Clear sorting for a sheet
   * @param sheetId Target sheet ID (defaults to active sheet)
   */
  clearSort(sheetId?: string): void {
    const targetSheetId = sheetId ?? this.activeSheetId;
    const sheet = this.sheets.get(targetSheetId);
    if (sheet) {
      // Record history before making changes
      if (!this.isUndoing && !this.isRedoing && !this.isBatching) {
        this.recordHistory();
      }
      sheet.clearSort();
    }
  }

  /**
   * Sort the sheet data according to current sort order
   * @param sheetId Target sheet ID (defaults to active sheet)
   */
  sortSheet(sheetId?: string): void {
    const targetSheetId = sheetId ?? this.activeSheetId;
    const sheet = this.sheets.get(targetSheetId);
    if (sheet) {
      const sortOrder = sheet.getSortOrder();
      if (sortOrder.length > 0) {
        // Record history before sorting
        if (!this.isUndoing && !this.isRedoing && !this.isBatching) {
          this.recordHistory();
        }

        SortManager.sortRows(sheet, sortOrder);
      }
    }
  }

  // ============================================
  // Filtering Methods
  // ============================================

  /**
   * Set a filter for a column
   * @param column Column index
   * @param filter Filter configuration
   * @param sheetId Target sheet ID (defaults to active sheet)
   */
  setFilter(column: number, filter: import('./types').ColumnFilter, sheetId?: string): void {
    const targetSheetId = sheetId ?? this.activeSheetId;
    const sheet = this.sheets.get(targetSheetId);
    if (sheet) {
      // Record history before making changes
      if (!this.isUndoing && !this.isRedoing && !this.isBatching) {
        this.recordHistory();
      }
      sheet.setFilter(column, filter);
    }
  }

  /**
   * Clear filter for a specific column
   * @param column Column index
   * @param sheetId Target sheet ID (defaults to active sheet)
   */
  clearFilter(column: number, sheetId?: string): void {
    const targetSheetId = sheetId ?? this.activeSheetId;
    const sheet = this.sheets.get(targetSheetId);
    if (sheet) {
      // Record history before making changes
      if (!this.isUndoing && !this.isRedoing && !this.isBatching) {
        this.recordHistory();
      }
      sheet.clearFilter(column);
    }
  }

  /**
   * Get all active filters for a sheet
   * @param sheetId Target sheet ID (defaults to active sheet)
   * @returns Map of column -> filter
   */
  getFilters(sheetId?: string): Map<number, import('./types').ColumnFilter> {
    const targetSheetId = sheetId ?? this.activeSheetId;
    const sheet = this.sheets.get(targetSheetId);
    return sheet ? sheet.getFilters() : new Map();
  }

  /**
   * Clear all filters for a sheet
   * @param sheetId Target sheet ID (defaults to active sheet)
   */
  clearAllFilters(sheetId?: string): void {
    const targetSheetId = sheetId ?? this.activeSheetId;
    const sheet = this.sheets.get(targetSheetId);
    if (sheet) {
      // Record history before making changes
      if (!this.isUndoing && !this.isRedoing && !this.isBatching) {
        this.recordHistory();
      }
      sheet.clearAllFilters();
    }
  }

  // ============================================
  // Collaboration
  // ============================================

  /**
   * Attach a CollabProvider so this workbook's cells, structure, and styles
   * sync with peers via Yjs. The returned handle exposes the Y.Doc and
   * Awareness; the React layer reads it via getCollabHandle() to overlay
   * remote cell selections.
   *
   * Idempotent guard: throws if already attached.
   */
  async attachCollab(
    provider: import('@pagent-libs/shared').CollabProvider,
    identity: import('@pagent-libs/shared').CollabIdentity,
    options?: AttachCollabOptions,
  ): Promise<CollabHandle> {
    if (this.collabHandle) {
      throw new Error('Collaboration is already attached to this workbook.');
    }
    const handle = await attachCollabToWorkbook(
      this.getData(),
      this,
      provider,
      identity,
      options,
    );
    this.collabHandle = handle;
    this.events.emit('workbookChange', { action: 'attachCollab' });
    return handle;
  }

  /** Return the live collab handle, or null if not in collab mode. */
  getCollabHandle(): CollabHandle | null {
    return this.collabHandle;
  }

  /** Detach from the current collaboration session. */
  detachCollab(): void {
    if (!this.collabHandle) return;
    this.collabHandle.detach();
    this.collabHandle = null;
    this.events.emit('workbookChange', { action: 'detachCollab' });
  }

  /**
   * @internal Used by the collab binding to apply a remote-driven
   * WorkbookData reload without tripping any guard rails that would
   * otherwise reject setData while collab is attached. Behaves like
   * setData but signals collab origin so consumers can disambiguate.
   */
  _reloadFromCollab(data: import('./types').WorkbookData): void {
    // Suspend history recording AND collab mirroring during the reload —
    // remote edits should not collide with local undo/redo stacks, and
    // mirror calls would echo every remote write back over the wire.
    const wasUndoing = this.isUndoing;
    this.isUndoing = true;
    this.isApplyingRemoteChange = true;
    try {
      this.setData(data);
    } finally {
      this.isUndoing = wasUndoing;
      this.isApplyingRemoteChange = false;
    }
  }

  // ============================================
  // Collab mirroring helpers (write local mutations into the Y.Doc)
  // ============================================

  /**
   * Echo a cell write at (row, col) into the workbook's Y.Doc so peers
   * receive the change. No-op when collab is detached or we're currently
   * applying a remote update.
   *
   * Mirrors the cell value + the rowId/colId positions, so a brand-new
   * row or column (not present at hydration time) lands on the peer side
   * with its display index intact.
   */
  private mirrorCellWrite(sheetId: string, row: number, col: number): void {
    if (!this.collabHandle || this.isApplyingRemoteChange) return;
    const sheet = this.sheets.get(sheetId) as SheetImpl | undefined;
    if (!sheet) return;
    const cell = sheet.getCell(row, col);
    if (!cell) return;

    const rowId = sheet.ensureRowId(row);
    const colId = sheet.ensureColId(col);
    const stableKey = getStableCellKey(rowId, colId);

    const ydoc = this.collabHandle.ydoc;
    const yTypes = getWorkbookYTypes(ydoc);
    const ySheetMap = yTypes.sheets.get(sheetId);
    if (!ySheetMap) return;
    const t = getSheetYTypes(ySheetMap);

    ydoc.transact(() => {
      // Ensure rowOrder/colOrder entries exist for these IDs at the right index.
      if (t.rowOrder.get(rowId) !== row) t.rowOrder.set(rowId, row);
      if (t.colOrder.get(colId) !== col) t.colOrder.set(colId, col);

      t.cells.set(stableKey, { ...cell });

      // Pool sync — if the cell references a style/format we haven't
      // mirrored yet, push it now so peers don't render with stale ids.
      if (cell.styleId) {
        const style = this.stylePool.get(cell.styleId);
        if (style && !yTypes.stylePool.has(cell.styleId)) {
          yTypes.stylePool.set(cell.styleId, { ...style });
        }
      }
      if (cell.formatId) {
        const format = this.formatPool.get(cell.formatId);
        if (format && !yTypes.formatPool.has(cell.formatId)) {
          yTypes.formatPool.set(cell.formatId, { ...format });
        }
      }
    });
  }

  /** Echo a new sheet into the Y.Doc. */
  private mirrorSheetAdd(sheetId: string, name: string, sheet: SheetImpl): void {
    if (!this.collabHandle || this.isApplyingRemoteChange) return;
    const ydoc = this.collabHandle.ydoc;
    const yTypes = getWorkbookYTypes(ydoc);
    ydoc.transact(() => {
      const ySheetMap = createSheetYMap();
      // Seed minimal meta + counts
      const meta = ySheetMap.get('meta') as Y.Map<unknown>;
      meta.set('id', sheetId);
      meta.set('name', name);
      meta.set('rowCount', sheet.rowCount);
      meta.set('colCount', sheet.colCount);
      yTypes.sheets.set(sheetId, ySheetMap);
      // Append to sheetIds order if not already present
      const ids = yTypes.sheetIds.toArray();
      if (!ids.includes(sheetId)) {
        yTypes.sheetIds.push([sheetId]);
      }
    });
  }
}

