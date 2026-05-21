import { FormulaParser } from './parser';
import type { EvaluationContext } from './types';

const parser = new FormulaParser();
const ctx: EvaluationContext = {
  getCellValue: () => null,
  getRangeValues: () => [],
};

/** Parse and evaluate a formula string end to end. */
function evaluate(formula: string): unknown {
  const { ast, error } = parser.parse(formula);
  if (error) throw new Error(error);
  return parser.evaluate(ast, ctx);
}

describe('parser integration', () => {
  it('evaluates math functions end to end', () => {
    expect(evaluate('=SUM(1, 2, 3)')).toBe(6);
    expect(evaluate('=ROUND(3.14159, 2)')).toBe(3.14);
    expect(evaluate('=POWER(2, 10)')).toBe(1024);
  });

  it('evaluates nested function calls', () => {
    expect(evaluate('=SUM(ROUND(1.4, 0), ROUND(2.6, 0))')).toBe(4);
  });

  it('IF short-circuits — the unused branch is never evaluated', () => {
    expect(evaluate('=IF(1>0, 10, 1/0)')).toBe(10);
  });

  it('IFERROR catches an error thrown while evaluating its first argument', () => {
    expect(evaluate('=IFERROR(1/0, "safe")')).toBe('safe');
  });

  it('reports an unknown function as #NAME?', () => {
    expect(() => evaluate('=NOTAFUNCTION(1)')).toThrow('#NAME?');
  });

  it('does not split arguments on a comma inside a string literal', () => {
    expect(evaluate('=TEXTJOIN(",", TRUE, "a", "b")')).toBe('a,b');
    expect(evaluate('=SUBSTITUTE("a,b,c", ",", ";")')).toBe('a;b;c');
  });
});
