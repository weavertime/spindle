import { FormulaParser } from './parser';
import type { EvaluationContext } from './types';
import { formatNumber } from '../utils/format-utils';

const parser = new FormulaParser();
const ctx: EvaluationContext = {
  getCellValue: (row, col) => (row === 0 && col === 0 ? null : null), // A1 empty
  getRangeValues: () => [],
};
const ev = (f: string): unknown => {
  const { ast, error } = parser.parse(f);
  if (error) throw new Error(error);
  return parser.evaluate(ast, ctx);
};

describe('concatenation and power operators', () => {
  it('& concatenates, coercing each operand to text', () => {
    expect(ev('="a"&"b"')).toBe('ab');
    expect(ev('="x"&5')).toBe('x5');
    expect(ev('=1&2')).toBe('12');
    expect(ev('="v"&TRUE')).toBe('vTRUE');
  });

  it('^ raises to a power with correct precedence and unary exponent', () => {
    expect(ev('=2^3')).toBe(8);
    expect(ev('=2^3^2')).toBe(64); // left-assoc: (2^3)^2
    expect(ev('=2*3^2')).toBe(18); // ^ binds tighter than *
    expect(ev('=2^-2')).toBe(0.25); // unary minus in the exponent
    expect(ev('=1&2^3')).toBe('18'); // & is lowest: 1 & (2^3)
  });
});

describe('boolean literals', () => {
  it('TRUE / FALSE barewords are booleans', () => {
    expect(ev('=TRUE')).toBe(true);
    expect(ev('=FALSE')).toBe(false);
    expect(ev('=true')).toBe(true);
  });

  it('flow into logical functions and comparisons', () => {
    expect(ev('=AND(TRUE, TRUE)')).toBe(true);
    expect(ev('=OR(FALSE, FALSE)')).toBe(false);
    expect(ev('=IF(TRUE, 1, 2)')).toBe(1);
    expect(ev('=(1>0)=TRUE')).toBe(true);
  });

  it('coerce to 1/0 in arithmetic even though they end in E', () => {
    // Regression: the trailing E of TRUE/FALSE tripped the scientific-notation
    // guard, so =TRUE+1 parsed as one string token.
    expect(ev('=TRUE+1')).toBe(2);
    expect(ev('=TRUE-1')).toBe(0);
    expect(ev('=FALSE+1')).toBe(1);
    expect(ev('=TRUE+TRUE')).toBe(2);
    expect(ev('=1e-3+1')).toBe(1.001); // scientific notation still works
  });
});

describe('comparison semantics', () => {
  it('text inequalities compare lexically', () => {
    expect(ev('="b">"a"')).toBe(true);
    expect(ev('="apple"<"banana"')).toBe(true);
    expect(ev('="a">"b"')).toBe(false);
  });

  it('equality is type-aware (text never equals number)', () => {
    expect(ev('="1"=1')).toBe(false);
    expect(ev('=""=0')).toBe(false);
    expect(ev('=1=1')).toBe(true);
    expect(ev('="a"="A"')).toBe(true); // case-insensitive
    expect(ev('=5<>"5"')).toBe(true);
  });

  it('an empty cell equals 0 and ""', () => {
    expect(ev('=A1=0')).toBe(true); // A1 is empty -> blank = 0
    expect(ev('=A1=""')).toBe(true); // blank = ""
  });
});

describe('grouping parentheses', () => {
  it('unwraps and respects grouping', () => {
    expect(ev('=(1+2)')).toBe(3);
    expect(ev('=(1+2)*3')).toBe(9);
    expect(ev('=2*(3+4)')).toBe(14);
    expect(ev('=(1+2)*(3+4)')).toBe(21);
    expect(ev('=((1+2))')).toBe(3);
    expect(ev('=(2+3)>4')).toBe(true);
    expect(ev('=10/(2+3)')).toBe(2);
  });
});

describe('CHOOSE truncates a fractional index', () => {
  it('picks the truncated index', () => {
    expect(ev('=CHOOSE(2.9, "a", "b", "c")')).toBe('b');
    expect(ev('=CHOOSE(1, "a", "b")')).toBe('a');
  });
});

describe('formatNumber does not corrupt integers at 0 decimals', () => {
  const dp0 = { type: 'number' as const, decimalPlaces: 0 };
  it('keeps integer trailing zeros', () => {
    expect(formatNumber(100, dp0)).toBe('100');
    expect(formatNumber(250, dp0)).toBe('250');
    expect(formatNumber(1000, dp0)).toBe('1,000');
  });
  it('honors an explicit decimalPlaces as a FIXED count (Excel semantics)', () => {
    // "Number, 2 decimals" shows 1.50, not 1.5 — decimalPlaces is fixed, not a max.
    expect(formatNumber(1.5, { type: 'number', decimalPlaces: 2 })).toBe('1.50');
    expect(formatNumber(1.234, { type: 'number', decimalPlaces: 2 })).toBe('1.23');
  });
});
