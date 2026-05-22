// Stable-ID formula AST.
//
// The parser produces a ParsedFormulaNode whose CellReferences hold numeric
// (row, col) coords (absolute for $-marked refs, offset for relatives).
// That representation is fragile under structural changes: inserting a row
// shifts the cell-at-row-N but not the formulas that pointed there.
//
// A StableFormulaNode replaces each numeric ref with a (rowId, colId) pair.
// Inserts/deletes/sorts mutate only the order maps; the AST's IDs keep
// pointing at the same logical cells. Display text is regenerated from the
// AST on every evaluation so the user sees the up-to-date A1 spelling.

import type { Sheet, FormulaDependencies, RangeDependency } from '../types';
import { columnIndexToLabel } from './cell-reference';
import { volatileFunctions } from './functions';
import type { CellReference, ParsedFormulaNode } from './types';

export interface StableCellRef {
  rowId: string;
  colId: string;
  rowAbsolute: boolean;
  colAbsolute: boolean;
  sheetName?: string;
}

export interface StableRangeRef {
  start: StableCellRef;
  end: StableCellRef;
}

export interface StableFormulaNode {
  type: ParsedFormulaNode['type'];
  value?: unknown;
  cellRef?: StableCellRef;
  rangeRef?: StableRangeRef;
  functionName?: string;
  args?: StableFormulaNode[];
  operator?: string;
  left?: StableFormulaNode;
  right?: StableFormulaNode;
}

/** Thrown when fromStableAst encounters a ref whose target IDs are gone. */
export class StableRefDeletedError extends Error {
  constructor() {
    super('#REF!');
    this.name = 'StableRefDeletedError';
  }
}

export interface SheetResolver {
  getSheet(name?: string): Sheet | undefined;
}

// ============================================================================
// Numeric AST → Stable AST  (called on setFormula)
// ============================================================================

export function toStableAst(
  node: ParsedFormulaNode,
  resolver: SheetResolver,
  currentSheet: Sheet,
  currentRow: number,
  currentCol: number,
): StableFormulaNode {
  const out: StableFormulaNode = { type: node.type };
  if (node.value !== undefined) out.value = node.value;
  if (node.functionName !== undefined) out.functionName = node.functionName;
  if (node.operator !== undefined) out.operator = node.operator;
  if (node.cellRef) {
    out.cellRef = cellRefToStable(node.cellRef, resolver, currentSheet, currentRow, currentCol);
  }
  if (node.rangeRef) {
    out.rangeRef = {
      start: cellRefToStable(node.rangeRef.start, resolver, currentSheet, currentRow, currentCol),
      end: cellRefToStable(node.rangeRef.end, resolver, currentSheet, currentRow, currentCol),
    };
  }
  if (node.args) {
    out.args = node.args.map((a) => toStableAst(a, resolver, currentSheet, currentRow, currentCol));
  }
  if (node.left) {
    out.left = toStableAst(node.left, resolver, currentSheet, currentRow, currentCol);
  }
  if (node.right) {
    out.right = toStableAst(node.right, resolver, currentSheet, currentRow, currentCol);
  }
  return out;
}

function cellRefToStable(
  ref: CellReference,
  resolver: SheetResolver,
  currentSheet: Sheet,
  currentRow: number,
  currentCol: number,
): StableCellRef {
  const sheet = ref.sheetName ? (resolver.getSheet(ref.sheetName) ?? currentSheet) : currentSheet;
  // Parser convention: absolute refs hold absolute positions; relatives hold offsets.
  const absRow = ref.rowAbsolute ? ref.row : currentRow + ref.row;
  const absCol = ref.colAbsolute ? ref.col : currentCol + ref.col;
  return {
    rowId: sheet.ensureRowId(absRow),
    colId: sheet.ensureColId(absCol),
    rowAbsolute: ref.rowAbsolute,
    colAbsolute: ref.colAbsolute,
    sheetName: ref.sheetName,
  };
}

// ============================================================================
// Stable AST → Numeric AST  (called on every evaluate)
// ============================================================================

export function fromStableAst(
  node: StableFormulaNode,
  resolver: SheetResolver,
  currentSheet: Sheet,
  currentRow: number,
  currentCol: number,
): ParsedFormulaNode {
  const out: ParsedFormulaNode = { type: node.type };
  if (node.value !== undefined) out.value = node.value;
  if (node.functionName !== undefined) out.functionName = node.functionName;
  if (node.operator !== undefined) out.operator = node.operator;
  if (node.cellRef) {
    out.cellRef = cellRefFromStable(node.cellRef, resolver, currentSheet, currentRow, currentCol);
  }
  if (node.rangeRef) {
    out.rangeRef = {
      start: cellRefFromStable(node.rangeRef.start, resolver, currentSheet, currentRow, currentCol),
      end: cellRefFromStable(node.rangeRef.end, resolver, currentSheet, currentRow, currentCol),
    };
  }
  if (node.args) {
    out.args = node.args.map((a) => fromStableAst(a, resolver, currentSheet, currentRow, currentCol));
  }
  if (node.left) out.left = fromStableAst(node.left, resolver, currentSheet, currentRow, currentCol);
  if (node.right) out.right = fromStableAst(node.right, resolver, currentSheet, currentRow, currentCol);
  return out;
}

