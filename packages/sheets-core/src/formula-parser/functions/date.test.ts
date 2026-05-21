import type { EvaluationContext } from '../types';
import { dateFunctions } from './date';

const ctx: EvaluationContext = {
  getCellValue: () => null,
  getRangeValues: () => [],
};

function call(name: string, args: unknown[]): unknown {
  return dateFunctions[name](args, ctx);
}

/** DATE serial helper for building test inputs. */
function D(y: number, m: number, d: number): number {
  return call('DATE', [y, m, d]) as number;
}

describe('constructors and components', () => {
  it('DATE round-trips through YEAR / MONTH / DAY', () => {
    const serial = D(2026, 5, 21);
    expect(call('YEAR', [serial])).toBe(2026);
    expect(call('MONTH', [serial])).toBe(5);
    expect(call('DAY', [serial])).toBe(21);
  });

  it('DATE rolls month overflow into the next year', () => {
    const serial = D(2024, 13, 1);
    expect(call('YEAR', [serial])).toBe(2025);
    expect(call('MONTH', [serial])).toBe(1);
  });

  it('TIME builds a day fraction; HOUR / MINUTE / SECOND read it back', () => {
    expect(call('TIME', [12, 0, 0])).toBe(0.5);
    const t = call('TIME', [13, 45, 30]) as number;
    expect(call('HOUR', [t])).toBe(13);
    expect(call('MINUTE', [t])).toBe(45);
    expect(call('SECOND', [t])).toBe(30);
  });

  it('TODAY is an integer and NOW falls within today', () => {
    const today = call('TODAY', []) as number;
    const now = call('NOW', []) as number;
    expect(Number.isInteger(today)).toBe(true);
    expect(today).toBeGreaterThan(40000);
    expect(now).toBeGreaterThanOrEqual(today);
    expect(now).toBeLessThan(today + 1);
  });
});

describe('weekday and week number', () => {
  // 2024-01-01 is a Monday.
  const monday = D(2024, 1, 1);

  it('WEEKDAY honours the return-type argument', () => {
    expect(call('WEEKDAY', [monday])).toBe(2); // Sun=1..Sat=7
    expect(call('WEEKDAY', [monday, 2])).toBe(1); // Mon=1..Sun=7
    expect(call('WEEKDAY', [monday, 3])).toBe(0); // Mon=0..Sun=6
  });

  it('WEEKNUM counts from the first week of the year', () => {
    expect(call('WEEKNUM', [monday])).toBe(1);
    expect(call('WEEKNUM', [D(2024, 1, 7)])).toBe(2);
  });
});

describe('month arithmetic', () => {
  it('EDATE keeps the day, clamping to the month end', () => {
    const result = call('EDATE', [D(2026, 1, 31), 1]) as number;
    expect(call('MONTH', [result])).toBe(2);
    expect(call('DAY', [result])).toBe(28);
  });

  it('EOMONTH returns the last day of the target month', () => {
    expect(call('DAY', [call('EOMONTH', [D(2024, 2, 10), 0])])).toBe(29);
    expect(call('DAY', [call('EOMONTH', [D(2026, 2, 10), 0])])).toBe(28);
  });

  it('DATEDIF measures spans by unit', () => {
    expect(call('DATEDIF', [D(2020, 1, 1), D(2026, 5, 21), 'Y'])).toBe(6);
    expect(call('DATEDIF', [D(2020, 1, 1), D(2026, 5, 21), 'M'])).toBe(76);
    expect(call('DATEDIF', [D(2026, 5, 1), D(2026, 5, 21), 'D'])).toBe(20);
    expect(call('DATEDIF', [D(2026, 1, 15), D(2026, 3, 10), 'MD'])).toBe(23);
    expect(call('DATEDIF', [D(2020, 1, 1), D(2026, 5, 21), 'YM'])).toBe(4);
  });
});

describe('working days', () => {
  it('NETWORKDAYS counts weekdays inclusively and skips holidays', () => {
    expect(call('NETWORKDAYS', [D(2024, 1, 1), D(2024, 1, 7)])).toBe(5);
    expect(call('NETWORKDAYS', [D(2024, 1, 1), D(2024, 1, 7), [[D(2024, 1, 3)]]])).toBe(4);
  });

  it('WORKDAY steps forward and backward over weekdays', () => {
    expect(call('WORKDAY', [D(2024, 1, 1), 5])).toBe(D(2024, 1, 8));
    expect(call('WORKDAY', [D(2024, 1, 8), -5])).toBe(D(2024, 1, 1));
  });
});

describe('parsing', () => {
  it('DATEVALUE parses ISO and US date strings', () => {
    expect(call('DATEVALUE', ['2026-05-21'])).toBe(D(2026, 5, 21));
    expect(call('DATEVALUE', ['5/21/2026'])).toBe(D(2026, 5, 21));
    expect(() => call('DATEVALUE', ['not a date'])).toThrow('#VALUE!');
  });

  it('TIMEVALUE parses 24-hour and AM/PM times', () => {
    expect(call('TIMEVALUE', ['12:00:00'])).toBe(0.5);
    expect(call('TIMEVALUE', ['6:00 PM'])).toBe(0.75);
    expect(call('TIMEVALUE', ['12:00 AM'])).toBe(0);
  });

  it('date functions accept a date string directly', () => {
    expect(call('YEAR', ['2026-05-21'])).toBe(2026);
  });
});
