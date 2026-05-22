import type { EvaluationContext } from '../types';
import { arrayFunctions } from './array';

const ctx: EvaluationContext = {
  getCellValue: () => null,
  getRangeValues: () => [],
};

function call(name: string, args: unknown[]): unknown {
  return arrayFunctions[name](args, ctx);
}

describe('SEQUENCE', () => {
  it('builds a row-major grid', () => {
    expect(call('SEQUENCE', [3])).toEqual([[1], [2], [3]]);
    expect(call('SEQUENCE', [2, 3])).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(call('SEQUENCE', [2, 2, 10, 5])).toEqual([
      [10, 15],
      [20, 25],
    ]);
  });

  it('rejects a non-positive size', () => {
    expect(() => call('SEQUENCE', [0])).toThrow('#VALUE!');
  });
});

describe('UNIQUE', () => {
  it('removes duplicate rows', () => {
    expect(call('UNIQUE', [[[1], [2], [2], [3]]])).toEqual([[1], [2], [3]]);
  });

  it('exactly-once keeps only rows that appear a single time', () => {
    expect(call('UNIQUE', [[[1], [1], [2]], false, true])).toEqual([[2]]);
  });

  it('errors when nothing remains', () => {
    expect(() => call('UNIQUE', [[[1], [1]], false, true])).toThrow('#CALC!');
  });
});

describe('SORT / SORTBY', () => {
  it('SORT orders ascending by default and descending on request', () => {
    expect(call('SORT', [[[3], [1], [2]]])).toEqual([[1], [2], [3]]);
    expect(call('SORT', [[[3], [1], [2]], 1, -1])).toEqual([[3], [2], [1]]);
  });

  it('SORT can key on a later column', () => {
    expect(
      call('SORT', [
        [
          [1, 'b'],
          [2, 'a'],
        ],
        2,
      ])
    ).toEqual([
      [2, 'a'],
      [1, 'b'],
    ]);
  });

  it('SORTBY orders one array by another', () => {
    expect(call('SORTBY', [[['a'], ['b'], ['c']], [[3], [1], [2]]])).toEqual([
      ['b'],
      ['c'],
      ['a'],
    ]);
  });
});

describe('FILTER', () => {
  it('keeps rows whose include value is truthy', () => {
    expect(
      call('FILTER', [
        [[1], [2], [3], [4]],
        [[true], [false], [true], [false]],
      ])
    ).toEqual([[1], [3]]);
  });

  it('returns the fallback, or #CALC!, when nothing matches', () => {
    expect(call('FILTER', [[[1], [2]], [[false], [false]], 'none'])).toEqual([['none']]);
    expect(() => call('FILTER', [[[1], [2]], [[false], [false]]])).toThrow('#CALC!');
  });
});

describe('SPLIT', () => {
  it('splits text into a row of values', () => {
    expect(call('SPLIT', ['a,b,c', ','])).toEqual([['a', 'b', 'c']]);
  });

  it('treats each delimiter character as a separator by default', () => {
    expect(call('SPLIT', ['a-b_c', '-_'])).toEqual([['a', 'b', 'c']]);
  });

  it('removes empty segments unless told not to', () => {
    expect(call('SPLIT', ['a,,b', ','])).toEqual([['a', 'b']]);
    expect(call('SPLIT', ['a,,b', ',', true, false])).toEqual([['a', '', 'b']]);
  });
});