function cellRefFromStable(
  ref: StableCellRef,
  resolver: SheetResolver,
  currentSheet: Sheet,
  currentRow: number,
  currentCol: number,
): CellReference {
  const sheet = ref.sheetName ? (resolver.getSheet(ref.sheetName) ?? currentSheet) : currentSheet;
  const absRow = sheet.getRowIndex(ref.rowId);
  const absCol = sheet.getColIndex(ref.colId);
  if (absRow === undefined || absCol === undefined) {
    throw new StableRefDeletedError();
  }
  // Re-encode in the parser's offset convention so the existing evaluator
  // consumes it unchanged.
  return {
    row: ref.rowAbsolute ? absRow : absRow - currentRow,
    col: ref.colAbsolute ? absCol : absCol - currentCol,
    rowAbsolute: ref.rowAbsolute,
    colAbsolute: ref.colAbsolute,
    sheetName: ref.sheetName,
  };
}

// ============================================================================
// Stable AST → Display string  (regenerated on every evaluate)
// ============================================================================

export function renderStableAst(
  node: StableFormulaNode,
  resolver: SheetResolver,
  currentSheet: Sheet,
): string {
  return '=' + renderNode(node, resolver, currentSheet);
}

function renderNode(
  node: StableFormulaNode,
  resolver: SheetResolver,
  currentSheet: Sheet,
): string {
  switch (node.type) {
    case 'number':
      return String(node.value);
    case 'string':
      return typeof node.value === 'string' ? `"${node.value}"` : String(node.value ?? '');
    case 'variable':
      return String(node.value ?? '');
    case 'cell':
      return node.cellRef ? renderRef(node.cellRef, resolver, currentSheet) : '#REF!';
    case 'range':
      if (!node.rangeRef) return '#REF!';
      return `${renderRef(node.rangeRef.start, resolver, currentSheet)}:${renderRef(node.rangeRef.end, resolver, currentSheet)}`;
    case 'function':
      return `${node.functionName ?? ''}(${(node.args ?? [])
        .map((a) => renderNode(a, resolver, currentSheet))
        .join(',')})`;
    case 'operator': {
      const l = node.left ? renderNode(node.left, resolver, currentSheet) : '';
      const r = node.right ? renderNode(node.right, resolver, currentSheet) : '';
      return `${l}${node.operator ?? ''}${r}`;
    }
    default:
      return '';
  }
}

function renderRef(
  ref: StableCellRef,
  resolver: SheetResolver,
  currentSheet: Sheet,
): string {
  const sheet = ref.sheetName ? (resolver.getSheet(ref.sheetName) ?? currentSheet) : currentSheet;
  const row = sheet.getRowIndex(ref.rowId);
  const col = sheet.getColIndex(ref.colId);
  if (row === undefined || col === undefined) return '#REF!';
  const colLabel = columnIndexToLabel(col);
  const cell =
    (ref.colAbsolute ? '$' : '') + colLabel + (ref.rowAbsolute ? '$' : '') + (row + 1);
  if (ref.sheetName) {
    return /\s/.test(ref.sheetName) ? `'${ref.sheetName}'!${cell}` : `${ref.sheetName}!${cell}`;
  }
  return cell;
}

// ============================================================================
// Dependency extraction (returns stable graph keys "rowId:colId")
// ============================================================================

// ============================================================================
// Copy/paste rebasing (used by fill, copy)
// ============================================================================

/**
 * Produce a new stable AST suitable for pasting a formula that originated at
 * (sourceRow, sourceCol) into a cell at (targetRow, targetCol).
 *
 * Absolute refs ($A$1) are preserved unchanged — they continue to identify
 * the same cell. Relative refs are rebased by the source→target offset: if
 * the original ref pointed at the cell at (srcRow + N), the new ref points
 * at the cell at (tgtRow + N). This is the spreadsheet drag-fill convention.
 *
 * Replaces the old regex-based adjustFormula on A1 strings; the AST walk
 * is correct under arbitrary row/column reorderings whereas the regex
 * implicitly assumed numeric coords matched current indices.
 */
