import { WorkbookImpl } from './workbook';

describe('structural edits recalculate dependent formulas', () => {
  it('recomputes a SUM when a row inside its range is deleted', () => {
    const wb = new WorkbookImpl('wb', 'WB');
    wb.setCellValue(undefined, 0, 0, 1); // A1
    wb.setCellValue(undefined, 1, 0, 2); // A2
    wb.setCellValue(undefined, 2, 0, 3); // A3
    wb.setFormula(undefined, 0, 2, '=SUM(A1:A3)'); // C1
    expect(wb.getCellValue(undefined, 0, 2)).toBe(6);

    wb.getSheet().deleteRows(1, 1); // delete A2
    // C1 must recompute immediately (was stale at 6 before this fix).
    expect(wb.getCellValue(undefined, 0, 2)).toBe(4); // 1 + 3
  });

  it('recomputes a column-based formula when a column is deleted', () => {
    const wb = new WorkbookImpl('wb', 'WB');
    wb.setCellValue(undefined, 0, 0, 5); // A1
    wb.setCellValue(undefined, 0, 1, 7); // B1
    wb.setCellValue(undefined, 0, 2, 9); // C1
    wb.setFormula(undefined, 2, 0, '=SUM(A1:C1)'); // A3 = 21
    expect(wb.getCellValue(undefined, 2, 0)).toBe(21);

    wb.getSheet().deleteCols(1, 1); // delete column B (7)
    expect(wb.getCellValue(undefined, 2, 0)).toBe(14); // 5 + 9
  });
});
