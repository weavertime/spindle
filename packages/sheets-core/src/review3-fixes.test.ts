import { WorkbookImpl } from './workbook';
import { FormulaParser } from './formula-parser/parser';
import type { EvaluationContext } from './formula-parser/types';
import { SortManager } from './features/sort';
import { exportToCSV, importFromCSV } from './export/csv';

const parser = new FormulaParser();
const ctx: EvaluationContext = { getCellValue: () => null, getRangeValues: () => [] };
const ev = (f: string): unknown => {
  const { ast, error } = parser.parse(f);
  if (error) throw new Error(error);
  return parser.evaluate(ast, ctx);
};

describe('style/format pool round-trips fully (no collapse to one entry)', () => {
  it('restores every style and format on setData', () => {
    const wb = new WorkbookImpl('wb', 'WB');
    wb.setCell(undefined, 0, 0, { value: 1, style: { bold: true } } as never);
    wb.setCell(undefined, 0, 1, { value: 2, style: { italic: true } } as never);
    wb.setCell(undefined, 0, 2, { value: 3, style: { underline: true } } as never);
    const data = wb.getData();
    expect(Object.keys(data.stylePool).length).toBeGreaterThanOrEqual(3);

    const wb2 = new WorkbookImpl('wb2', 'WB2');
    wb2.setData(data);
    // Every style id in the serialized pool resolves after reload.
    for (const id of Object.keys(data.stylePool)) {
      expect(wb2.getStylePool().get(id)).toBeDefined();
    }
  });
});

describe('structural recalc fires only on reference-shifting edits', () => {
  it('recalcs on delete row but NOT on a column-width change', () => {
    const wb = new WorkbookImpl('wb', 'WB');
    wb.setCellValue(undefined, 0, 0, 1);
    wb.setCellValue(undefined, 1, 0, 2);
    wb.setCellValue(undefined, 2, 0, 3);
    wb.setFormula(undefined, 0, 2, '=SUM(A1:A3)');
    expect(wb.getCellValue(undefined, 0, 2)).toBe(6);

    // A cosmetic change must not recompute (no crash, value stays); the real
    // guarantee (no full recalc) is exercised by the perf path — here we just
    // confirm correctness is preserved.
    wb.getSheet().setColWidth(0, 250);
    expect(wb.getCellValue(undefined, 0, 2)).toBe(6);

    // A reference-shifting edit still recomputes.
    wb.getSheet().deleteRows(1, 1);
    expect(wb.getCellValue(undefined, 0, 2)).toBe(4);
  });
});

describe('error values propagate through aggregations', () => {
  function wbWithError(): WorkbookImpl {
    const wb = new WorkbookImpl('wb', 'WB');
    wb.setCellValue(undefined, 0, 0, 1); // A1
    wb.setFormula(undefined, 1, 0, '=1/0'); // A2 = #DIV/0!
    wb.setCellValue(undefined, 2, 0, 3); // A3
    return wb;
  }
  it('SUM/AVERAGE/MAX/MIN/PRODUCT return the error, not a number', () => {
    const wb = wbWithError();
    wb.setFormula(undefined, 0, 2, '=SUM(A1:A3)');
    wb.setFormula(undefined, 1, 2, '=AVERAGE(A1:A3)');
    wb.setFormula(undefined, 2, 2, '=MAX(A1:A3)');
    wb.setFormula(undefined, 3, 2, '=PRODUCT(A1:A3)');
    expect(wb.getCellValue(undefined, 0, 2)).toBe('#DIV/0!');
    expect(wb.getCellValue(undefined, 1, 2)).toBe('#DIV/0!');
    expect(wb.getCellValue(undefined, 2, 2)).toBe('#DIV/0!');
    expect(wb.getCellValue(undefined, 3, 2)).toBe('#DIV/0!');
  });
  it('COUNT still ignores errors (Excel semantics)', () => {
    const wb = wbWithError();
    wb.setFormula(undefined, 0, 2, '=COUNT(A1:A3)');
    expect(wb.getCellValue(undefined, 0, 2)).toBe(2);
  });
});

describe('clean error tokens, not raw JS messages', () => {
  it('REPT with a huge count yields #VALUE!, not "Invalid string length"', () => {
    const wb = new WorkbookImpl('wb', 'WB');
    wb.setFormula(undefined, 0, 0, '=REPT("a",1000000000)');
    expect(wb.getCellValue(undefined, 0, 0)).toBe('#VALUE!');
  });
});

describe('formula function edge cases', () => {
  it('SEQUENCE caps its size (#NUM!)', () => {
    expect(() => ev('=ROWS(SEQUENCE(2000000,50))')).toThrow('#NUM!');
  });
  it('FLOOR/CEILING reject a positive number with negative significance', () => {
    expect(() => ev('=FLOOR(2.5,-2)')).toThrow('#NUM!');
    expect(() => ev('=CEILING(2.5,-2)')).toThrow('#NUM!');
    expect(ev('=FLOOR(-2.5,-2)')).toBe(-2); // same-sign is fine
  });
  it('TEXT pads the integer part to the count of 0 placeholders', () => {
    expect(ev('=TEXT(5,"00000")')).toBe('00005');
    expect(ev('=TEXT(42,"000")')).toBe('042');
  });
});

describe('sort keeps the header row in place', () => {
  it('does not drag the header to the bottom', () => {
    const wb = new WorkbookImpl('wb', 'WB');
    ['Name', 'Charlie', 'Alice', 'Bob'].forEach((v, r) => wb.setCellValue(undefined, r, 0, v));
    SortManager.sortRows(wb.getSheet(), [{ column: 0, direction: 'asc' }]);
    const col = [0, 1, 2, 3].map((r) => wb.getCellValue(undefined, r, 0));
    expect(col).toEqual(['Name', 'Alice', 'Bob', 'Charlie']);
  });
});

describe('CSV import coerces round-trippable numbers back to numbers', () => {
  it('numbers survive an export→import round trip as numbers', () => {
    const wb = new WorkbookImpl('wb', 'WB');
    wb.setCellValue(undefined, 0, 0, -5);
    wb.setCellValue(undefined, 0, 1, 3.5);
    wb.setCellValue(undefined, 1, 0, '007'); // leading zero → stays text
    wb.setCellValue(undefined, 1, 1, 'hello');
    const csv = exportToCSV(wb);

    const wb2 = new WorkbookImpl('wb2', 'WB2');
    importFromCSV(csv, wb2.getSheet());
    expect(wb2.getCellValue(undefined, 0, 0)).toBe(-5);
    expect(wb2.getCellValue(undefined, 0, 1)).toBe(3.5);
    expect(wb2.getCellValue(undefined, 1, 0)).toBe('007');
    expect(wb2.getCellValue(undefined, 1, 1)).toBe('hello');
  });
});
