// Reference-aware functions.
//
// Unlike every other category, these need an argument's *reference* — its
// row/column coordinates — rather than its evaluated value. They receive the
// raw argument AST and the current cell position (see RefFn / RefFnContext).
//
// Dependency-tracking note: the parser records dependencies statically, so a
// cell that OFFSETs or INDIRECTs to another cell is not re-evaluated when that
// target changes. The computed value is correct on (re)evaluation; live
// recalculation would need volatile-function support in the engine.

import type { CellReference, RangeReference } from '../types';
import type { RefFn } from './helpers';
import { toNum, toText } from './helpers';
import { parseCellReference, parseRangeReference, columnIndexToLabel } from '../cell-reference';

/** Row count of an evaluated array value (fallback when the arg isn't a range). */
function arrayRowCount(v: unknown): number {
  return Array.isArray(v) ? (v.length > 0 && Array.isArray(v[0]) ? v.length : 1) : 1;
}

/** Column count of an evaluated array value. */
function arrayColCount(v: unknown): number {
  if (!Array.isArray(v)) return 1;
  return v.length > 0 && Array.isArray(v[0]) ? (v[0] as unknown[]).length : v.length;
}

/** Absolute row of a reference (relative refs are stored as offsets). */
function resolveRow(ref: CellReference, currentRow: number): number {
  return ref.rowAbsolute ? ref.row : currentRow + ref.row;
}

/** Absolute column of a reference. */
function resolveCol(ref: CellReference, currentCol: number): number {
  return ref.colAbsolute ? ref.col : currentCol + ref.col;
}

/** An absolute single-cell RangeReference bound, used to read computed ranges. */
function absBound(row: number, col: number, sheetName?: string): CellReference {
  return { row, col, rowAbsolute: true, colAbsolute: true, sheetName };
}