export function adjustStableAstForCopy(
  node: StableFormulaNode,
  resolver: SheetResolver,
  currentSheet: Sheet,
  sourceRow: number,
  sourceCol: number,
  targetRow: number,
  targetCol: number,
): StableFormulaNode {
  const out: StableFormulaNode = { type: node.type };
  if (node.value !== undefined) out.value = node.value;
  if (node.functionName !== undefined) out.functionName = node.functionName;
  if (node.operator !== undefined) out.operator = node.operator;
  if (node.cellRef) {
    out.cellRef = rebaseRef(
      node.cellRef,
      resolver,
      currentSheet,
      sourceRow,
      sourceCol,
      targetRow,
      targetCol,
    );
  }
  if (node.rangeRef) {
    out.rangeRef = {
      start: rebaseRef(
        node.rangeRef.start,
        resolver,
        currentSheet,
        sourceRow,
        sourceCol,
        targetRow,
        targetCol,
      ),
      end: rebaseRef(
        node.rangeRef.end,
        resolver,
        currentSheet,
        sourceRow,
        sourceCol,
        targetRow,
        targetCol,
      ),
    };
  }
  if (node.args) {
    out.args = node.args.map((a) =>
      adjustStableAstForCopy(a, resolver, currentSheet, sourceRow, sourceCol, targetRow, targetCol),
    );
  }
  if (node.left) {
    out.left = adjustStableAstForCopy(
      node.left, resolver, currentSheet, sourceRow, sourceCol, targetRow, targetCol,
    );
  }
  if (node.right) {
    out.right = adjustStableAstForCopy(
      node.right, resolver, currentSheet, sourceRow, sourceCol, targetRow, targetCol,
    );
  }
  return out;
}

function rebaseRef(
  ref: StableCellRef,
  resolver: SheetResolver,
  currentSheet: Sheet,
  sourceRow: number,
  sourceCol: number,
  targetRow: number,
  targetCol: number,
): StableCellRef {
  const sheet = ref.sheetName ? (resolver.getSheet(ref.sheetName) ?? currentSheet) : currentSheet;

  let newRowId = ref.rowId;
  let newColId = ref.colId;

  if (!ref.rowAbsolute) {
    const cur = sheet.getRowIndex(ref.rowId);
    if (cur !== undefined) {
      const offset = cur - sourceRow;
      const newRow = Math.max(0, targetRow + offset);
      newRowId = sheet.ensureRowId(newRow);
    }
  }
  if (!ref.colAbsolute) {
    const cur = sheet.getColIndex(ref.colId);
    if (cur !== undefined) {
      const offset = cur - sourceCol;
      const newCol = Math.max(0, targetCol + offset);
      newColId = sheet.ensureColId(newCol);
    }
  }

  return {
    rowId: newRowId,
    colId: newColId,
    rowAbsolute: ref.rowAbsolute,
    colAbsolute: ref.colAbsolute,
    sheetName: ref.sheetName,
  };
}

/**
 * Walk the stable AST and collect dependency keys for the formula graph.
 * Cross-sheet refs are skipped — the in-sheet graph doesn't track them
 * (matches the pre-existing limitation of the numeric-key path).
 */
export function collectStableDependencies(node: StableFormulaNode): FormulaDependencies {
  const cells = new Set<string>();
  const ranges: RangeDependency[] = [];
  const visit = (n: StableFormulaNode): void => {
    if (n.cellRef && !n.cellRef.sheetName) {
      cells.add(`${n.cellRef.rowId}:${n.cellRef.colId}`);
    }
    // A range is kept as its two corner keys — a rectangle. Containment is
    // tested at recalc time, so a cell that is empty when the formula is
    // entered, or a row/column inserted into the range later, is still tracked.
    if (n.rangeRef && !n.rangeRef.start.sheetName && !n.rangeRef.end.sheetName) {
      ranges.push({
        startKey: `${n.rangeRef.start.rowId}:${n.rangeRef.start.colId}`,
        endKey: `${n.rangeRef.end.rowId}:${n.rangeRef.end.colId}`,
      });
    }
    for (const a of n.args ?? []) visit(a);
    if (n.left) visit(n.left);
    if (n.right) visit(n.right);
  };
  visit(node);
  return { cells, ranges };
}

/** True when a formula contains a volatile function (RAND, NOW, OFFSET, …). */
export function formulaIsVolatile(node: StableFormulaNode): boolean {
  if (node.functionName && volatileFunctions.has(node.functionName.toUpperCase())) {
    return true;
  }
  for (const a of node.args ?? []) {
    if (formulaIsVolatile(a)) return true;
  }
  if (node.left && formulaIsVolatile(node.left)) return true;
  if (node.right && formulaIsVolatile(node.right)) return true;
  return false;
}
