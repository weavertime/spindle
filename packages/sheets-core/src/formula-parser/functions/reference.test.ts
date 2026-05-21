import { FormulaParser } from '../parser';
import type { EvaluationContext, RangeReference } from '../types';

// Mock sheet: cell (row, col) holds the number row*10 + col, except a blank
// cell and a text cell used to exercise CELL("type"). A1 is the only formula.
const ctx: EvaluationContext = {
  getCellValue: (row, col) => {
    if (row === 7) return '';
    if (row === 8) return 'label';
    return row * 10 + col;
  },
  getRangeValues: (range: RangeReference) => {
    const out: unknown[][] = [];
    for (let r = range.start.row; r <= range.end.row; r++) {
      const rowValues: unknown[] = [];
      for (let c = range.start.col; c <= range.end.col; c++) {
        rowValues.push(r * 10 + c);
      }
      out.push(rowValues);
    }
    return out;
  },
  isCellFormula: (row, col) => row === 0 && col === 0,
};

const parser = new FormulaParser();

function evaluate(formula: string): unknown {
  const { ast, error } = parser.parse(formula);
  if (error) throw new Error(error);
  return parser.evaluate(ast, ctx);
}

describe('ROW / COLUMN', () => {
  it('return the index of a reference', () => {
    expect(evaluate('=ROW(A5)')).toBe(5);
    expect(evaluate('=COLUMN(C1)')).toBe(3);
    expect(evaluate('=ROW(B2:B9)')).toBe(2);
  });

  it('return the current cell with no argument', () => {
    expect(evaluate('=ROW()')).toBe(1);
    expect(evaluate('=COLUMN()')).toBe(1);
  });
});

describe('OFFSET', () => {
  it('shifts a single-cell reference', () => {
    expect(evaluate('=OFFSET(A1, 2, 1)')).toBe(21);
  });

  it('produces a range that an aggregate can consume', () => {
    expect(evaluate('=SUM(OFFSET(A1, 0, 0, 2, 2))')).toBe(0 + 1 + 10 + 11);
  });

  it('rejects a non-positive size', () => {
    expect(() => evaluate('=OFFSET(A1, 0, 0, 0, 1)')).toThrow('#REF!');
  });
});

describe('INDIRECT', () => {
  it('resolves a cell reference from text', () => {
    expect(evaluate('=INDIRECT("C2")')).toBe(12);
  });

  it('resolves a range that an aggregate can consume', () => {
    expect(evaluate('=SUM(INDIRECT("A1:B2"))')).toBe(0 + 1 + 10 + 11);
  });

  it('errors on text that is not a reference', () => {
    expect(() => evaluate('=INDIRECT("not a ref")')).toThrow('#REF!');
  });
});

describe('ISREF / ISFORMULA', () => {
  it('ISREF is true only for references', () => {
    expect(evaluate('=ISREF(A1)')).toBe(true);
    expect(evaluate('=ISREF(A1:B2)')).toBe(true);
    expect(evaluate('=ISREF(OFFSET(A1, 1, 1))')).toBe(true);
    expect(evaluate('=ISREF(5)')).toBe(false);
    expect(evaluate('=ISREF("text")')).toBe(false);
  });

  it('ISFORMULA reports whether the referenced cell holds a formula', () => {
    expect(evaluate('=ISFORMULA(A1)')).toBe(true);
    expect(evaluate('=ISFORMULA(B2)')).toBe(false);
  });
});

describe('CELL', () => {
  it('reports address, row and column', () => {
    expect(evaluate('=CELL("address", B3)')).toBe('$B$3');
    expect(evaluate('=CELL("row", B3)')).toBe(3);
    expect(evaluate('=CELL("col", B3)')).toBe(2);
    expect(evaluate('=CELL("address")')).toBe('$A$1');
  });

  it('reports contents and value type', () => {
    expect(evaluate('=CELL("contents", C2)')).toBe(12);
    expect(evaluate('=CELL("type", A1)')).toBe('v');
    expect(evaluate('=CELL("type", A8)')).toBe('b');
    expect(evaluate('=CELL("type", A9)')).toBe('l');
  });

  it('rejects an unknown info type', () => {
    expect(() => evaluate('=CELL("filename", A1)')).toThrow('#VALUE!');
  });
});
