import { normalizeGrid, parseTsv, clipboardToGrid, MAX_PASTE_ROWS, MAX_PASTE_COLS } from './table-paste';

describe('normalizeGrid', () => {
  it('pads ragged rows to a rectangle', () => {
    expect(normalizeGrid([['a', 'b'], ['c']])).toEqual([['a', 'b'], ['c', '']]);
  });
  it('rejects an empty grid or a single lone value', () => {
    expect(normalizeGrid([])).toBeNull();
    expect(normalizeGrid([['solo']])).toBeNull();
  });
  it('keeps a single row that has multiple cells', () => {
    expect(normalizeGrid([['a', 'b', 'c']])).toEqual([['a', 'b', 'c']]);
  });
  it('caps a pathologically large paste to bound allocation', () => {
    const huge = Array.from({ length: MAX_PASTE_ROWS + 500 }, () =>
      Array.from({ length: MAX_PASTE_COLS + 200 }, () => 'x')
    );
    const grid = normalizeGrid(huge)!;
    expect(grid.length).toBe(MAX_PASTE_ROWS);
    expect(grid[0].length).toBe(MAX_PASTE_COLS);
  });
});

describe('parseTsv', () => {
  it('parses a tab-separated grid', () => {
    expect(parseTsv('Name\tAge\nAda\t36\nAlan\t41')).toEqual([
      ['Name', 'Age'],
      ['Ada', '36'],
      ['Alan', '41'],
    ]);
  });
  it('handles trailing newline and \\r\\n line endings', () => {
    expect(parseTsv('a\tb\r\nc\td\r\n')).toEqual([['a', 'b'], ['c', 'd']]);
  });
  it('pads short rows', () => {
    expect(parseTsv('a\tb\tc\nd\te')).toEqual([['a', 'b', 'c'], ['d', 'e', '']]);
  });
  it('rejects plain prose (no tabs, single line)', () => {
    expect(parseTsv('just a sentence')).toBeNull();
    expect(parseTsv('')).toBeNull();
  });
  it('treats multiple plain lines as a single column', () => {
    expect(parseTsv('one\ntwo\nthree')).toEqual([['one'], ['two'], ['three']]);
  });
});

describe('clipboardToGrid', () => {
  it('falls back to TSV when there is no HTML (no DOM in this env)', () => {
    expect(clipboardToGrid({ html: '', text: 'a\tb\nc\td' })).toEqual([['a', 'b'], ['c', 'd']]);
  });
  it('returns null when neither flavour is tabular', () => {
    expect(clipboardToGrid({ html: '', text: 'hello' })).toBeNull();
  });
});
