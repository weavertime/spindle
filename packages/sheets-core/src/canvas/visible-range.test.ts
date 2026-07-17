import { computeVisibleRange } from './renderer';

// The cell-LOAD path (calculateVisibleRangeForDimensions) and the cell-RENDER
// path (calculateVisibleRange) both delegate to computeVisibleRange, so testing
// this pure helper directly proves the two windows can never diverge again.

const base = {
  scrollTop: 0,
  scrollLeft: 0,
  width: 500,
  height: 300,
  headerWidth: 50,
  headerHeight: 24,
  frozenWidth: 0,
  frozenHeight: 0,
  frozenRows: 0,
  frozenCols: 0,
  rowCount: 100,
  colCount: 100,
  rowHeights: new Map<number, number>(),
  colWidths: new Map<number, number>(),
  defaultRowHeight: 24,
  defaultColWidth: 100,
  hiddenRows: new Set<number>(),
  hiddenCols: new Set<number>(),
};

describe('computeVisibleRange (shared load/render window)', () => {
  it('skips hidden rows when advancing the scroll window', () => {
    // With no hidden rows, scrolling 240px (10 rows @24) lands the window ~row 10.
    const plain = computeVisibleRange({ ...base, scrollTop: 240 });
    // Hiding the first 10 rows means those 240px are collapsed, so the same
    // scrollTop must reach FURTHER down the sheet than the plain case.
    const hidden = computeVisibleRange({
      ...base,
      scrollTop: 240,
      hiddenRows: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
    });
    expect(hidden.startRow).toBeGreaterThan(plain.startRow);
  });

  it('starts the scroll region past the frozen rows', () => {
    const r = computeVisibleRange({ ...base, frozenRows: 3, frozenHeight: 72 });
    // startRow never dips below the frozen band.
    expect(r.startRow).toBeGreaterThanOrEqual(3);
  });

  it('honors frozenHeight when sizing the visible band', () => {
    const noFreeze = computeVisibleRange({ ...base });
    const withFreeze = computeVisibleRange({ ...base, frozenRows: 2, frozenHeight: 48 });
    // A frozen band eats vertical space, so fewer scrolling rows fit below it.
    const scrollingRows = (r: { startRow: number; endRow: number }) => r.endRow - r.startRow;
    expect(scrollingRows(withFreeze)).toBeLessThanOrEqual(scrollingRows(noFreeze));
  });

  it('skips hidden columns symmetrically', () => {
    const plain = computeVisibleRange({ ...base, scrollLeft: 500 });
    const hidden = computeVisibleRange({
      ...base,
      scrollLeft: 500,
      hiddenCols: new Set([0, 1, 2, 3, 4]),
    });
    expect(hidden.startCol).toBeGreaterThan(plain.startCol);
  });

  it('clamps the end to the sheet bounds', () => {
    const r = computeVisibleRange({ ...base, rowCount: 5, colCount: 5, height: 5000, width: 5000 });
    expect(r.endRow).toBe(5);
    expect(r.endCol).toBe(5);
  });
});
