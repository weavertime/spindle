import { detectSeries, extrapolate } from './autofill';

describe('detectSeries', () => {
  it('treats a single value as a copy', () => {
    expect(detectSeries([5])).toEqual({ kind: 'copy' });
  });

  it('treats an empty input as a copy', () => {
    expect(detectSeries([])).toEqual({ kind: 'copy' });
  });

  it('detects a 1,2,3 arithmetic series', () => {
    expect(detectSeries([1, 2, 3])).toEqual({ kind: 'arithmetic', start: 1, step: 1 });
  });

  it('detects a non-unit step', () => {
    expect(detectSeries([10, 20, 30])).toEqual({ kind: 'arithmetic', start: 10, step: 10 });
  });

  it('detects a descending series', () => {
    expect(detectSeries([9, 6, 3])).toEqual({ kind: 'arithmetic', start: 9, step: -3 });
  });

  it('detects a two-value series', () => {
    expect(detectSeries([3, 7])).toEqual({ kind: 'arithmetic', start: 3, step: 4 });
  });

  it('tolerates floating-point drift', () => {
    expect(detectSeries([0.1, 0.2, 0.3])).toMatchObject({ kind: 'arithmetic', start: 0.1 });
  });

  it('treats unequal steps as a copy', () => {
    expect(detectSeries([1, 2, 4])).toEqual({ kind: 'copy' });
  });

  it('treats text values as a copy', () => {
    expect(detectSeries(['a', 'b', 'c'])).toEqual({ kind: 'copy' });
  });

  it('treats mixed types as a copy', () => {
    expect(detectSeries([1, 'b', 3])).toEqual({ kind: 'copy' });
  });

  it('treats booleans as a copy', () => {
    expect(detectSeries([true, false])).toEqual({ kind: 'copy' });
  });
});

describe('extrapolate', () => {
  it('extends an arithmetic series forward', () => {
    const series = detectSeries([1, 2, 3]);
    expect(extrapolate(series, [1, 2, 3], 3)).toBe(4);
    expect(extrapolate(series, [1, 2, 3], 5)).toBe(6);
  });

  it('reproduces the source within its own range', () => {
    const series = detectSeries([10, 20, 30]);
    expect(extrapolate(series, [10, 20, 30], 0)).toBe(10);
    expect(extrapolate(series, [10, 20, 30], 2)).toBe(30);
  });

  it('extends an arithmetic series backward', () => {
    const series = detectSeries([5, 10]);
    expect(extrapolate(series, [5, 10], -1)).toBe(0);
    expect(extrapolate(series, [5, 10], -2)).toBe(-5);
  });

  it('tiles a copy series forward', () => {
    const series = detectSeries(['x', 'y']);
    expect(extrapolate(series, ['x', 'y'], 2)).toBe('x');
    expect(extrapolate(series, ['x', 'y'], 3)).toBe('y');
  });

  it('tiles a copy series with a negative index', () => {
    const series = detectSeries(['x', 'y']);
    expect(extrapolate(series, ['x', 'y'], -1)).toBe('y');
  });

  it('returns null when copying from an empty source', () => {
    expect(extrapolate({ kind: 'copy' }, [], 3)).toBeNull();
  });
});
