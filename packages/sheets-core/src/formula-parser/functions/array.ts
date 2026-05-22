// Array-returning functions — the building blocks of dynamic arrays.
//
// Each returns a 2D array (`unknown[][]`). On its own that already works as
// input to another function; the spill engine makes a top-level array result
// fill a block of cells.

import type { EagerFn } from './helpers';
import { flatten, toNum, toText, toBoolean, toMatrix, compareValues } from './helpers';

/** Swap rows and columns of a matrix. */
function transpose(matrix: unknown[][]): unknown[][] {
  if (matrix.length === 0) return [];
  const rows = matrix.length;
  const cols = matrix[0].length;
  const out: unknown[][] = [];
  for (let c = 0; c < cols; c++) {
    const row: unknown[] = [];
    for (let r = 0; r < rows; r++) row.push(matrix[r][c]);
    out.push(row);
  }
  return out;
}

export const arrayFunctions: Record<string, EagerFn> = {
  SEQUENCE: (args) => {
    const rows = Math.trunc(toNum(args[0]));
    const cols = args[1] !== undefined ? Math.trunc(toNum(args[1])) : 1;
    const start = args[2] !== undefined ? toNum(args[2]) : 1;
    const step = args[3] !== undefined ? toNum(args[3]) : 1;
    if (rows < 1 || cols < 1) throw new Error('#VALUE!');
    const out: unknown[][] = [];
    let value = start;
    for (let r = 0; r < rows; r++) {
      const row: unknown[] = [];
      for (let c = 0; c < cols; c++) {
        row.push(value);
        value += step;
      }
      out.push(row);
    }
    return out;
  },

  UNIQUE: (args) => {
    const matrix = toMatrix(args[0]);
    const byColumn = args[1] !== undefined && toBoolean(args[1]);
    const exactlyOnce = args[2] !== undefined && toBoolean(args[2]);
    const rows = byColumn ? transpose(matrix) : matrix;

    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = JSON.stringify(row);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const added = new Set<string>();
    const result: unknown[][] = [];
    for (const row of rows) {
      const key = JSON.stringify(row);
      if (added.has(key)) continue;
      added.add(key);
      if (exactlyOnce && counts.get(key) !== 1) continue;
      result.push(row);
    }
    if (result.length === 0) throw new Error('#CALC!');
    return byColumn ? transpose(result) : result;
  },

  SORT: (args) => {
    const matrix = toMatrix(args[0]);
    const sortIndex = args[1] !== undefined ? Math.trunc(toNum(args[1])) : 1;
    const sortOrder = args[2] !== undefined ? toNum(args[2]) : 1;
    const byColumn = args[3] !== undefined && toBoolean(args[3]);
    const rows = byColumn ? transpose(matrix) : matrix;
    const index = sortIndex - 1;
    const sorted = [...rows].sort((a, b) => {
      const cmp = compareValues(a[index], b[index]);
      return sortOrder < 0 ? -cmp : cmp;
    });
    return byColumn ? transpose(sorted) : sorted;
  },

  SORTBY: (args) => {
    const matrix = toMatrix(args[0]);
    const keys: Array<{ values: unknown[]; order: number }> = [];
    for (let i = 1; i < args.length; i += 2) {
      keys.push({
        values: flatten([args[i]]),
        order: args[i + 1] !== undefined ? toNum(args[i + 1]) : 1,
      });
    }
    const order = matrix.map((_, i) => i);
    order.sort((a, b) => {
      for (const key of keys) {
        const cmp = compareValues(key.values[a], key.values[b]);
        if (cmp !== 0) return key.order < 0 ? -cmp : cmp;
      }
      return 0;
    });
    return order.map((i) => matrix[i]);
  },

  FILTER: (args) => {
    const matrix = toMatrix(args[0]);
    const include = flatten([args[1]]);
    const result: unknown[][] = [];
    for (let i = 0; i < matrix.length; i++) {
      if (toBoolean(include[i])) result.push(matrix[i]);
    }
    if (result.length === 0) {
      if (args[2] !== undefined) return [[args[2]]];
      throw new Error('#CALC!');
    }
    return result;
  },

  SPLIT: (args) => {
    const text = toText(args[0]);
    const delimiter = toText(args[1]);
    if (delimiter === '') throw new Error('#VALUE!');
    const splitByEach = args[2] === undefined ? true : toBoolean(args[2]);
    const removeEmpty = args[3] === undefined ? true : toBoolean(args[3]);

    let parts: string[];
    if (splitByEach && delimiter.length > 1) {
      const alternation = delimiter
        .split('')
        .map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
      parts = text.split(new RegExp(alternation));
    } else {
      parts = text.split(delimiter);
    }
    if (removeEmpty) parts = parts.filter((p) => p !== '');
    if (parts.length === 0) parts = [''];
    return [parts];
  },
};
