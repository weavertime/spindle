// Text functions.

import type { EagerFn } from './helpers';
import { flatten, toText, toNum, toBoolean } from './helpers';

/** Build a case-insensitive regex from a SEARCH pattern (`*` / `?` wildcards). */
function wildcardRegex(pattern: string): RegExp {
  let src = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '~' && i + 1 < pattern.length) {
      src += pattern[i + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i++;
    } else if (ch === '*') {
      // Collapse a run of '*' into a single '.*' — repeated '.*.*.*' is a
      // catastrophic-backtracking (ReDoS) pattern against a long non-match.
      if (!src.endsWith('.*')) src += '.*';
    } else if (ch === '?') {
      src += '.';
    } else {
      src += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(src, 'i');
}

/**
 * Render a number with a subset of the spreadsheet number-format language:
 * decimal places, thousands grouping, percent, scientific notation and a
 * leading currency symbol. Date format codes are not yet supported.
 */
function applyNumberFormat(num: number, format: string): string {
  if (format === '' || format.toLowerCase() === 'general') return String(num);

  // Format sections: positive;negative;zero (Excel). A negative or zero section
  // formats the magnitude and owns the sign, so no automatic minus is added.
  const sections = format.split(';');
  if (sections.length >= 2 && num < 0) {
    return formatMagnitude(Math.abs(num), sections[1]);
  }
  if (sections.length >= 3 && num === 0) {
    return formatMagnitude(0, sections[2]);
  }
  // Single section (or the positive section): keep the sign explicitly, but
  // take it from the *rounded* result — a value that rounds to zero (e.g.
  // TEXT(-0.4,"0")) must not render as "-0". If no non-zero digit survives the
  // formatting, the magnitude is zero and the minus is dropped.
  const body = formatMagnitude(Math.abs(num), sections[0]);
  const sign = num < 0 && /[1-9]/.test(body) ? '-' : '';
  return sign + body;
}

/** Format a non-negative number with one format section (no sign handling). */
function formatMagnitude(num: number, format: string): string {
  if (format === '') return '';
  if (format.toLowerCase() === 'general') return String(num);

  // Scientific notation, e.g. "0.00E+00".
  if (/[eE]\+?0+/.test(format)) {
    const decimals = (format.match(/\.(0+)[eE]/)?.[1] ?? '').length;
    const [mantissa, exp] = num.toExponential(decimals).split('e');
    const expNum = Number(exp);
    const expStr = (expNum < 0 ? '-' : '+') + String(Math.abs(expNum)).padStart(2, '0');
    return mantissa + 'E' + expStr;
  }

  const isPercent = format.includes('%');
  const working = isPercent ? num * 100 : num;
  const decimals = (format.split('.')[1]?.match(/[0#]/g) ?? []).length;
  const grouped = /[#0],[#0]/.test(format);
  const currency = format.trimStart().startsWith('$') ? '$' : '';

  const [rawInt, fracPart] = working.toFixed(decimals).split('.');
  const intPart = grouped ? rawInt.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : rawInt;
  let result = currency + intPart + (fracPart ? '.' + fracPart : '');
  if (isPercent) result += '%';
  return result;
}

export const textFunctions: Record<string, EagerFn> = {
  CONCAT: (args) => flatten(args).map(toText).join(''),

  CONCATENATE: (args) => flatten(args).map(toText).join(''),

  TEXTJOIN: (args) => {
    const delimiter = toText(args[0]);
    const ignoreEmpty = toBoolean(args[1]);
    const parts = flatten(args.slice(2)).map(toText);
    return (ignoreEmpty ? parts.filter((p) => p !== '') : parts).join(delimiter);
  },

  LEFT: (args) => {
    const text = toText(args[0]);
    const n = args[1] !== undefined ? toNum(args[1]) : 1;
    if (n < 0) throw new Error('#VALUE!');
    return text.slice(0, n);
  },

  RIGHT: (args) => {
    const text = toText(args[0]);
    const n = args[1] !== undefined ? toNum(args[1]) : 1;
    if (n < 0) throw new Error('#VALUE!');
    return n === 0 ? '' : text.slice(-n);
  },

  MID: (args) => {
    const text = toText(args[0]);
    const start = toNum(args[1]);
    const length = toNum(args[2]);
    if (start < 1 || length < 0) throw new Error('#VALUE!');
    return text.slice(start - 1, start - 1 + length);
  },

  LEN: (args) => toText(args[0]).length,

  FIND: (args) => {
    const find = toText(args[0]);
    const within = toText(args[1]);
    const start = args[2] !== undefined ? toNum(args[2]) : 1;
    if (start < 1) throw new Error('#VALUE!');
    const idx = within.indexOf(find, start - 1);
    if (idx < 0) throw new Error('#VALUE!');
    return idx + 1;
  },

  SEARCH: (args) => {
    const find = toText(args[0]);
    const within = toText(args[1]);
    const start = args[2] !== undefined ? toNum(args[2]) : 1;
    if (start < 1) throw new Error('#VALUE!');
    const match = within.slice(start - 1).match(wildcardRegex(find));
    if (!match || match.index === undefined) throw new Error('#VALUE!');
    return start + match.index;
  },

  SUBSTITUTE: (args) => {
    const text = toText(args[0]);
    const oldText = toText(args[1]);
    const newText = toText(args[2]);
    if (oldText === '') return text;
    if (args[3] === undefined) return text.split(oldText).join(newText);
    const instance = toNum(args[3]);
    if (instance < 1) throw new Error('#VALUE!');
    let pos = -1;
    let from = 0;
    for (let i = 0; i < instance; i++) {
      pos = text.indexOf(oldText, from);
      if (pos < 0) return text;
      from = pos + oldText.length;
    }
    return text.slice(0, pos) + newText + text.slice(pos + oldText.length);
  },

  REPLACE: (args) => {
    const oldText = toText(args[0]);
    const start = toNum(args[1]);
    const numChars = toNum(args[2]);
    const newText = toText(args[3]);
    if (start < 1 || numChars < 0) throw new Error('#VALUE!');
    return oldText.slice(0, start - 1) + newText + oldText.slice(start - 1 + numChars);
  },

  UPPER: (args) => toText(args[0]).toUpperCase(),

  LOWER: (args) => toText(args[0]).toLowerCase(),

  PROPER: (args) =>
    toText(args[0])
      .toLowerCase()
      .replace(/(^|[^a-zA-Z])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase()),

  TRIM: (args) => toText(args[0]).replace(/ +/g, ' ').trim(),

  TEXT: (args) => {
    const value = args[0];
    const num = typeof value === 'number' ? value : Number(toText(value));
    if (isNaN(num)) return toText(value);
    return applyNumberFormat(num, toText(args[1]));
  },

  VALUE: (args) => {
    const value = args[0];
    if (typeof value === 'number') return value;
    const text = toText(value).trim();
    if (text === '') return 0;
    let str = text.replace(/[$,\s]/g, '');
    let percent = false;
    if (str.endsWith('%')) {
      percent = true;
      str = str.slice(0, -1);
    }
    const num = Number(str);
    if (str === '' || isNaN(num)) throw new Error('#VALUE!');
    return percent ? num / 100 : num;
  },

  REPT: (args) => {
    const text = toText(args[0]);
    const count = Math.floor(toNum(args[1]));
    if (count < 0) throw new Error('#VALUE!');
    return text.repeat(count);
  },

  CHAR: (args) => {
    const code = Math.trunc(toNum(args[0]));
    if (code < 1 || code > 255) throw new Error('#VALUE!');
    return String.fromCharCode(code);
  },

  CODE: (args) => {
    const text = toText(args[0]);
    if (text === '') throw new Error('#VALUE!');
    return text.charCodeAt(0);
  },

  EXACT: (args) => toText(args[0]) === toText(args[1]),
};
