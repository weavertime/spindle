import React, { memo, useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useWorkbook } from '../context/WorkbookContext';
import {
  CanvasRenderer,
  type RenderState,
  type CellPosition,
  type ResizeHandle,
  type CursorType,
  type FormulaRangeHighlight,
} from '@pagent-libs/sheets-core';
import type { Selection, Range, Cell, CellValue } from '@pagent-libs/sheets-core';
import { extractFormulaRanges, columnIndexToLabel, adjustFormula, type FormulaRange } from '@pagent-libs/sheets-core';
import { FilterManager, excelDateToJS, formatJSDate } from '@pagent-libs/sheets-core';
import { RemoteSelectionOverlay } from './RemoteSelectionOverlay';

export type ContextMenuType =
  | { type: 'cell'; cell: CellPosition; x: number; y: number }
  | { type: 'row'; index: number; x: number; y: number }
  | { type: 'column'; index: number; x: number; y: number };

export interface CanvasGridProps {
  width: number;
  height: number;
  rowHeight?: number;
  colWidth?: number;
  headerHeight?: number;
  activeCell?: CellPosition | null;
  onActiveCellChange?: (cell: CellPosition | null) => void;
  onCellEdit?: (cell: CellPosition, value: string) => void;
  onSelectionChange?: (selection: Selection) => void;
  onScroll?: (scrollTop: number, scrollLeft: number) => void;
  onContentChange?: () => void;
  dimensionVersion?: number;
  editValue?: string;
  onInsertCellReference?: (reference: string, isNewSelection?: boolean) => void;
  isEditingFormula?: boolean;
  editingCell?: CellPosition | null;
  originalEditingSheetId?: string;
  onContextMenu?: (menu: ContextMenuType) => void;
  onClipboardReady?: (handlers: {
    copy: () => void;
    cut: () => void;
    paste: (targetCell?: CellPosition) => Promise<void>;
  }) => void;
}

