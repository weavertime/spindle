import { detectSeries, extrapolate } from './autofill';
import { jsToExcelDate, excelDateToJS } from '../utils/format-utils';

const serial = (y: number, m: number, d: number) =>
  jsToExcelDate(new Date(Date.UTC(y, m, d)));
const ymd = (s: number) => {
  const dt = excelDateToJS(s);
  return [dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()];
};

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

describe('date series', () => {
  it('extends a single date day-by-day', () => {
    const jan15 = serial(2023, 0, 15);
    const s = detectSeries([jan15], { isDate: true });
    expect(s).toEqual({ kind: 'arithmetic', start: jan15, step: 1 });
    expect(extrapolate(s, [jan15], 1)).toBe(serial(2023, 0, 16));
  });

  it('extends a day-spaced run day-by-day', () => {
    const vals = [serial(2023, 0, 1), serial(2023, 0, 2)];
    const s = detectSeries(vals, { isDate: true });
    expect(s.kind).toBe('arithmetic');
    expect(extrapolate(s, vals, 4)).toBe(serial(2023, 0, 5));
  });

  it('detects a month series from two month-spaced dates', () => {
    const vals = [serial(2023, 0, 15), serial(2023, 1, 15)];
    const s = detectSeries(vals, { isDate: true });
    expect(s).toEqual({ kind: 'dateMonth', startSerial: vals[0], monthStep: 1 });
    expect(ymd(extrapolate(s, vals, 2) as number)).toEqual([2023, 2, 15]);
    expect(ymd(extrapolate(s, vals, 12) as number)).toEqual([2024, 0, 15]);
  });

  it('detects a year series (12-month step)', () => {
    const vals = [serial(2020, 5, 1), serial(2021, 5, 1)];
    const s = detectSeries(vals, { isDate: true });
    expect(s).toMatchObject({ kind: 'dateMonth', monthStep: 12 });
    expect(ymd(extrapolate(s, vals, 3) as number)).toEqual([2023, 5, 1]);
  });

  it('clamps the day when the target month is shorter', () => {
    // Jul 31 / Aug 31, stepping one month: index 2 lands on September,
    // whose 31st does not exist — clamp to Sep 30.
    const vals = [serial(2023, 6, 31), serial(2023, 7, 31)];
    const s = detectSeries(vals, { isDate: true });
    expect(s).toMatchObject({ kind: 'dateMonth', monthStep: 1 });
    expect(ymd(extrapolate(s, vals, 2) as number)).toEqual([2023, 8, 30]);
  });

  it('does not month-detect when the day-of-month differs', () => {
    const vals = [serial(2023, 0, 10), serial(2023, 1, 20)];
    const s = detectSeries(vals, { isDate: true });
    // Falls back to a day-step arithmetic series.
    expect(s.kind).toBe('arithmetic');
  });

  it('ignores dates without the isDate flag', () => {
    const vals = [serial(2023, 0, 15), serial(2023, 1, 15)];
    expect(detectSeries(vals).kind).toBe('arithmetic'); // plain numbers
  });
});

describe('list series (month / weekday names)', () => {
  it('continues full month names', () => {
    const s = detectSeries(['January', 'February']);
    expect(s.kind).toBe('list');
    expect(extrapolate(s, [], 2)).toBe('March');
  });

  it('continues abbreviated month names', () => {
    const s = detectSeries(['Jan', 'Feb', 'Mar']);
    expect(extrapolate(s, [], 3)).toBe('Apr');
  });

  it('extends a single month name', () => {
    const s = detectSeries(['Oct']);
    expect(extrapolate(s, [], 1)).toBe('Nov');
  });

  it('wraps around the list', () => {
    const s = detectSeries(['Nov', 'Dec']);
    expect(extrapolate(s, [], 2)).toBe('Jan');
  });

  it('continues weekday names', () => {
    const s = detectSeries(['Monday', 'Tuesday']);
    expect(extrapolate(s, [], 2)).toBe('Wednesday');
  });

  it('preserves uppercase casing', () => {
    const s = detectSeries(['JAN', 'FEB']);
    expect(extrapolate(s, [], 2)).toBe('MAR');
  });

  it('preserves lowercase casing', () => {
    const s = detectSeries(['mon', 'tue']);
    expect(extrapolate(s, [], 2)).toBe('wed');
  });

  it('treats a repeated name as a copy, not a series', () => {
    expect(detectSeries(['Jan', 'Jan']).kind).toBe('copy');
  });
});

describe('text + number series', () => {
  it('continues a Q1/Q2 pattern', () => {
    const s = detectSeries(['Q1', 'Q2']);
    expect(s).toMatchObject({ kind: 'textNumber', prefix: 'Q', step: 1 });
    expect(extrapolate(s, [], 2)).toBe('Q3');
  });

  it('extends a single text+number cell', () => {
    const s = detectSeries(['Item 5']);
    expect(extrapolate(s, [], 1)).toBe('Item 6');
  });

  it('detects a non-unit step', () => {
    const s = detectSeries(['Week 2', 'Week 4']);
    expect(extrapolate(s, [], 2)).toBe('Week 6');
  });

  it('preserves zero-padding', () => {
    const s = detectSeries(['Row01', 'Row02']);
    expect(extrapolate(s, [], 9)).toBe('Row10');
  });

  it('requires a shared prefix', () => {
    expect(detectSeries(['A1', 'B2']).kind).toBe('copy');
  });

  it('leaves plain text as a copy', () => {
    expect(detectSeries(['hello', 'world']).kind).toBe('copy');
  });
});
