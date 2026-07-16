import { WorkbookImpl } from './workbook';

describe('formulas are case-insensitive for refs and function names', () => {
  it('lowercase and mixed-case refs resolve', () => {
    const w = new WorkbookImpl('wb', 'WB');
    w.setCellValue(undefined, 0, 0, 42); // A1
    w.setFormula(undefined, 0, 1, '=a1'); // B1
    w.setFormula(undefined, 0, 2, '=A1'); // C1
    expect(w.getCellValue(undefined, 0, 1)).toBe(42);
    expect(w.getCellValue(undefined, 0, 2)).toBe(42);
  });

  it('lowercase and mixed-case function names resolve', () => {
    const w = new WorkbookImpl('wb', 'WB');
    w.setCellValue(undefined, 0, 0, 10);
    w.setCellValue(undefined, 1, 0, 20);
    w.setFormula(undefined, 0, 1, '=sum(A1:A2)'); // B1
    w.setFormula(undefined, 1, 1, '=Sum(a1:a2)'); // B2
    w.setFormula(undefined, 2, 1, '=SUM(A1:A2)'); // B3
    expect(w.getCellValue(undefined, 0, 1)).toBe(30);
    expect(w.getCellValue(undefined, 1, 1)).toBe(30);
    expect(w.getCellValue(undefined, 2, 1)).toBe(30);
  });
});
