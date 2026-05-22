import { analyzeFormula } from './formula-context';
import type { FormulaContext } from './formula-context';

/** Analyze a formula whose caret position is marked with `|`. */
function at(withCaret: string): FormulaContext {
  const caret = withCaret.indexOf('|');
  return analyzeFormula(withCaret.replace('|', ''), caret);
}

describe('analyzeFormula — function-name token', () => {
  it('detects a partial name being typed', () => {
    expect(at('=SU|').token?.text).toBe('SU');
    expect(at('=SU|').call).toBeUndefined();
  });

  it('detects a name after an operator', () => {
    expect(at('=A1+SU|').token?.text).toBe('SU');
  });

  it('returns the whole identifier when the caret is mid-token', () => {
    const token = at('=SU|M').token;
    expect(token?.text).toBe('SUM');
    expect(token?.start).toBe(1);
    expect(token?.end).toBe(4);
  });

  it('does not treat a completed call as a name token', () => {
    expect(at('=SUM|(').token).toBeUndefined();
  });
});

describe('analyzeFormula — argument context', () => {
  it('detects the enclosing function and argument index', () => {
    expect(at('=SUM(|').call).toEqual({ name: 'SUM', argIndex: 0, openParen: 4 });
    expect(at('=SUM(1,2,|').call?.argIndex).toBe(2);
  });

  it('reports the innermost call for nested functions', () => {
    expect(at('=SUM(1,AVERAGE(A1,|))').call).toMatchObject({ name: 'AVERAGE', argIndex: 1 });
    expect(at('=SUM(1,AVERAGE(A1,B1),|)').call).toMatchObject({ name: 'SUM', argIndex: 2 });
  });

  it('ignores commas and parens inside string literals', () => {
    expect(at('=SUM("a,b",|').call).toMatchObject({ name: 'SUM', argIndex: 1 });
    expect(at('=CONCAT("x)y",|').call).toMatchObject({ name: 'CONCAT', argIndex: 1 });
  });

  it('exposes both the token and the call when typing an argument', () => {
    const result = at('=SUM(AV|');
    expect(result.token?.text).toBe('AV');
    expect(result.call).toMatchObject({ name: 'SUM', argIndex: 0 });
  });
});

describe('analyzeFormula — no context', () => {
  it('returns nothing after a closed call', () => {
    expect(at('=SUM(1,2)|')).toEqual({});
  });

  it('returns nothing for a bare grouping parenthesis', () => {
    expect(at('=(A1+|').call).toBeUndefined();
  });

  it('returns nothing for an empty or bare formula', () => {
    expect(at('=|')).toEqual({});
    expect(analyzeFormula('', 0)).toEqual({});
  });
});
