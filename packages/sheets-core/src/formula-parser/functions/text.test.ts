import type { EvaluationContext } from '../types';
import { textFunctions } from './text';

const ctx: EvaluationContext = {
  getCellValue: () => null,
  getRangeValues: () => [],
};

function call(name: string, args: unknown[]): unknown {
  return textFunctions[name](args, ctx);
}

describe('joining and slicing', () => {
  it('CONCAT / CONCATENATE join all values as text', () => {
    expect(call('CONCAT', ['a', 'b', 1])).toBe('ab1');
    expect(call('CONCATENATE', [[['x', 'y']], 'z'])).toBe('xyz');
  });

  it('TEXTJOIN respects the ignore-empty flag', () => {
    expect(call('TEXTJOIN', ['-', true, [['a', '', 'b']]])).toBe('a-b');
    expect(call('TEXTJOIN', ['-', false, [['a', '', 'b']]])).toBe('a--b');
  });

  it('LEFT / RIGHT / MID', () => {
    expect(call('LEFT', ['hello', 3])).toBe('hel');
    expect(call('LEFT', ['hello'])).toBe('h');
    expect(call('RIGHT', ['hello', 2])).toBe('lo');
    expect(call('RIGHT', ['hello', 0])).toBe('');
    expect(call('MID', ['hello', 2, 3])).toBe('ell');
    expect(call('MID', ['hello', 10, 3])).toBe('');
  });

  it('LEN / REPT', () => {
    expect(call('LEN', ['hello'])).toBe(5);
    expect(call('REPT', ['ab', 3])).toBe('ababab');
  });
});

describe('searching and replacing', () => {
  it('FIND is case-sensitive; SEARCH is case-insensitive with wildcards', () => {
    expect(call('FIND', ['l', 'hello'])).toBe(3);
    expect(call('FIND', ['l', 'hello', 4])).toBe(4);
    expect(() => call('FIND', ['L', 'hello'])).toThrow('#VALUE!');
    expect(call('SEARCH', ['L', 'hello'])).toBe(3);
    expect(call('SEARCH', ['h*o', 'hello'])).toBe(1);
    expect(() => call('SEARCH', ['z', 'hello'])).toThrow('#VALUE!');
  });

  it('SUBSTITUTE replaces all occurrences or a single instance', () => {
    expect(call('SUBSTITUTE', ['a-b-c', '-', '+'])).toBe('a+b+c');
    expect(call('SUBSTITUTE', ['a-b-c', '-', '+', 2])).toBe('a-b+c');
  });

  it('REPLACE swaps text by position', () => {
    expect(call('REPLACE', ['abcdef', 2, 3, 'XYZ'])).toBe('aXYZef');
  });
});

describe('casing and trimming', () => {
  it('UPPER / LOWER / PROPER', () => {
    expect(call('UPPER', ['abc'])).toBe('ABC');
    expect(call('LOWER', ['ABC'])).toBe('abc');
    expect(call('PROPER', ['hello world'])).toBe('Hello World');
  });

  it('TRIM collapses internal runs and strips the ends', () => {
    expect(call('TRIM', ['  a   b  '])).toBe('a b');
  });

  it('EXACT compares case-sensitively', () => {
    expect(call('EXACT', ['abc', 'abc'])).toBe(true);
    expect(call('EXACT', ['abc', 'ABC'])).toBe(false);
  });
});

describe('conversion', () => {
  it('TEXT formats numbers', () => {
    expect(call('TEXT', [3.14159, '0.00'])).toBe('3.14');
    expect(call('TEXT', [1234567, '#,##0'])).toBe('1,234,567');
    expect(call('TEXT', [0.5, '0%'])).toBe('50%');
    expect(call('TEXT', [12345, '0.00E+00'])).toBe('1.23E+04');
  });

  it('VALUE parses numbers, currency and percentages', () => {
    expect(call('VALUE', ['1,234'])).toBe(1234);
    expect(call('VALUE', ['$10'])).toBe(10);
    expect(call('VALUE', ['50%'])).toBe(0.5);
    expect(() => call('VALUE', ['abc'])).toThrow('#VALUE!');
  });

  it('CHAR / CODE round-trip', () => {
    expect(call('CHAR', [65])).toBe('A');
    expect(call('CODE', ['A'])).toBe(65);
    expect(() => call('CHAR', [0])).toThrow('#VALUE!');
  });

  it('propagates an error value passed as text', () => {
    expect(() => call('CONCAT', ['#REF!'])).toThrow('#REF!');
  });
});
