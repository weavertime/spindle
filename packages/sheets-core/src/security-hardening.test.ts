import { FormulaParser } from './formula-parser/parser';
import { WorkbookImpl } from './workbook';
import { exportToCSV } from './export/csv';

describe('formula DoS guards', () => {
  const parser = new FormulaParser();

  it('does not hang expanding a giant range (dependency expansion is capped)', () => {
    const start = Date.now();
    const res = parser.parse('=SUM(A1:A1048576)');
    expect(res.error).toBeUndefined();
    // The old per-cell expansion would iterate ~1M cells; capped it is instant.
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('rejects a pathologically long formula instead of freezing', () => {
    const long = '=' + Array(20000).fill('1').join('+');
    const res = parser.parse(long);
    expect(res.error).toBeTruthy();
  });

  it('evaluates a giant sparse range without freezing (evaluation is clamped to data)', () => {
    const wb = new WorkbookImpl('wb', 'WB');
    wb.setCellValue(undefined, 0, 0, 1);
    wb.setCellValue(undefined, 1, 0, 2);
    wb.setCellValue(undefined, 2, 0, 3);
    const start = Date.now();
    wb.setFormula(undefined, 0, 1, '=SUM(A1:A1048576)'); // B1, outside column A
    expect(wb.getCellValue(undefined, 0, 1)).toBe(6);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('ROWS/COLUMNS report the range size, not the clamped data extent', () => {
    const wb = new WorkbookImpl('wb', 'WB');
    wb.setCellValue(undefined, 0, 0, 1); // A1
    wb.setCellValue(undefined, 1, 0, 2); // A2
    // These over-100k ranges have their materialized values clamped to the
    // populated extent for DoS safety; size functions must still see the true
    // dimensions (computed from the reference, not the clamped matrix).
    // Place the formulas well outside every referenced range so they don't
    // self-reference (the static dep graph can't know these functions ignore
    // values). Col 100 is past Z (25).
    wb.setFormula(undefined, 0, 100, '=ROWS(A1:A200000)');
    wb.setFormula(undefined, 1, 100, '=COLUMNS(A1:Z200000)');
    expect(wb.getCellValue(undefined, 0, 100)).toBe(200000);
    expect(wb.getCellValue(undefined, 1, 100)).toBe(26);
  });
});

describe('CSV injection guard on export', () => {
  it('prefixes a formula-trigger cell with a quote', () => {
    const wb = new WorkbookImpl('wb', 'WB');
    wb.setCellValue(undefined, 0, 0, '@SUM(1)'); // text beginning with @
    wb.setCellValue(undefined, 0, 1, 'safe');
    wb.setCellValue(undefined, 1, 0, '=1+1'); // a formula
    const csv = exportToCSV(wb);
    expect(csv).toContain("'@SUM(1)");
    expect(csv).toContain("'=1+1");
    expect(csv).toContain('safe');
    expect(csv).not.toContain('\n=');
    expect(csv.startsWith('=')).toBe(false);
  });

  it('does NOT quote-guard negative numbers or booleans (they are not injection vectors)', () => {
    const wb = new WorkbookImpl('wb', 'WB');
    wb.setCellValue(undefined, 0, 0, -5); // negative number
    wb.setCellValue(undefined, 0, 1, 3.5);
    wb.setCellValue(undefined, 1, 0, true); // boolean
    wb.setCellValue(undefined, 1, 1, '-notanumber'); // text starting with '-'
    const csv = exportToCSV(wb);
    const [row0, row1] = csv.split('\n');
    expect(row0).toBe('-5,3.5'); // numbers survive intact
    expect(row1).toBe("true,'-notanumber"); // text still guarded
  });
});
