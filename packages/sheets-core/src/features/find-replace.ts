// Find & Replace - search and substitution helpers over a sheet's cells

import type { Sheet, Cell, CellValue } from '../types';

export interface FindReplaceOptions {
  /** Case-sensitive comparison when true. */
  matchCase?: boolean;
  /** Require the whole cell to equal the query (vs. a substring match). */
  wholeCell?: boolean;
  /** Search (and replace within) a cell's formula text instead of its value. */
  searchFormulas?: boolean;
}

export interface CellMatch {
  row: number;
  col: number;
}

/** What a replace should write back to a cell. */
export type ReplaceResult =
  | { kind: 'value'; value: CellValue }
  | { kind: 'formula'; formula: string }
  | { kind: 'none' };

/**
 * The string a cell contributes to a search. Formula cells search their
 * formula text only when `searchFormulas` is set; otherwise the raw value
 * (numbers and booleans stringified) is used.
 */
export function cellSearchText(
  cell: Cell | undefined,
  opts: FindReplaceOptions
): string {
  if (!cell) return '';
  if (opts.searchFormulas && cell.formula) return cell.formula;
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

function textMatches(
  text: string,
  query: string,
  opts: FindReplaceOptions
): boolean {
  if (query === '') return false;
  const a = opts.matchCase ? text : text.toLowerCase();
  const b = opts.matchCase ? query : query.toLowerCase();
  return opts.wholeCell ? a === b : a.includes(b);
}

function replaceText(
  text: string,
  query: string,
  replacement: string,
  opts: FindReplaceOptions
): string {
  if (query === '') return text;
  if (opts.wholeCell) {
    const a = opts.matchCase ? text : text.toLowerCase();
    const b = opts.matchCase ? query : query.toLowerCase();
    return a === b ? replacement : text;
  }
  if (opts.matchCase) {
    return text.split(query).join(replacement);
  }
  // Case-insensitive substring replace, preserving the surrounding text.
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (lowerText.startsWith(lowerQuery, i)) {
      result += replacement;
      i += lowerQuery.length;
    } else {
      result += text[i];
      i++;
    }
  }
  return result;
}

/** Coerce a replaced string back to a number when it parses cleanly. */
function coerceValue(s: string): CellValue {
  if (s.trim() === '') return s;
  const n = Number(s);
  return Number.isFinite(n) ? n : s;
}

/**
 * Every cell matching `query`, ordered top-to-bottom, left-to-right.
 */
export function findMatches(
  sheet: Sheet,
  query: string,
  opts: FindReplaceOptions = {}
): CellMatch[] {
  const matches: CellMatch[] = [];
  if (query === '') return matches;
  for (const [row, col, cell] of sheet.entries()) {
    if (textMatches(cellSearchText(cell, opts), query, opts)) {
      matches.push({ row, col });
    }
  }
  matches.sort((a, b) => a.row - b.row || a.col - b.col);
  return matches;
}

/**
 * Compute the substitution for a single cell. Formula cells are left
 * untouched unless `searchFormulas` is set. A replaced value is coerced to a
 * number when it parses as one, otherwise stored as a string. Returns
 * `{ kind: 'none' }` when nothing changes.
 */
export function computeReplacement(
  cell: Cell | undefined,
  query: string,
  replacement: string,
  opts: FindReplaceOptions = {}
): ReplaceResult {
  if (!cell || query === '') return { kind: 'none' };

  if (cell.formula) {
    if (!opts.searchFormulas) return { kind: 'none' };
    if (!textMatches(cell.formula, query, opts)) return { kind: 'none' };
    const updated = replaceText(cell.formula, query, replacement, opts);
    return updated === cell.formula
      ? { kind: 'none' }
      : { kind: 'formula', formula: updated };
  }

  const text = cellSearchText(cell, opts);
  if (!textMatches(text, query, opts)) return { kind: 'none' };
  const updated = replaceText(text, query, replacement, opts);
  if (updated === text) return { kind: 'none' };
  return { kind: 'value', value: coerceValue(updated) };
}
