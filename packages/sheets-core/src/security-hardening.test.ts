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
});
