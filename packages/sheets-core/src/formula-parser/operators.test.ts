import { FormulaParser } from './parser';
import type { EvaluationContext } from './types';

const parser = new FormulaParser();

// A1 -> 10, B2 -> 4, everything else null
const ctx: EvaluationContext = {
  getCellValue: (row, col) => {
    if (row === 0 && col === 0) return 10; // A1
    if (row === 1 && col === 1) return 4; // B2
    return null;
  },
  getRangeValues: () => [],
};

function evaluate(formula: string): unknown {
  const { ast, error } = parser.parse(formula);
  if (error) throw new Error(error);
  return parser.evaluate(ast, ctx);
}

describe('comparison operators', () => {
  it('two-char comparisons evaluate correctly', () => {
    expect(evaluate('=5<=10')).toBe(true);
    expect(evaluate('=10<=5')).toBe(false);
    expect(evaluate('=5<=5')).toBe(true);
    expect(evaluate('=5>=3')).toBe(true);
    expect(evaluate('=3>=5')).toBe(false);
    expect(evaluate('=5>=5')).toBe(true);
    expect(evaluate('=3<>4')).toBe(true);
    expect(evaluate('=4<>4')).toBe(false);
  });

  it('single-char comparisons still work', () => {
    expect(evaluate('=5<10')).toBe(true);
    expect(evaluate('=5>10')).toBe(false);
    expect(evaluate('=5=5')).toBe(true);
    expect(evaluate('=5=6')).toBe(false);
  });

  it('comparisons against cell references', () => {
    expect(evaluate('=A1>=10')).toBe(true); // 10 >= 10
    expect(evaluate('=A1<=B2')).toBe(false); // 10 <= 4
    expect(evaluate('=B2<>A1')).toBe(true); // 4 <> 10
  });
});

describe('unary sign after an operator', () => {
  it('multiplication/division with a negative literal', () => {
    expect(evaluate('=2*-3')).toBe(-6);
    expect(evaluate('=6/-3')).toBe(-2);
    expect(evaluate('=2*+3')).toBe(6);
  });

  it('addition/subtraction with a signed literal', () => {
    expect(evaluate('=10+-4')).toBe(6);
    expect(evaluate('=2--3')).toBe(5);
    expect(evaluate('=2-+3')).toBe(-1);
  });

  it('spaces around the operator are handled', () => {
    expect(evaluate('=2 * -3')).toBe(-6);
    expect(evaluate('=10 + -4')).toBe(6);
  });

  it('unary sign in front of a cell reference', () => {
    expect(evaluate('=2*-A1')).toBe(-20); // 2 * -10
    expect(evaluate('=A1--A1')).toBe(20); // 10 - (-10)
  });
});

describe('behaviors that must not regress', () => {
  it('leading unary minus', () => {
    expect(evaluate('=-5')).toBe(-5);
    expect(evaluate('=-A1')).toBe(-10);
  });

  it('scientific notation', () => {
    expect(evaluate('=1e-5')).toBe(0.00001);
    expect(evaluate('=2E+3')).toBe(2000);
  });

  it('plain arithmetic and left-associativity', () => {
    expect(evaluate('=2+3*4')).toBe(14);
    expect(evaluate('=10-3-2')).toBe(5);
    expect(evaluate('=20/2/5')).toBe(2);
  });
});
