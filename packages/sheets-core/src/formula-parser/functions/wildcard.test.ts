import { wildcardEquals, wildcardSearch } from './helpers';
import { FormulaParser } from '../parser';
import type { EvaluationContext } from '../types';

const parser = new FormulaParser();
const ctx: EvaluationContext = { getCellValue: () => null, getRangeValues: () => [] };
const ev = (f: string): unknown => {
  const { ast, error } = parser.parse(f);
  if (error) throw new Error(error);
  return parser.evaluate(ast, ctx);
};

describe('wildcardEquals — glob semantics', () => {
  it('matches * / ? and is case-insensitive', () => {
    expect(wildcardEquals('apple', 'ap*')).toBe(true);
    expect(wildcardEquals('apricot', 'ap*')).toBe(true);
    expect(wildcardEquals('berry', 'ap*')).toBe(false);
    expect(wildcardEquals('cat', 'c?t')).toBe(true);
    expect(wildcardEquals('coat', 'c?t')).toBe(false);
    expect(wildcardEquals('HELLO', 'hello')).toBe(true);
    expect(wildcardEquals('a', '*')).toBe(true);
    expect(wildcardEquals('', '*')).toBe(true);
    expect(wildcardEquals('abc', 'a*c')).toBe(true);
    expect(wildcardEquals('ac', 'a*c')).toBe(true);
  });

  it('honors ~ escapes for literal * / ?', () => {
    expect(wildcardEquals('a*b', 'a~*b')).toBe(true);
    expect(wildcardEquals('axb', 'a~*b')).toBe(false);
    expect(wildcardEquals('a?b', 'a~?b')).toBe(true);
  });
});

describe('wildcardSearch — substring semantics', () => {
  it('finds the earliest match index (0-based) or -1', () => {
    expect(wildcardSearch('hello', 'l')).toBe(2);
    expect(wildcardSearch('hello', 'h*o')).toBe(0);
    expect(wildcardSearch('hello', 'z')).toBe(-1);
    expect(wildcardSearch('hello', '*o')).toBe(0);
    expect(wildcardSearch('hello', '')).toBe(0);
  });
});

describe('ReDoS: wildcard matching stays linear on adversarial input', () => {
  it('COUNTIF wildcard does not hang on a *-heavy non-match', () => {
    const start = Date.now();
    // 35 stars against a 60-char non-matching value froze for ~minutes as a regex.
    expect(wildcardEquals('a'.repeat(60), '*'.repeat(35) + 'x')).toBe(false);
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('SEARCH wildcard does not hang on the *a*a* alternating form', () => {
    const start = Date.now();
    expect(() => ev('=SEARCH("' + '*a'.repeat(18) + 'b","' + 'a'.repeat(40) + '")')).toThrow('#VALUE!');
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('SEARCH still works with a normal wildcard', () => {
    expect(ev('=SEARCH("h*o","hello")')).toBe(1);
    expect(ev('=SEARCH("L","hello")')).toBe(3);
  });
});
