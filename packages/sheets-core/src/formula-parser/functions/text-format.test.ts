import { FormulaParser } from '../parser';
import type { EvaluationContext } from '../types';

const parser = new FormulaParser();
const ctx: EvaluationContext = { getCellValue: () => null, getRangeValues: () => [] };
const ev = (f: string): unknown => {
  const { ast, error } = parser.parse(f);
  if (error) throw new Error(error);
  return parser.evaluate(ast, ctx);
};

describe('TEXT respects positive;negative;zero format sections', () => {
  it('formats a negative value with the negative section (no auto-minus)', () => {
    expect(ev('=TEXT(-5,"0;0")')).toBe('5');
    expect(ev('=TEXT(-1234.5,"#,##0.00;#,##0.00")')).toBe('1,234.50');
  });

  it('formats a positive value with the first section', () => {
    expect(ev('=TEXT(5,"0;0")')).toBe('5');
    expect(ev('=TEXT(1234.5,"#,##0.00")')).toBe('1,234.50');
  });

  it('a single-section format keeps the sign', () => {
    expect(ev('=TEXT(-5,"0")')).toBe('-5');
    expect(ev('=TEXT(-5,"0.0")')).toBe('-5.0');
  });

  it('does not render a negative that rounds to zero as "-0"', () => {
    expect(ev('=TEXT(-0.4,"0")')).toBe('0');
    expect(ev('=TEXT(-0.004,"0.00")')).toBe('0.00');
    // A value that survives rounding still keeps its sign.
    expect(ev('=TEXT(-0.6,"0")')).toBe('-1');
  });
});
