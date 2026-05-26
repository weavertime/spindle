import { SheetImpl } from '../sheet';
import { cellSearchText, findMatches, computeReplacement } from './find-replace';
import type { Cell } from '../types';

function makeSheet(): SheetImpl {
  const sheet = new SheetImpl('s1', 'Sheet1');
  sheet.setCellValue(0, 0, 'apple');
  sheet.setCellValue(0, 1, 'Apple pie');
  sheet.setCellValue(1, 0, 'banana');
  sheet.setCellValue(1, 1, 100);
  sheet.setCell(2, 0, { value: 7, formula: '=3+4' });
  return sheet;
}

describe('findMatches', () => {
  it('finds case-insensitive substring matches by default', () => {
    const m = findMatches(makeSheet(), 'apple');
    expect(m).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
  });

  it('respects matchCase', () => {
    const m = findMatches(makeSheet(), 'Apple', { matchCase: true });
    expect(m).toEqual([{ row: 0, col: 1 }]);
  });

  it('respects wholeCell', () => {
    const m = findMatches(makeSheet(), 'apple', { wholeCell: true });
    expect(m).toEqual([{ row: 0, col: 0 }]);
  });

  it('matches numeric values stringified', () => {
    expect(findMatches(makeSheet(), '100')).toEqual([{ row: 1, col: 1 }]);
  });

  it('returns no matches for an empty query', () => {
    expect(findMatches(makeSheet(), '')).toEqual([]);
  });

  it('ignores formula text unless searchFormulas is set', () => {
    expect(findMatches(makeSheet(), '3+4')).toEqual([]);
    expect(findMatches(makeSheet(), '3+4', { searchFormulas: true })).toEqual([
      { row: 2, col: 0 },
    ]);
  });

  it('returns matches in row-major order', () => {
    const sheet = new SheetImpl('s', 'S');
    sheet.setCellValue(5, 2, 'x');
    sheet.setCellValue(1, 9, 'x');
    sheet.setCellValue(1, 0, 'x');
    expect(findMatches(sheet, 'x')).toEqual([
      { row: 1, col: 0 },
      { row: 1, col: 9 },
      { row: 5, col: 2 },
    ]);
  });
});

describe('cellSearchText', () => {
  it('stringifies booleans', () => {
    expect(cellSearchText({ value: true }, {})).toBe('TRUE');
    expect(cellSearchText({ value: false }, {})).toBe('FALSE');
  });

  it('returns an empty string for a null value', () => {
    expect(cellSearchText({ value: null }, {})).toBe('');
  });
});

describe('computeReplacement', () => {
  const cell = (over: Partial<Cell>): Cell => ({ value: null, ...over });

  it('replaces a substring within a string value', () => {
    expect(computeReplacement(cell({ value: 'apple pie' }), 'apple', 'cherry')).toEqual({
      kind: 'value',
      value: 'cherry pie',
    });
  });

  it('coerces a numeric result to a number', () => {
    expect(computeReplacement(cell({ value: '1apple0' }), 'apple', '')).toEqual({
      kind: 'value',
      value: 10,
    });
  });

  it('keeps a non-numeric result as a string', () => {
    expect(computeReplacement(cell({ value: 'cat' }), 'cat', 'dog')).toEqual({
      kind: 'value',
      value: 'dog',
    });
  });

  it('does not touch a formula cell without searchFormulas', () => {
    expect(
      computeReplacement(cell({ value: 7, formula: '=3+4' }), '3', '5')
    ).toEqual({ kind: 'none' });
  });

  it('rewrites a formula when searchFormulas is set', () => {
    expect(
      computeReplacement(cell({ value: 7, formula: '=3+4' }), '3', '5', {
        searchFormulas: true,
      })
    ).toEqual({ kind: 'formula', formula: '=5+4' });
  });

  it('returns none when the query is absent', () => {
    expect(computeReplacement(cell({ value: 'apple' }), 'xyz', 'q')).toEqual({
      kind: 'none',
    });
  });

  it('replaces case-insensitively while preserving surrounding text', () => {
    expect(computeReplacement(cell({ value: 'Apple APPLE' }), 'apple', 'x')).toEqual({
      kind: 'value',
      value: 'x x',
    });
  });
});
