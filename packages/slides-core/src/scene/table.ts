// Pure table-grid operations. A table stores column/row sizes as fractions of
// its box (they always sum to ~1), and a row-major grid of cells. Every helper
// returns the changed subset as a Partial<TableElement>; the deck applies it via
// updateElement so undo/collab treat a structural edit as one change.

import type { RichTextDoc } from '../text/model';
import { emptyRichText } from '../text/model';
import type { TableCell, TableElement } from './types';

const MIN_FRACTION = 0.04;

export function evenFractions(n: number): number[] {
  return Array.from({ length: Math.max(1, n) }, () => 1 / Math.max(1, n));
}

function normalize(fracs: number[]): number[] {
  const sum = fracs.reduce((a, b) => a + b, 0) || 1;
  return fracs.map((f) => f / sum);
}

export function emptyCell(): TableCell {
  return { richText: emptyRichText() as RichTextDoc };
}

/** A fresh rows×cols grid of empty cells. */
export function makeGrid(rows: number, cols: number): TableCell[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, emptyCell));
}

/** Insert a row at `at` (0..rows); existing rows shrink proportionally. */
export function insertRow(t: TableElement, at: number): Partial<TableElement> {
  const rows = t.rows + 1;
  const idx = clamp(at, 0, t.rows);
  const scaled = t.rowFractions.map((f) => (f * t.rows) / rows);
  scaled.splice(idx, 0, 1 / rows);
  const cells = t.cells.map((r) => r.slice());
  cells.splice(idx, 0, Array.from({ length: t.cols }, emptyCell));
  const patch: Partial<TableElement> = { rows, rowFractions: normalize(scaled), cells };
  if (t.rowHeights) { const rh = t.rowHeights.slice(); rh.splice(idx, 0, 0); patch.rowHeights = rh; } // new row auto-sizes
  return patch;
}

/** Insert a column at `at` (0..cols); existing columns shrink proportionally. */
export function insertColumn(t: TableElement, at: number): Partial<TableElement> {
  const cols = t.cols + 1;
  const scaled = t.colFractions.map((f) => (f * t.cols) / cols);
  const idx = clamp(at, 0, t.cols);
  scaled.splice(idx, 0, 1 / cols);
  const cells = t.cells.map((r) => {
    const nr = r.slice();
    nr.splice(idx, 0, emptyCell());
    return nr;
  });
  return { cols, colFractions: normalize(scaled), cells };
}

/** Remove row `at` (no-op if only one row remains). */
export function removeRow(t: TableElement, at: number): Partial<TableElement> {
  if (t.rows <= 1) return {};
  const idx = clamp(at, 0, t.rows - 1);
  const fr = t.rowFractions.slice();
  fr.splice(idx, 1);
  const cells = t.cells.slice();
  cells.splice(idx, 1);
  const patch: Partial<TableElement> = { rows: t.rows - 1, rowFractions: normalize(fr), cells };
  if (t.rowHeights) { const rh = t.rowHeights.slice(); rh.splice(idx, 1); patch.rowHeights = rh; }
  return patch;
}

/** Remove column `at` (no-op if only one column remains). */
export function removeColumn(t: TableElement, at: number): Partial<TableElement> {
  if (t.cols <= 1) return {};
  const idx = clamp(at, 0, t.cols - 1);
  const fr = t.colFractions.slice();
  fr.splice(idx, 1);
  const cells = t.cells.map((r) => r.filter((_, c) => c !== idx));
  return { cols: t.cols - 1, colFractions: normalize(fr), cells };
}

/** Resize the boundary between column `index` and `index+1` by `delta` (a
 *  fraction of table width), borrowing from the right neighbor. */
export function resizeColumn(t: TableElement, index: number, delta: number): Partial<TableElement> {
  if (index < 0 || index >= t.cols - 1) return {};
  const fr = t.colFractions.slice();
  const d = clampDelta(fr[index], fr[index + 1], delta);
  fr[index] += d;
  fr[index + 1] -= d;
  return { colFractions: fr };
}

/** Set row `index`'s minimum height in px (content can still push it taller).
 *  0 restores auto (content-driven) sizing. */
export function setRowHeight(t: TableElement, index: number, height: number): Partial<TableElement> {
  if (index < 0 || index >= t.rows) return {};
  const rh = (t.rowHeights ?? Array.from({ length: t.rows }, () => 0)).slice();
  rh.length = t.rows; // guard against a stale-length array
  for (let i = 0; i < t.rows; i++) rh[i] = rh[i] ?? 0;
  rh[index] = Math.max(0, Math.round(height));
  return { rowHeights: rh };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Keep both sides ≥ MIN_FRACTION when shifting a boundary. */
function clampDelta(a: number, b: number, delta: number): number {
  return clamp(delta, MIN_FRACTION - a, b - MIN_FRACTION);
}
