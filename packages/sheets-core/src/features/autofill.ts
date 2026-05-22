// Autofill - series detection for the drag-to-fill handle

import type { CellValue } from '../types';

/**
 * The kind of fill pattern detected across a run of source cells.
 */
export type SeriesKind =
  | { kind: 'arithmetic'; start: number; step: number }
  | { kind: 'copy' };

/**
 * Inspect the source values of an autofill drag and decide how to extend them.
 *
 * Returns an `arithmetic` series when every value is a number and the
 * consecutive differences are equal (e.g. 1,2,3 or 10,20,30). Anything else —
 * a single cell, text, mixed types, booleans — is a `copy` fill, so a lone
 * value tiles unchanged.
 *
 * NOTE: date series (Jan, Feb, Mar …) are out of scope for v1 — they need the
 * cell's CellFormat and are a planned follow-up.
 */
export function detectSeries(values: CellValue[]): SeriesKind {
  if (values.length < 2) return { kind: 'copy' };
  if (!values.every((v) => typeof v === 'number')) return { kind: 'copy' };

  const nums = values as number[];
  const step = nums[1] - nums[0];
  for (let i = 2; i < nums.length; i++) {
    const diff = nums[i] - nums[i - 1];
    const tol = 1e-9 * Math.max(1, Math.abs(step), Math.abs(diff));
    if (Math.abs(diff - step) > tol) return { kind: 'copy' };
  }
  return { kind: 'arithmetic', start: nums[0], step };
}

/**
 * Produce the value at `index` positions from the start of the source run.
 * `index` is relative to the first source value: 0..n-1 reproduce the source,
 * indices outside that range extrapolate the series (forward or backward).
 */
export function extrapolate(
  series: SeriesKind,
  source: CellValue[],
  index: number
): CellValue {
  if (series.kind === 'arithmetic') {
    return series.start + series.step * index;
  }
  const n = source.length;
  if (n === 0) return null;
  const i = ((index % n) + n) % n;
  return source[i];
}
