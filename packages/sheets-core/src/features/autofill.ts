// Autofill - series detection for the drag-to-fill handle

import type { CellValue } from '../types';
import { excelDateToJS, jsToExcelDate } from '../utils/format-utils';

// Built-in fill lists, mirroring Excel's default custom lists.
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DAYS_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const DAYS_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FILL_LISTS = [MONTHS_FULL, MONTHS_ABBR, DAYS_FULL, DAYS_ABBR];

type Casing = 'lower' | 'upper' | 'title';

/**
 * The kind of fill pattern detected across a run of source cells.
 */
export type SeriesKind =
  | { kind: 'arithmetic'; start: number; step: number }
  | { kind: 'dateMonth'; startSerial: number; monthStep: number }
  | { kind: 'list'; list: string[]; startIndex: number; step: number; casing: Casing }
  | { kind: 'textNumber'; prefix: string; start: number; step: number; pad: number }
  | { kind: 'copy' };

export interface DetectSeriesOptions {
  /** The source cells are date-formatted — enables month/year series detection. */
  isDate?: boolean;
}

/** Detect a constant-step run of numbers (needs at least two values). */
function detectArithmetic(nums: number[]): SeriesKind | null {
  if (nums.length < 2) return null;
  const step = nums[1] - nums[0];
  for (let i = 2; i < nums.length; i++) {
    const diff = nums[i] - nums[i - 1];
    const tol = 1e-9 * Math.max(1, Math.abs(step), Math.abs(diff));
    if (Math.abs(diff - step) > tol) return null;
  }
  return { kind: 'arithmetic', start: nums[0], step };
}

/**
 * Detect a date run that advances by a constant number of whole months —
 * every date shares the same day-of-month and consecutive months differ by a
 * constant. A 12-month step is a year series.
 */
function detectDateMonthSeries(serials: number[]): SeriesKind | null {
  if (serials.length < 2) return null;
  const dates = serials.map((s) => excelDateToJS(s));
  const day0 = dates[0].getUTCDate();
  if (!dates.every((d) => d.getUTCDate() === day0)) return null;

  const absMonth = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
  const step = absMonth(dates[1]) - absMonth(dates[0]);
  if (step === 0) return null;
  for (let i = 2; i < dates.length; i++) {
    if (absMonth(dates[i]) - absMonth(dates[i - 1]) !== step) return null;
  }
  return { kind: 'dateMonth', startSerial: serials[0], monthStep: step };
}

function detectCasing(s: string): Casing {
  const t = s.trim();
  if (t && t === t.toUpperCase() && t !== t.toLowerCase()) return 'upper';
  if (t && t === t.toLowerCase() && t !== t.toUpperCase()) return 'lower';
  return 'title';
}

function applyCasing(word: string, casing: Casing): string {
  if (casing === 'upper') return word.toUpperCase();
  if (casing === 'lower') return word.toLowerCase();
  return word; // list entries are already title case
}

/** Detect a run that walks one of the built-in lists (month/weekday names). */
function detectListSeries(strs: string[]): SeriesKind | null {
  for (const list of FILL_LISTS) {
    const lower = list.map((x) => x.toLowerCase());
    const indices = strs.map((s) => lower.indexOf(s.trim().toLowerCase()));
    if (indices.some((i) => i < 0)) continue;

    const len = list.length;
    let step = 1;
    if (indices.length >= 2) {
      step = (((indices[1] - indices[0]) % len) + len) % len;
      if (step === 0) return null; // every value identical — a copy, not a series
      let consistent = true;
      for (let i = 2; i < indices.length; i++) {
        const d = (((indices[i] - indices[i - 1]) % len) + len) % len;
        if (d !== step) { consistent = false; break; }
      }
      if (!consistent) continue;
    }
    return {
      kind: 'list',
      list,
      startIndex: indices[0],
      step,
      casing: detectCasing(strs[0]),
    };
  }
  return null;
}

/** Detect text with a trailing number (Q1 → Q2, Item 1 → Item 2). */
function detectTextNumberSeries(strs: string[]): SeriesKind | null {
  const re = /^(.*?)(\d+)$/;
  const matches: RegExpExecArray[] = [];
  for (const s of strs) {
    const m = re.exec(s);
    if (!m) return null;
    matches.push(m);
  }
  const prefix = matches[0][1];
  if (!matches.every((m) => m[1] === prefix)) return null;

  const nums = matches.map((m) => parseInt(m[2], 10));
  // Preserve zero-padding when every token is the same width and padded.
  const widths = matches.map((m) => m[2].length);
  const pad =
    widths.every((w) => w === widths[0]) && matches[0][2].startsWith('0')
      ? widths[0]
      : 0;

  let step = 1;
  if (nums.length >= 2) {
    step = nums[1] - nums[0];
    for (let i = 2; i < nums.length; i++) {
      if (nums[i] - nums[i - 1] !== step) return null;
    }
    if (step === 0) return null;
  }
  return { kind: 'textNumber', prefix, start: nums[0], step, pad };
}

/**
 * Inspect the source values of an autofill drag and decide how to extend them.
 *
 * Numbers extend as an arithmetic series; a lone number copies (matching
 * Excel). With `isDate`, a run also detects month/year stepping. Strings
 * detect the built-in month/weekday lists and text-with-trailing-number
 * patterns. Anything else is a `copy` fill, so the source tiles unchanged.
 */
export function detectSeries(
  values: CellValue[],
  opts: DetectSeriesOptions = {}
): SeriesKind {
  if (values.length === 0) return { kind: 'copy' };

  if (values.every((v) => typeof v === 'number')) {
    const nums = values as number[];
    if (opts.isDate) {
      // A lone date, or a constant day-step run, extends day-by-day; a
      // month-spaced run extends by months. Month wins on a 2-cell run, where
      // a day step would otherwise be ambiguous.
      if (nums.length === 1) return { kind: 'arithmetic', start: nums[0], step: 1 };
      return (
        detectDateMonthSeries(nums) ??
        detectArithmetic(nums) ??
        { kind: 'copy' }
      );
    }
    return detectArithmetic(nums) ?? { kind: 'copy' };
  }

  if (values.every((v) => typeof v === 'string')) {
    const strs = values as string[];
    return (
      detectListSeries(strs) ??
      detectTextNumberSeries(strs) ??
      { kind: 'copy' }
    );
  }

  return { kind: 'copy' };
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
  switch (series.kind) {
    case 'arithmetic':
      return series.start + series.step * index;

    case 'dateMonth': {
      const base = excelDateToJS(series.startSerial);
      const totalMonths = base.getUTCMonth() + series.monthStep * index;
      const year = base.getUTCFullYear() + Math.floor(totalMonths / 12);
      const month = ((totalMonths % 12) + 12) % 12;
      // Clamp the day to the target month's length (e.g. Jan 31 → Feb 28).
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const day = Math.min(base.getUTCDate(), lastDay);
      return jsToExcelDate(new Date(Date.UTC(year, month, day)));
    }

    case 'list': {
      const len = series.list.length;
      const i = (((series.startIndex + series.step * index) % len) + len) % len;
      return applyCasing(series.list[i], series.casing);
    }

    case 'textNumber': {
      const n = series.start + series.step * index;
      let numStr = String(n);
      if (series.pad > 0 && n >= 0) numStr = numStr.padStart(series.pad, '0');
      return series.prefix + numStr;
    }

    case 'copy': {
      const n = source.length;
      if (n === 0) return null;
      const i = ((index % n) + n) % n;
      return source[i];
    }
  }
}
