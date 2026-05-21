// Shared helpers for built-in formula functions.

import type { EvaluationContext, ParsedFormulaNode } from '../types';

/** An eager function receives already-evaluated argument values. */
export type EagerFn = (args: unknown[], ctx: EvaluationContext) => unknown;

/**
 * A lazy function receives thunks instead of values, so it can decide which
 * arguments to evaluate (and catch errors thrown while evaluating them).
 * Required by short-circuiting functions like IF, IFS and IFERROR.
 */
export type LazyFn = (argThunks: Array<() => unknown>, ctx: EvaluationContext) => unknown;

/**
 * What a reference function receives: the raw argument AST (so it can read an
 * argument's *reference* rather than its value), the current cell position,
 * and an `evaluate` callback for arguments that are plain values.
 */
export interface RefFnContext {
  args: ParsedFormulaNode[];
  ctx: EvaluationContext;
  currentRow: number;
  currentCol: number;
  evaluate: (node: ParsedFormulaNode) => unknown;
}

/**
 * A reference function works with an argument's reference — needed by
 * ROW/COLUMN/OFFSET/INDIRECT/ISREF/ISFORMULA/CELL.
 */
export type RefFn = (rc: RefFnContext) => unknown;

const ERROR_PATTERN = /^#(DIV\/0!|N\/A|NAME\?|NULL!|NUM!|REF!|VALUE!|ERROR!|SPILL!|CALC!)$/;

/** True when a value is one of the standard spreadsheet error strings. */
export function isErrorValue(v: unknown): boolean {
  return typeof v === 'string' && ERROR_PATTERN.test(v);
}

/** Recursively flatten range values (`unknown[][]`) and nested args into a flat list. */
export function flatten(args: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const a of args) {
    if (Array.isArray(a)) out.push(...flatten(a as unknown[]));
    else out.push(a);
  }
  return out;
}

/**
 * Coerce a single value to a number, the way a math function expects.
 * Blank counts as 0; booleans as 1/0; an error value re-throws that error.
 */
export function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v == null || v === '') return 0;
  if (typeof v === 'string') {
    if (isErrorValue(v)) throw new Error(v);
    const t = v.trim();
    if (t === '') return 0;
    const n = Number(t);
    if (!isNaN(n)) return n;
  }
  throw new Error('#VALUE!');
}

/** Coerce a value to text. Booleans render as TRUE/FALSE; blank as ''. */
export function toText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'string' && isErrorValue(v)) throw new Error(v);
  return String(v);
}

/** Coerce a value to a boolean using spreadsheet rules. */
export function toBoolean(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v == null || v === '') return false;
  if (typeof v === 'string') {
    const s = v.trim().toUpperCase();
    if (s === 'TRUE') return true;
    if (s === 'FALSE') return false;
    const n = Number(v);
    if (!isNaN(n) && v.trim() !== '') return n !== 0;
  }
  return Boolean(v);
}

/**
 * Pull the genuinely-numeric values out of a set of args, the way COUNT-style
 * aggregations do: actual numbers and numeric strings count; blanks, text and
 * booleans are ignored.
 */
export function strictNumbers(args: unknown[]): number[] {
  const out: number[] = [];
  for (const v of flatten(args)) {
    if (typeof v === 'number') {
      if (!isNaN(v)) out.push(v);
    } else if (typeof v === 'string') {
      const t = v.trim();
      if (t !== '' && !isNaN(Number(t))) out.push(Number(t));
    }
  }
  return out;
}

/** Excel-style equality used by SWITCH and lookup matching. */
export function looseEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.toLowerCase() === b.toLowerCase();
  }
  const na = Number(a);
  const nb = Number(b);
  return !isNaN(na) && !isNaN(nb) && a !== '' && b !== '' && a != null && b != null && na === nb;
}

/** Compare text against a criterion pattern that may contain `*` / `?` wildcards. */
export function wildcardEquals(text: string, pattern: string): boolean {
  if (!/[*?~]/.test(pattern)) {
    return text.toLowerCase() === pattern.toLowerCase();
  }
  let regex = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '~' && i + 1 < pattern.length) {
      regex += pattern[i + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i++;
    } else if (ch === '*') {
      regex += '.*';
    } else if (ch === '?') {
      regex += '.';
    } else {
      regex += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${regex}$`, 'i').test(text);
}

/**
 * Test a value against a SUMIF/COUNTIF-style criterion: a bare value, or a
 * string carrying a comparison operator (`">5"`, `"<>x"`, `">=2"`).
 */
export function matchesCriterion(value: unknown, criterion: unknown): boolean {
  let op = '=';
  let operand: unknown = criterion;

  if (typeof criterion === 'string') {
    const m = criterion.match(/^(<=|>=|<>|=|<|>)([\s\S]*)$/);
    if (m) {
      op = m[1];
      operand = m[2];
    }
  }

  const valNum =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))
        ? Number(value)
        : null;
  const opNum =
    typeof operand === 'number'
      ? operand
      : typeof operand === 'string' && operand.trim() !== '' && !isNaN(Number(operand))
        ? Number(operand)
        : null;

  if (valNum !== null && opNum !== null) {
    switch (op) {
      case '=':
        return valNum === opNum;
      case '<>':
        return valNum !== opNum;
      case '>':
        return valNum > opNum;
      case '<':
        return valNum < opNum;
      case '>=':
        return valNum >= opNum;
      case '<=':
        return valNum <= opNum;
    }
  }

  const valStr = value == null ? '' : String(value);
  const opStr = operand == null ? '' : String(operand);
  switch (op) {
    case '=':
      return wildcardEquals(valStr, opStr);
    case '<>':
      return !wildcardEquals(valStr, opStr);
    case '>':
      return valStr.toLowerCase() > opStr.toLowerCase();
    case '<':
      return valStr.toLowerCase() < opStr.toLowerCase();
    case '>=':
      return valStr.toLowerCase() >= opStr.toLowerCase();
    case '<=':
      return valStr.toLowerCase() <= opStr.toLowerCase();
    default:
      return false;
  }
}