export const referenceFunctions: Record<string, RefFn> = {
  ROW: ({ args, currentRow }) => {
    if (args.length === 0) return currentRow + 1;
    const node = args[0];
    if (node.type === 'cell' && node.cellRef) {
      return resolveRow(node.cellRef, currentRow) + 1;
    }
    if (node.type === 'range' && node.rangeRef) {
      return (
        Math.min(
          resolveRow(node.rangeRef.start, currentRow),
          resolveRow(node.rangeRef.end, currentRow)
        ) + 1
      );
    }
    throw new Error('#VALUE!');
  },

  COLUMN: ({ args, currentCol }) => {
    if (args.length === 0) return currentCol + 1;
    const node = args[0];
    if (node.type === 'cell' && node.cellRef) {
      return resolveCol(node.cellRef, currentCol) + 1;
    }
    if (node.type === 'range' && node.rangeRef) {
      return (
        Math.min(
          resolveCol(node.rangeRef.start, currentCol),
          resolveCol(node.rangeRef.end, currentCol)
        ) + 1
      );
    }
    throw new Error('#VALUE!');
  },

  // ROWS/COLUMNS are ref-aware so they read a range's true size from the
  // reference rather than the materialized values. This is both correct for huge
  // ranges (=ROWS(A1:A1048576) is 1048576, not the populated-data extent that
  // getRangeValues clamps to for DoS safety) and free of that per-eval extent
  // scan. A non-range argument (an array literal or a function that returns an
  // array) falls back to measuring the evaluated value.
  ROWS: ({ args, currentRow, evaluate }) => {
    const node = args[0];
    if (node?.type === 'range' && node.rangeRef) {
      return Math.abs(resolveRow(node.rangeRef.end, currentRow) - resolveRow(node.rangeRef.start, currentRow)) + 1;
    }
    if (node?.type === 'cell' && node.cellRef) return 1;
    return arrayRowCount(evaluate(node));
  },

  COLUMNS: ({ args, currentCol, evaluate }) => {
    const node = args[0];
    if (node?.type === 'range' && node.rangeRef) {
      return Math.abs(resolveCol(node.rangeRef.end, currentCol) - resolveCol(node.rangeRef.start, currentCol)) + 1;
    }
    if (node?.type === 'cell' && node.cellRef) return 1;
    return arrayColCount(evaluate(node));
  },

  OFFSET: ({ args, ctx, currentRow, currentCol, evaluate }) => {
    const ref = args[0];
    let baseRow: number;
    let baseCol: number;
    let baseHeight: number;
    let baseWidth: number;
    let sheetName: string | undefined;

    if (ref.type === 'cell' && ref.cellRef) {
      baseRow = resolveRow(ref.cellRef, currentRow);
      baseCol = resolveCol(ref.cellRef, currentCol);
      baseHeight = 1;
      baseWidth = 1;
      sheetName = ref.cellRef.sheetName;
    } else if (ref.type === 'range' && ref.rangeRef) {
      const r1 = resolveRow(ref.rangeRef.start, currentRow);
      const r2 = resolveRow(ref.rangeRef.end, currentRow);
      const c1 = resolveCol(ref.rangeRef.start, currentCol);
      const c2 = resolveCol(ref.rangeRef.end, currentCol);
      baseRow = Math.min(r1, r2);
      baseCol = Math.min(c1, c2);
      baseHeight = Math.abs(r2 - r1) + 1;
      baseWidth = Math.abs(c2 - c1) + 1;
      sheetName = ref.rangeRef.start.sheetName ?? ref.rangeRef.end.sheetName;
    } else {
      throw new Error('#REF!');
    }

    const rowsOffset = args[1] !== undefined ? Math.trunc(toNum(evaluate(args[1]))) : 0;
    const colsOffset = args[2] !== undefined ? Math.trunc(toNum(evaluate(args[2]))) : 0;
    const height = args[3] !== undefined ? Math.trunc(toNum(evaluate(args[3]))) : baseHeight;
    const width = args[4] !== undefined ? Math.trunc(toNum(evaluate(args[4]))) : baseWidth;
    if (height < 1 || width < 1) throw new Error('#REF!');

    const newRow = baseRow + rowsOffset;
    const newCol = baseCol + colsOffset;
    if (newRow < 0 || newCol < 0) throw new Error('#REF!');

    if (height === 1 && width === 1) {
      return ctx.getCellValue(newRow, newCol, undefined, sheetName);
    }
    const range: RangeReference = {
      start: absBound(newRow, newCol, sheetName),
      end: absBound(newRow + height - 1, newCol + width - 1, sheetName),
    };
    return ctx.getRangeValues(range, undefined, sheetName);
  },

  INDIRECT: ({ args, ctx, evaluate }) => {
    const text = toText(evaluate(args[0]));
    const range = parseRangeReference(text);
    if (range) {
      const sheetName = range.start.sheetName ?? range.end.sheetName;
      const resolved: RangeReference = {
        start: absBound(range.start.row, range.start.col, sheetName),
        end: absBound(range.end.row, range.end.col, sheetName),
      };
      return ctx.getRangeValues(resolved, undefined, sheetName);
    }
    const cell = parseCellReference(text);
    if (cell) {
      return ctx.getCellValue(cell.row, cell.col, undefined, cell.sheetName);
    }
    throw new Error('#REF!');
  },

  ISREF: ({ args }) => {
    const node = args[0];
    if (!node) return false;
    if (node.type === 'cell' || node.type === 'range') return true;
    return (
      node.type === 'function' &&
      (node.functionName === 'OFFSET' || node.functionName === 'INDIRECT')
    );
  },

  ISFORMULA: ({ args, ctx, currentRow, currentCol }) => {
    const node = args[0];
    if (node?.type !== 'cell' || !node.cellRef) throw new Error('#VALUE!');
    if (!ctx.isCellFormula) return false;
    return ctx.isCellFormula(
      resolveRow(node.cellRef, currentRow),
      resolveCol(node.cellRef, currentCol),
      node.cellRef.sheetName
    );
  },

  CELL: ({ args, ctx, currentRow, currentCol, evaluate }) => {
    const infoType = toText(evaluate(args[0])).toLowerCase();

    let row = currentRow;
    let col = currentCol;
    let sheetName: string | undefined;
    if (args[1] !== undefined) {
      const node = args[1];
      if (node.type === 'cell' && node.cellRef) {
        row = resolveRow(node.cellRef, currentRow);
        col = resolveCol(node.cellRef, currentCol);
        sheetName = node.cellRef.sheetName;
      } else if (node.type === 'range' && node.rangeRef) {
        row = Math.min(
          resolveRow(node.rangeRef.start, currentRow),
          resolveRow(node.rangeRef.end, currentRow)
        );
        col = Math.min(
          resolveCol(node.rangeRef.start, currentCol),
          resolveCol(node.rangeRef.end, currentCol)
        );
        sheetName = node.rangeRef.start.sheetName ?? node.rangeRef.end.sheetName;
      } else {
        throw new Error('#VALUE!');
      }
    }

    switch (infoType) {
      case 'address':
        return `$${columnIndexToLabel(col)}$${row + 1}`;
      case 'row':
        return row + 1;
      case 'col':
        return col + 1;
      case 'contents':
        return ctx.getCellValue(row, col, undefined, sheetName) ?? 0;
      case 'type': {
        const value = ctx.getCellValue(row, col, undefined, sheetName);
        if (value == null || value === '') return 'b';
        return typeof value === 'string' ? 'l' : 'v';
      }
      default:
        throw new Error('#VALUE!');
    }
  },
};