export const CanvasGrid = memo(function CanvasGrid({
  width,
  height,
  rowHeight = 20,
  colWidth = 100,
  headerHeight: propHeaderHeight,
  activeCell: externalActiveCell,
  onActiveCellChange,
  onCellEdit,
  onSelectionChange,
  onScroll,
  onContentChange,
  dimensionVersion = 0,
  editValue = '',
  onInsertCellReference,
  isEditingFormula = false,
  editingCell: externalEditingCell,
  originalEditingSheetId,
  onContextMenu,
  onClipboardReady,
}: CanvasGridProps) {
  const { workbook } = useWorkbook();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Internal state
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [selection, setSelection] = useState<Selection>({
    ranges: [],
    activeCell: { row: 0, col: 0 },
  });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<CellPosition | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [resizeStart, setResizeStart] = useState<{ pos: number; size: number } | null>(null);
  const [isFilling, setIsFilling] = useState(false);
  const [fillStart, setFillStart] = useState<CellPosition | null>(null);
  const [resizeVersion, setResizeVersion] = useState(0);
  
  // Formula reference selection state
  const [isSelectingFormulaRef, setIsSelectingFormulaRef] = useState(false);
  const [formulaRefStart, setFormulaRefStart] = useState<CellPosition | null>(null);
  
  // Clipboard state for internal copy/paste
  const [clipboard, setClipboard] = useState<{ cells: Array<{ row: number; col: number; cell: Cell }> } | null>(null);
  
  const headerHeight = propHeaderHeight ?? rowHeight;
  const activeCell = externalActiveCell !== undefined ? externalActiveCell : selection.activeCell;
  
  // Use editing cell from props (controlled by parent)
  const editingCell = externalEditingCell ?? null;
  
  const sheet = workbook.getSheet();
  
  // Sync internal selection when external active cell changes
  // This ensures the selection rectangle follows the active cell when changed externally
  useEffect(() => {
    if (externalActiveCell) {
      // Check if the current selection doesn't match the external active cell
      const currentRange = selection.ranges[0];
      const needsSync = !currentRange || 
        currentRange.startRow !== externalActiveCell.row ||
        currentRange.endRow !== externalActiveCell.row ||
        currentRange.startCol !== externalActiveCell.col ||
        currentRange.endCol !== externalActiveCell.col ||
        selection.activeCell?.row !== externalActiveCell.row ||
        selection.activeCell?.col !== externalActiveCell.col;
      
      if (needsSync) {
        setSelection({
          ranges: [{
            startRow: externalActiveCell.row,
            endRow: externalActiveCell.row,
            startCol: externalActiveCell.col,
            endCol: externalActiveCell.col,
          }],
          activeCell: externalActiveCell,
        });
      }
    }
  }, [externalActiveCell]);
  
  // Calculate formula ranges for highlighting
  const formulaRanges = useMemo((): FormulaRangeHighlight[] => {
    // Get the formula to highlight - either from editValue or from the active cell
    let formula: string | undefined;
    
    if (isEditingFormula && editValue.startsWith('=')) {
      formula = editValue;
    } else if (activeCell) {
      const cell = sheet.getCell(activeCell.row, activeCell.col);
      formula = cell?.formula;
    }
    
    if (!formula) return [];
    
    try {
      const ranges = extractFormulaRanges(formula);
      
      // Filter to only show ranges on the current sheet
      const currentSheetName = sheet.name;
      
      return ranges
        .filter((range: FormulaRange) => {
          // If range has a sheet name, only show if it matches the current sheet
          if (range.sheetName) {
            return range.sheetName === currentSheetName;
          }
          // No sheet name means it's on the same sheet as the formula
          return true;
        })
        .map((range: FormulaRange, index: number): FormulaRangeHighlight => ({
          startRow: range.startRow,
          startCol: range.startCol,
          endRow: range.endRow,
          endCol: range.endCol,
          colorIndex: index,
        }));
    } catch {
      return [];
    }
  }, [activeCell, editValue, isEditingFormula, sheet]);
  
  
  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const renderer = new CanvasRenderer({
      canvas,
      defaultRowHeight: rowHeight,
      defaultColWidth: colWidth,
      headerHeight,
      headerWidth: colWidth,
    });
    
    rendererRef.current = renderer;
    
    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []); // Only initialize once
  
  // Update renderer when size changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.resize(width, height);
    }
  }, [width, height]);
  
  // Update viewport when scroll changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setViewport(scrollTop, scrollLeft);
    }
  }, [scrollTop, scrollLeft]);
  
  // Re-render when a comment thread is added, replied to, resolved, etc.
  const [commentVersion, setCommentVersion] = useState(0);
  useEffect(() => {
    return workbook.on('commentChange', () => setCommentVersion((v) => v + 1));
  }, [workbook]);

  // Build render state and trigger render
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const cells = new Map<string, Cell>();
    const styles = workbook.getStylePool();
    
    // Build row/col dimension maps first (needed for visible range calculation)
    const rowHeights = new Map<number, number>();
    const colWidths = new Map<number, number>();
    
    for (let r = 0; r < sheet.rowCount; r++) {
      const h = sheet.getRowHeight(r);
      if (h !== rowHeight) {
        rowHeights.set(r, h);
      }
    }
    
    for (let c = 0; c < sheet.colCount; c++) {
      const w = sheet.getColWidth(c);
      if (w !== colWidth) {
        colWidths.set(c, w);
      }
    }
    
    // Calculate visible range BEFORE getting viewport for cell loading
    renderer.calculateVisibleRangeForDimensions(
      sheet.rowCount,
      sheet.colCount,
      rowHeights,
      colWidths
    );
    
    // Get visible range for optimization
    const viewport = renderer.getViewport();
    const startRow = Math.max(0, viewport.startRow - 5);
    const endRow = Math.min(sheet.rowCount, viewport.endRow + 5);
    const startCol = Math.max(0, viewport.startCol - 2);
    const endCol = Math.min(sheet.colCount, viewport.endCol + 2);
    
    // Only load visible cells
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const cell = sheet.getCell(row, col);
        if (cell) {
          cells.set(`${row}:${col}`, cell);
        } else {
          // A cell with no stored data may still be filled by a dynamic-array
          // spill — show a transient, display-only cell for the spilled value.
          const spilled = workbook.getSpilledValue(undefined, row, col);
          if (spilled !== undefined) {
            cells.set(`${row}:${col}`, { value: spilled as CellValue });
          }
        }
      }
    }
    
    // Build hidden rows/cols sets
    const hiddenRows = new Set<number>();
    const hiddenCols = new Set<number>();
    for (let r = 0; r < sheet.rowCount; r++) {
      if (sheet.isRowHidden(r)) {
        hiddenRows.add(r);
      }
    }
    for (let c = 0; c < sheet.colCount; c++) {
      if (sheet.isColHidden(c)) {
        hiddenCols.add(c);
      }
    }
    
    // Get freeze configuration from sheet
    const frozenRows = sheet.getFrozenRows();
    const frozenCols = sheet.getFrozenCols();
    
    // Also load frozen cells if not already in visible range
    if (frozenRows > 0 || frozenCols > 0) {
      // Load frozen row cells
      for (let row = 0; row < frozenRows; row++) {
        for (let col = 0; col < sheet.colCount; col++) {
          const cell = sheet.getCell(row, col);
          if (cell && !cells.has(`${row}:${col}`)) {
            cells.set(`${row}:${col}`, cell);
          }
        }
      }
      // Load frozen column cells
      for (let row = 0; row < sheet.rowCount; row++) {
        for (let col = 0; col < frozenCols; col++) {
          const cell = sheet.getCell(row, col);
          if (cell && !cells.has(`${row}:${col}`)) {
            cells.set(`${row}:${col}`, cell);
          }
        }
      }
    }
    
    const filters = sheet.getFilters();
    const filteredRows = filters.size > 0 ? FilterManager.getFilteredRows(sheet, filters) : undefined;

    // Cells carrying an open comment thread — drives the corner marker.
    const commentedCells = new Set<string>();
    for (const thread of sheet.comments.getThreads()) {
      if (thread.status !== 'open') continue;
      const r = sheet.getRowIndex(thread.anchor.rowId);
      const c = sheet.getColIndex(thread.anchor.colId);
      if (r !== undefined && c !== undefined) commentedCells.add(`${r}:${c}`);
    }

    const renderState: RenderState = {
      cells,
      styles: styles.getAllStyles(),
      formats: workbook.getFormatPool().getAllFormats(),
      selection,
      activeCell,
      editingCell,
      rowHeights,
      colWidths,
      rowCount: sheet.rowCount,
      colCount: sheet.colCount,
      formulaRanges,
      hiddenRows,
      hiddenCols,
      frozenRows: frozenRows > 0 ? frozenRows : undefined,
      frozenCols: frozenCols > 0 ? frozenCols : undefined,
      filters,
      filteredRows,
      commentedCells,
    };
    
    renderer.setState(renderState);
  }, [
    workbook,
    sheet,
    selection,
    activeCell,
    editingCell,
    scrollTop,
    scrollLeft,
    rowHeight,
    colWidth,
    dimensionVersion,
    resizeVersion,
    formulaRanges,
    commentVersion,
    // Re-render when filters change
    sheet.getFilters(),
  ]);
  
  // Get cursor based on position
  const getCursor = useCallback((x: number, y: number): CursorType => {
    const renderer = rendererRef.current;
    if (!renderer) return 'default';
    
    const resizeHandle = renderer.getResizeHandleAtPoint(x, y);
    if (resizeHandle) {
      return resizeHandle.type === 'column' ? 'col-resize' : 'row-resize';
    }
    
    if (renderer.isFillHandleAtPoint(x, y)) {
      return 'crosshair';
    }
    
    const header = renderer.getHeaderAtPoint(x, y);
    if (header) {
      return 'pointer';
    }
    
    const cell = renderer.getCellAtPoint(x, y);
    if (cell) {
      return 'cell';
    }
    
    return 'default';
  }, []);
  
  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check for resize handle
    const resizeHandleHit = renderer.getResizeHandleAtPoint(x, y);
    if (resizeHandleHit) {
      // Record history before resize for undo/redo
      workbook.recordHistory();
      
      setIsResizing(true);
      setResizeHandle(resizeHandleHit);
      
      // Get current size
      if (resizeHandleHit.type === 'column') {
        const currentWidth = sheet.getColWidth(resizeHandleHit.index);
        setResizeStart({ pos: x, size: currentWidth });
      } else {
        const currentHeight = sheet.getRowHeight(resizeHandleHit.index);
        setResizeStart({ pos: y, size: currentHeight });
      }
      
      e.preventDefault();
      return;
    }
    
    // Check for fill handle
    if (renderer.isFillHandleAtPoint(x, y) && selection.ranges.length > 0) {
      setIsFilling(true);
      setFillStart(selection.activeCell);
      e.preventDefault();
      return;
    }
    
    // Check for header click
    const header = renderer.getHeaderAtPoint(x, y);
    if (header && !header.isResize) {
      // Select entire row or column
      if (header.type === 'column') {
        const newSelection: Selection = {
          ranges: [{
            startRow: 0,
            endRow: sheet.rowCount - 1,
            startCol: header.index,
            endCol: header.index,
          }],
          activeCell: { row: 0, col: header.index },
        };
        setSelection(newSelection);
        onSelectionChange?.(newSelection);
        onActiveCellChange?.({ row: 0, col: header.index });
      } else {
        const newSelection: Selection = {
          ranges: [{
            startRow: header.index,
            endRow: header.index,
            startCol: 0,
            endCol: sheet.colCount - 1,
          }],
          activeCell: { row: header.index, col: 0 },
        };
        setSelection(newSelection);
        onSelectionChange?.(newSelection);
        onActiveCellChange?.({ row: header.index, col: 0 });
      }
      return;
    }
    
    // Check for cell click
    const cell = renderer.getCellAtPoint(x, y);
    if (cell) {
      // If editing a formula, insert cell reference instead of changing selection
      if (isEditingFormula && onInsertCellReference) {
        e.preventDefault();
        e.stopPropagation();
        
        // Start formula reference selection (for potential range dragging)
        setIsSelectingFormulaRef(true);
        setFormulaRefStart(cell);
        
        // Build cell reference, including sheet name if on a different sheet
        let cellRef: string;
        const currentSheetId = workbook.activeSheetId;
        
        if (originalEditingSheetId && currentSheetId !== originalEditingSheetId) {
          // Cross-sheet reference - include sheet name
          const currentSheet = workbook.getSheet();
          const sheetName = currentSheet.name;
          // Escape sheet name if it contains spaces or special characters
          const escapedSheetName = sheetName.includes(' ') || sheetName.includes("'")
            ? `'${sheetName.replace(/'/g, "''")}'`
            : sheetName;
          cellRef = `${escapedSheetName}!${columnIndexToLabel(cell.col)}${cell.row + 1}`;
        } else {
          // Same sheet reference
          cellRef = `${columnIndexToLabel(cell.col)}${cell.row + 1}`;
        }
        
        onInsertCellReference(cellRef, true); // true = new selection start
        return;
      }
      
      setIsSelecting(true);
      setSelectionStart(cell);
      
      const newSelection: Selection = {
        ranges: [{
          startRow: cell.row,
          endRow: cell.row,
          startCol: cell.col,
          endCol: cell.col,
        }],
        activeCell: cell,
      };
      setSelection(newSelection);
      onSelectionChange?.(newSelection);
      onActiveCellChange?.(cell);
    }
  }, [sheet, selection, onSelectionChange, onActiveCellChange, isEditingFormula, onInsertCellReference, workbook, originalEditingSheetId]);
  
  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Update cursor
    const cursor = getCursor(x, y);
    canvas.style.cursor = cursor === 'cell' ? 'cell' : cursor;
    
    // Handle resize
    if (isResizing && resizeHandle && resizeStart) {
      if (resizeHandle.type === 'column') {
        const delta = x - resizeStart.pos;
        const newWidth = Math.max(20, resizeStart.size + delta);
        sheet.setColWidth(resizeHandle.index, newWidth);
      } else {
        const delta = y - resizeStart.pos;
        const newHeight = Math.max(15, resizeStart.size + delta);
        sheet.setRowHeight(resizeHandle.index, newHeight);
      }
      // Trigger re-render with new dimensions
      setResizeVersion(v => v + 1);
      return;
    }
    
    // Handle formula reference range selection (dragging while editing formula)
    if (isSelectingFormulaRef && formulaRefStart && onInsertCellReference) {
      const cell = renderer.getCellAtPoint(x, y);
      if (cell) {
        // Build sheet prefix if on a different sheet
        let sheetPrefix = '';
        const currentSheetId = workbook.activeSheetId;
        
        if (originalEditingSheetId && currentSheetId !== originalEditingSheetId) {
          const currentSheet = workbook.getSheet();
          const sheetName = currentSheet.name;
          // Escape sheet name if it contains spaces or special characters
          const escapedSheetName = sheetName.includes(' ') || sheetName.includes("'")
            ? `'${sheetName.replace(/'/g, "''")}'`
            : sheetName;
          sheetPrefix = `${escapedSheetName}!`;
        }
        
        // Build range reference (e.g., A1:B5 or Sheet2!A1:B5)
        const startRef = `${sheetPrefix}${columnIndexToLabel(formulaRefStart.col)}${formulaRefStart.row + 1}`;
        const endRef = `${columnIndexToLabel(cell.col)}${cell.row + 1}`;
        
        // If same cell, just use single reference
        const rangeRef = (formulaRefStart.row === cell.row && formulaRefStart.col === cell.col)
          ? startRef
          : `${startRef}:${endRef}`;
        
        onInsertCellReference(rangeRef, false); // false = continuing drag
      }
      return;
    }
    
    // Handle selection drag
    if (isSelecting && selectionStart) {
      const cell = renderer.getCellAtPoint(x, y);
      if (cell) {
        const newSelection: Selection = {
          ranges: [{
            startRow: Math.min(selectionStart.row, cell.row),
            endRow: Math.max(selectionStart.row, cell.row),
            startCol: Math.min(selectionStart.col, cell.col),
            endCol: Math.max(selectionStart.col, cell.col),
          }],
          activeCell: selectionStart,
        };
        setSelection(newSelection);
        onSelectionChange?.(newSelection);
      }
      return;
    }
    
    // Handle fill drag
    if (isFilling && fillStart) {
      const cell = renderer.getCellAtPoint(x, y);
      if (cell) {
        // Update fill preview (selection range extended)
        const range = selection.ranges[0];
        if (range) {
          // Extend in the direction of drag
          const newRange: Range = { ...range };
          
          if (cell.row < range.startRow) {
            newRange.startRow = cell.row;
          } else if (cell.row > range.endRow) {
            newRange.endRow = cell.row;
          }
          
          if (cell.col < range.startCol) {
            newRange.startCol = cell.col;
          } else if (cell.col > range.endCol) {
            newRange.endCol = cell.col;
          }
          
          // For now, just update selection visually
          // Actual fill will happen on mouse up
          const newSelection: Selection = {
            ranges: [newRange],
            activeCell: selection.activeCell,
          };
          setSelection(newSelection);
        }
      }
    }
  }, [
    isResizing,
    resizeHandle,
    resizeStart,
    isSelecting,
    selectionStart,
    isFilling,
    fillStart,
    selection,
    sheet,
    getCursor,
    onSelectionChange,
    isSelectingFormulaRef,
    formulaRefStart,
    onInsertCellReference,
    workbook,
    originalEditingSheetId,
  ]);
  
  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      setResizeHandle(null);
      setResizeStart(null);
    }
    
    if (isSelecting) {
      setIsSelecting(false);
      setSelectionStart(null);
    }
    
    if (isFilling && fillStart && selection.ranges.length > 0) {
      // Perform fill operation
      const sourceCell = sheet.getCell(fillStart.row, fillStart.col);
      const fillRange = selection.ranges[0];
      
      if (sourceCell || fillStart) {
        const sourceFormula = sourceCell?.formula;
        const sourceValue = sourceCell?.value;
        const sourceStyleId = sourceCell?.styleId;
        const sourceFormatId = sourceCell?.formatId;
        
        // Use batch to record single history entry for all fill operations
        workbook.batch(() => {
          // Fill all cells in the range
          for (let r = fillRange.startRow; r <= fillRange.endRow; r++) {
            for (let c = fillRange.startCol; c <= fillRange.endCol; c++) {
              // Skip the source cell
              if (r === fillStart.row && c === fillStart.col) continue;
              
              if (sourceFormula) {
                // Adjust formula for relative references (AST-aware rebasing)
                const adjustedFormula = adjustFormula(
                  sourceFormula,
                  workbook,
                  undefined,
                  fillStart.row,
                  fillStart.col,
                  r,
                  c
                );
                workbook.setFormula(undefined, r, c, adjustedFormula);

                
                // Also copy style and format if present
                if (sourceStyleId || sourceFormatId) {
                  const existingCell = sheet.getCell(r, c);
                  workbook.setCell(undefined, r, c, {
                    ...existingCell,
                    styleId: sourceStyleId,
                    formatId: sourceFormatId,
                  });
                }
              } else if (sourceValue !== null && sourceValue !== undefined) {
                // Copy value as-is
                workbook.setCellValue(undefined, r, c, sourceValue);
                
                // Also copy style and format if present
                if (sourceStyleId || sourceFormatId) {
                  const existingCell = sheet.getCell(r, c);
                  workbook.setCell(undefined, r, c, {
                    ...existingCell,
                    styleId: sourceStyleId,
                    formatId: sourceFormatId,
                  });
                }
              } else {
                // Source is empty, clear target cell
                workbook.setCellValue(undefined, r, c, null);
              }
            }
          }
        });
        
        // Update selection to the filled range and trigger re-render
        const newSelection: Selection = {
          ranges: [fillRange],
          activeCell: { row: fillRange.endRow, col: fillRange.endCol },
        };
        setSelection(newSelection);
        onSelectionChange?.(newSelection);
        onActiveCellChange?.({ row: fillRange.endRow, col: fillRange.endCol });
        onContentChange?.();
      }
      
      setIsFilling(false);
      setFillStart(null);
    } else if (isFilling) {
      setIsFilling(false);
      setFillStart(null);
    }
    
    if (isSelectingFormulaRef) {
      setIsSelectingFormulaRef(false);
      setFormulaRefStart(null);
    }
  }, [isResizing, isSelecting, isFilling, isSelectingFormulaRef, fillStart, selection, sheet, workbook, onSelectionChange, onActiveCellChange, onContentChange]);
  
  const formatCellValueForEditing = useCallback((cellData: Cell | undefined): string => {
    if (!cellData) return '';

    if (cellData.formula) {
      return cellData.formula;
    }

    if (cellData.value === null || cellData.value === undefined) {
      return '';
    }

    // Get the format from formatId
    const format = cellData.formatId ? workbook.getFormatPool().get(cellData.formatId) : undefined;

    // If cell has date/time formatting and value is a number, format it back to readable date
    if (format?.type && ['date', 'time', 'datetime'].includes(format.type) && typeof cellData.value === 'number') {
      try {
        const jsDate = excelDateToJS(cellData.value);
        // Format back to a readable date string (DD-MM-YYYY for European style)
        return formatJSDate(jsDate, 'DD-MM-YYYY');
      } catch {
        // If date conversion fails, fall back to string representation
        return String(cellData.value);
      }
    }

    return String(cellData.value);
  }, []);

  // Handle double click (start editing)
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cell = renderer.getCellAtPoint(x, y);
    if (cell) {
      const cellData = sheet.getCell(cell.row, cell.col);
      const value = formatCellValueForEditing(cellData);

      onCellEdit?.(cell, value);
    }
  }, [sheet, onCellEdit, formatCellValueForEditing]);
  
  // Handle right-click context menu
  const handleContextMenuEvent = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer || !onContextMenu) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check for header click first
    const header = renderer.getHeaderAtPoint(x, y);
    if (header) {
      if (header.type === 'column') {
        // Select the column
        const newSelection: Selection = {
          ranges: [{
            startRow: 0,
            endRow: sheet.rowCount - 1,
            startCol: header.index,
            endCol: header.index,
          }],
          activeCell: { row: 0, col: header.index },
        };
        setSelection(newSelection);
        onSelectionChange?.(newSelection);
        onActiveCellChange?.({ row: 0, col: header.index });
        
        onContextMenu({ type: 'column', index: header.index, x: e.clientX, y: e.clientY });
      } else {
        // Select the row
        const newSelection: Selection = {
          ranges: [{
            startRow: header.index,
            endRow: header.index,
            startCol: 0,
            endCol: sheet.colCount - 1,
          }],
          activeCell: { row: header.index, col: 0 },
        };
        setSelection(newSelection);
        onSelectionChange?.(newSelection);
        onActiveCellChange?.({ row: header.index, col: 0 });
        
        onContextMenu({ type: 'row', index: header.index, x: e.clientX, y: e.clientY });
      }
      return;
    }
    
    // Check for cell
    const cell = renderer.getCellAtPoint(x, y);
    if (cell) {
      // If the cell is not in the current selection, select it
      const isInSelection = selection.ranges.some(range =>
        cell.row >= Math.min(range.startRow, range.endRow) &&
        cell.row <= Math.max(range.startRow, range.endRow) &&
        cell.col >= Math.min(range.startCol, range.endCol) &&
        cell.col <= Math.max(range.startCol, range.endCol)
      );
      
      if (!isInSelection) {
        const newSelection: Selection = {
          ranges: [{
            startRow: cell.row,
            endRow: cell.row,
            startCol: cell.col,
            endCol: cell.col,
          }],
          activeCell: cell,
        };
        setSelection(newSelection);
        onSelectionChange?.(newSelection);
        onActiveCellChange?.(cell);
      }
      
      onContextMenu({ type: 'cell', cell, x: e.clientX, y: e.clientY });
    }
  }, [sheet, selection, onContextMenu, onSelectionChange, onActiveCellChange]);
  
  // Copy selection to clipboard
  const handleCopy = useCallback(() => {
    if (selection.ranges.length === 0) return;

    const cells: Array<{ row: number; col: number; cell: Cell }> = [];
    const range = selection.ranges[0];
    const minRow = Math.min(range.startRow, range.endRow);
    const maxRow = Math.max(range.startRow, range.endRow);
    const minCol = Math.min(range.startCol, range.endCol);
    const maxCol = Math.max(range.startCol, range.endCol);

    // Build a proper 2D array to preserve structure
    const rowCount = maxRow - minRow + 1;
    const colCount = maxCol - minCol + 1;
    const tsvRows: string[][] = [];
    
    for (let r = 0; r < rowCount; r++) {
      const tsvRow: string[] = [];
      for (let c = 0; c < colCount; c++) {
        const actualRow = minRow + r;
        const actualCol = minCol + c;
        const cell = sheet.getCell(actualRow, actualCol);
        
        if (cell) {
          cells.push({ row: actualRow, col: actualCol, cell: { ...cell } });
          tsvRow.push(cell.value?.toString() || '');
        } else {
          tsvRow.push('');
        }
      }
      tsvRows.push(tsvRow);
    }

    setClipboard({ cells });

    // Convert to TSV format for system clipboard
    const tsv = tsvRows.map((row) => row.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv).catch(() => {
      // Fallback if clipboard API fails - internal clipboard still works
    });
  }, [selection, sheet]);

  // Paste from clipboard
  const handlePaste = useCallback(async (targetCell?: CellPosition) => {
    const pasteTarget = targetCell || activeCell;
    if (!pasteTarget) return;

    try {
      // Try to get from system clipboard first
      const text = await navigator.clipboard.readText();
      if (!text || text.trim() === '') {
        throw new Error('Clipboard empty');
      }
      
      // Parse TSV: split by newlines and filter out empty rows
      const lines = text.split(/\r?\n/).filter(line => line.length > 0 || line.includes('\t'));
      
      if (lines.length === 0) {
        throw new Error('No data to paste');
      }
      
      // Determine the expected column count from the first row
      const firstRowCols = lines[0].split('\t').length;
      
      // Parse all rows, ensuring consistent column structure
      const rows: string[][] = [];
      for (let i = 0; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        while (cols.length < firstRowCols) {
          cols.push('');
        }
        rows.push(cols.slice(0, firstRowCols));
      }

      // Paste each cell
      workbook.batch(() => {
        for (let rowOffset = 0; rowOffset < rows.length; rowOffset++) {
          const rowData = rows[rowOffset];
          for (let colOffset = 0; colOffset < rowData.length; colOffset++) {
            const targetRow = pasteTarget.row + rowOffset;
            const targetCol = pasteTarget.col + colOffset;
            
            // Check bounds
            if (targetRow >= 0 && targetRow < sheet.rowCount && targetCol >= 0 && targetCol < sheet.colCount) {
              const value = rowData[colOffset];
              const trimmedValue = value.trim();
              
              if (trimmedValue.startsWith('=')) {
                workbook.setFormula(undefined, targetRow, targetCol, trimmedValue);
              } else if (trimmedValue === '') {
                workbook.setCellValue(undefined, targetRow, targetCol, null);
              } else {
                const numValue = Number(trimmedValue);
                const valueToStore = !isNaN(numValue) && isFinite(numValue) && trimmedValue !== '' ? numValue : trimmedValue;
                workbook.setCellValue(undefined, targetRow, targetCol, valueToStore);
              }
            }
          }
        }
      });
      
      onContentChange?.();
    } catch {
      // Fallback to internal clipboard
      if (clipboard && clipboard.cells.length > 0) {
        const sourceRows = clipboard.cells.map(c => c.row);
        const sourceCols = clipboard.cells.map(c => c.col);
        const minSourceRow = Math.min(...sourceRows);
        const minSourceCol = Math.min(...sourceCols);
        
        workbook.batch(() => {
          clipboard.cells.forEach(({ row, col, cell }) => {
            const targetRow = pasteTarget.row + (row - minSourceRow);
            const targetCol = pasteTarget.col + (col - minSourceCol);
            if (targetRow >= 0 && targetRow < sheet.rowCount && targetCol >= 0 && targetCol < sheet.colCount) {
              workbook.setCell(undefined, targetRow, targetCol, cell);
            }
          });
        });
        
        onContentChange?.();
      }
    }
  }, [activeCell, sheet, workbook, clipboard, onContentChange]);

  // Cut selection (copy + delete)
  const handleCut = useCallback(() => {
    handleCopy();
    // Delete the cells after copying
    if (selection.ranges.length > 0) {
      workbook.batch(() => {
        selection.ranges.forEach((range) => {
          const minRow = Math.min(range.startRow, range.endRow);
          const maxRow = Math.max(range.startRow, range.endRow);
          const minCol = Math.min(range.startCol, range.endCol);
          const maxCol = Math.max(range.startCol, range.endCol);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              workbook.setCellValue(undefined, r, c, null);
            }
          }
        });
      });
      onContentChange?.();
    }
  }, [handleCopy, selection, workbook, onContentChange]);
  
  // Expose clipboard handlers to parent component
  useEffect(() => {
    if (onClipboardReady) {
      onClipboardReady({
        copy: handleCopy,
        cut: handleCut,
        paste: handlePaste,
      });
    }
  }, [onClipboardReady, handleCopy, handleCut, handlePaste]);
  
  // Handle wheel (scroll) - implemented as manual event listener to avoid passive event issues
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    const renderer = rendererRef.current;
    if (!renderer) return;

    const hitTester = renderer.getHitTester();
    const totalWidth = hitTester.getTotalWidth();
    const totalHeight = hitTester.getTotalHeight();

    const maxScrollLeft = Math.max(0, totalWidth - (width - colWidth));
    const maxScrollTop = Math.max(0, totalHeight - (height - headerHeight));

    const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, scrollLeft + e.deltaX));
    const newScrollTop = Math.max(0, Math.min(maxScrollTop, scrollTop + e.deltaY));

    if (newScrollLeft !== scrollLeft || newScrollTop !== scrollTop) {
      setScrollLeft(newScrollLeft);
      setScrollTop(newScrollTop);
      onScroll?.(newScrollTop, newScrollLeft);
    }
  }, [scrollLeft, scrollTop, width, height, colWidth, headerHeight, onScroll]);

  // Attach wheel event listener manually to avoid passive event issues
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        canvas.removeEventListener('wheel', handleWheel);
      };
    }
    return () => {}; // Return empty cleanup function when no canvas
  }, [handleWheel]);
  
  // Scroll to make a cell visible (accounting for frozen panes)
  const scrollToCellIfNeeded = useCallback((cell: CellPosition) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    
    const bounds = renderer.getCellBounds(cell.row, cell.col);
    if (!bounds) return;
    
    // Get freeze configuration
    const { frozenRows, frozenCols } = renderer.getFreezeConfig();
    const { frozenWidth, frozenHeight } = renderer.getFreezeDimensions();
    
    // Determine if cell is in frozen area
    const isRowFrozen = cell.row < frozenRows;
    const isColFrozen = cell.col < frozenCols;
    
    let newScrollLeft = scrollLeft;
    let newScrollTop = scrollTop;
    
    // Adjust visible area based on freeze panes
    // The scrollable area starts after frozen regions
    const visibleLeft = colWidth + (frozenCols > 0 ? frozenWidth : 0);
    const visibleRight = width;
    const visibleTop = headerHeight + (frozenRows > 0 ? frozenHeight : 0);
    const visibleBottom = height;
    
    // Only scroll horizontally if cell is NOT in frozen columns
    if (!isColFrozen) {
      if (bounds.x < visibleLeft) {
        newScrollLeft = scrollLeft - (visibleLeft - bounds.x);
      } else if (bounds.x + bounds.width > visibleRight) {
        newScrollLeft = scrollLeft + (bounds.x + bounds.width - visibleRight);
      }
    }
    
    // Only scroll vertically if cell is NOT in frozen rows
    if (!isRowFrozen) {
      if (bounds.y < visibleTop) {
        newScrollTop = scrollTop - (visibleTop - bounds.y);
      } else if (bounds.y + bounds.height > visibleBottom) {
        newScrollTop = scrollTop + (bounds.y + bounds.height - visibleBottom);
      }
    }
    
    // Clamp scroll values
    const hitTester = renderer.getHitTester();
    const totalWidth = hitTester.getTotalWidth();
    const totalHeight = hitTester.getTotalHeight();
    
    // Account for frozen areas in max scroll calculation
    const maxScrollLeft = totalWidth - frozenWidth - (width - colWidth - frozenWidth);
    const maxScrollTop = totalHeight - frozenHeight - (height - headerHeight - frozenHeight);
    
    newScrollLeft = Math.max(0, Math.min(maxScrollLeft, newScrollLeft));
    newScrollTop = Math.max(0, Math.min(maxScrollTop, newScrollTop));
    
    if (newScrollLeft !== scrollLeft || newScrollTop !== scrollTop) {
      setScrollLeft(newScrollLeft);
      setScrollTop(newScrollTop);
      onScroll?.(newScrollTop, newScrollLeft);
    }
  }, [scrollLeft, scrollTop, width, height, colWidth, headerHeight, onScroll]);
  
  // Handle keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (editingCell) {
      // Let edit overlay handle keyboard during editing
      return;
    }
    
    const { key, shiftKey, metaKey, ctrlKey } = e;
    const modifier = metaKey || ctrlKey;
    
    // Navigation
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      e.preventDefault();
      
      let newRow = activeCell?.row ?? 0;
      let newCol = activeCell?.col ?? 0;
      
      switch (key) {
        case 'ArrowUp':
          newRow = Math.max(0, newRow - 1);
          break;
        case 'ArrowDown':
          newRow = Math.min(sheet.rowCount - 1, newRow + 1);
          break;
        case 'ArrowLeft':
          newCol = Math.max(0, newCol - 1);
          break;
        case 'ArrowRight':
          newCol = Math.min(sheet.colCount - 1, newCol + 1);
          break;
      }
      
      const newCell = { row: newRow, col: newCol };
      
      if (shiftKey) {
        // Extend selection
        const start = selectionStart ?? activeCell ?? { row: 0, col: 0 };
        const newSelection: Selection = {
          ranges: [{
            startRow: Math.min(start.row, newRow),
            endRow: Math.max(start.row, newRow),
            startCol: Math.min(start.col, newCol),
            endCol: Math.max(start.col, newCol),
          }],
          activeCell: start,
        };
        setSelection(newSelection);
        onSelectionChange?.(newSelection);
        if (!selectionStart) {
          setSelectionStart(activeCell ?? { row: 0, col: 0 });
        }
      } else {
        // Move active cell
        const newSelection: Selection = {
          ranges: [{
            startRow: newRow,
            endRow: newRow,
            startCol: newCol,
            endCol: newCol,
          }],
          activeCell: newCell,
        };
        setSelection(newSelection);
        setSelectionStart(null);
        onSelectionChange?.(newSelection);
        onActiveCellChange?.(newCell);
      }
      
      // Scroll to make cell visible
      scrollToCellIfNeeded(newCell);
    }
    
    // Enter to start editing
    if (key === 'Enter' && !editingCell) {
      e.preventDefault();
      if (activeCell) {
        const cellData = sheet.getCell(activeCell.row, activeCell.col);
        const value = formatCellValueForEditing(cellData);
        onCellEdit?.(activeCell, value);
      }
    }
    
    // Tab to move right
    if (key === 'Tab') {
      e.preventDefault();
      const newCol = shiftKey
        ? Math.max(0, (activeCell?.col ?? 0) - 1)
        : Math.min(sheet.colCount - 1, (activeCell?.col ?? 0) + 1);
      const newCell = { row: activeCell?.row ?? 0, col: newCol };
      
      const newSelection: Selection = {
        ranges: [{
          startRow: newCell.row,
          endRow: newCell.row,
          startCol: newCell.col,
          endCol: newCell.col,
        }],
        activeCell: newCell,
      };
      setSelection(newSelection);
      onSelectionChange?.(newSelection);
      onActiveCellChange?.(newCell);
      scrollToCellIfNeeded(newCell);
    }
    
    // Delete to clear cell - handled by global handler in WorkbookCanvas
    // Copy/Paste/Cut/Undo/Redo - handled by global handler in WorkbookCanvas
    // This ensures these shortcuts work even when toolbar has focus
    
    // Type to start editing
    if (
      !editingCell &&
      !modifier &&
      key.length === 1 &&
      activeCell
    ) {
      onCellEdit?.(activeCell, key);
    }
  }, [
    editingCell,
    activeCell,
    selectionStart,
    sheet,
    onCellEdit,
    onSelectionChange,
    onActiveCellChange,
    scrollToCellIfNeeded,
  ]);
  
  // Add global mouse up handler for drag operations
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isResizing || isSelecting || isFilling || isSelectingFormulaRef) {
        handleMouseUp();
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isResizing, isSelecting, isFilling, isSelectingFormulaRef, handleMouseUp]);
  
  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        width={width * (window.devicePixelRatio || 1)}
        height={height * (window.devicePixelRatio || 1)}
        style={{
          width,
          height,
          display: 'block',
        }}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenuEvent}
      />
      <RemoteSelectionOverlay
        workbook={workbook}
        sheet={sheet}
        activeCell={activeCell ?? null}
        selection={selection}
        scrollTop={scrollTop}
        scrollLeft={scrollLeft}
        headerWidth={colWidth}
        headerHeight={headerHeight}
        width={width}
        height={height}
      />
    </div>
  );
});

export default CanvasGrid;

