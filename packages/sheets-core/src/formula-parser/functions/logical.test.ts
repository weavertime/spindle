import type { EvaluationContext } from '../types';
import { logicalEagerFunctions, logicalLazyFunctions } from './logical';

const ctx: EvaluationContext = {
  getCellValue: () => null,
  getRangeValues: () => [],
};

function callEager(name: string, args: unknown[]): unknown {
  return logicalEagerFunctions[name](args, ctx);
}

function callLazy(name: string, thunks: Array<() => unknown>): unknown {
  return logicalLazyFunctions[name](thunks, ctx);
}

describe('eager logical functions', () => {
  it('AND / OR / XOR over boolean and numeric values', () => {
    expect(callEager('AND', [[[true, true, true]]])).toBe(true);
    expect(callEager('AND', [[[true, false]]])).toBe(false);
    expect(callEager('AND', [true, 1])).toBe(true);
    expect(callEager('OR', [[[false, false]]])).toBe(false);
    expect(callEager('OR', [[[false, true]]])).toBe(true);
    expect(callEager('XOR', [[[true, true, true]]])).toBe(true);
    expect(callEager('XOR', [[[true, true]]])).toBe(false);
  });

  it('AND ignores text/blank and errors when nothing is logical', () => {
    expect(callEager('AND', [[['text', null, true]]])).toBe(true);
    expect(() => callEager('AND', [[['text', null]]])).toThrow('#VALUE!');
  });

  it('NOT / TRUE / FALSE', () => {
    expect(callEager('NOT', [true])).toBe(false);
    expect(callEager('NOT', [0])).toBe(true);
    expect(callEager('TRUE', [])).toBe(true);
    expect(callEager('FALSE', [])).toBe(false);
  });
});

describe('lazy logical functions', () => {
  it('IF only evaluates the chosen branch', () => {
    const boom = () => {
      throw new Error('#DIV/0!');
    };
    expect(callLazy('IF', [() => true, () => 'yes', boom])).toBe('yes');
    expect(callLazy('IF', [() => false, boom, () => 'no'])).toBe('no');
    expect(callLazy('IF', [() => false, () => 'yes'])).toBe(false);
  });

  it('IFERROR catches thrown errors and error values', () => {
    const boom = () => {
      throw new Error('#DIV/0!');
    };
    expect(callLazy('IFERROR', [boom, () => 'safe'])).toBe('safe');
    expect(callLazy('IFERROR', [() => '#REF!', () => 'safe'])).toBe('safe');
    expect(callLazy('IFERROR', [() => 42, () => 'safe'])).toBe(42);
  });

  it('IFNA only intercepts #N/A', () => {
    const na = () => {
      throw new Error('#N/A');
    };
    const div = () => {
      throw new Error('#DIV/0!');
    };
    expect(callLazy('IFNA', [na, () => 'fallback'])).toBe('fallback');
    expect(callLazy('IFNA', [() => '#N/A', () => 'fallback'])).toBe('fallback');
    expect(() => callLazy('IFNA', [div, () => 'fallback'])).toThrow('#DIV/0!');
  });

  it('IFS returns the first matching branch, #N/A when none match', () => {
    expect(callLazy('IFS', [() => false, () => 'a', () => true, () => 'b'])).toBe('b');
    expect(() => callLazy('IFS', [() => false, () => 'a'])).toThrow('#N/A');
  });

  it('SWITCH matches a case or falls back to the default', () => {
    expect(
      callLazy('SWITCH', [() => 2, () => 1, () => 'one', () => 2, () => 'two'])
    ).toBe('two');
    expect(
      callLazy('SWITCH', [() => 9, () => 1, () => 'one', () => 'default'])
    ).toBe('default');
    expect(() => callLazy('SWITCH', [() => 9, () => 1, () => 'one'])).toThrow('#N/A');
  });
});
