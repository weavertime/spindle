import { parseDateString, excelDateToJS } from './format-utils';

function ymd(serial: number | null): [number, number, number] | null {
  if (serial === null) return null;
  const d = excelDateToJS(serial);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

describe('parseDateString', () => {
  it('parses a slash date as MM/DD/YYYY (US convention)', () => {
    // The 12th of January 2020, not the 1st of December.
    expect(ymd(parseDateString('1/12/2020'))).toEqual([2020, 1, 12]);
  });

  it('parses a dash date as DD-MM-YYYY (European convention)', () => {
    expect(ymd(parseDateString('1-12-2020'))).toEqual([2020, 12, 1]);
  });

  it('parses a dot date as DD.MM.YYYY (European convention)', () => {
    expect(ymd(parseDateString('1.12.2020'))).toEqual([2020, 12, 1]);
  });

  it('parses YYYY-MM-DD ISO form', () => {
    expect(ymd(parseDateString('2020-01-15'))).toEqual([2020, 1, 15]);
  });

  it('parses YYYY/MM/DD with slashes', () => {
    expect(ymd(parseDateString('2020/01/15'))).toEqual([2020, 1, 15]);
  });

  it('accepts single-digit month and day', () => {
    expect(ymd(parseDateString('3/4/2021'))).toEqual([2021, 3, 4]);
  });

  it('rejects an invalid month', () => {
    expect(parseDateString('13/15/2020')).toBeNull();
  });

  it('rejects an invalid day (Feb 30)', () => {
    expect(parseDateString('2-30-2021')).toBeNull();
  });

  it('rejects a year outside the supported range', () => {
    expect(parseDateString('1/1/1800')).toBeNull();
  });

  it('rejects a non-date string', () => {
    expect(parseDateString('hello')).toBeNull();
  });

  it('rejects an incomplete date', () => {
    expect(parseDateString('1/15')).toBeNull();
  });
});
