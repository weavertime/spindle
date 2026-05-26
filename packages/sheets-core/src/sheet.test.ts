import { SheetImpl } from './sheet';
import { WorkbookImpl } from './workbook';

describe('SheetImpl merged cells', () => {
  it('merges a range and reports it as a normalized region', () => {
    const sheet = new SheetImpl('s', 'S');
    sheet.mergeCells({ startRow: 1, startCol: 1, endRow: 3, endCol: 2 });
    expect(sheet.getMergedRegions()).toEqual([
      { startRow: 1, startCol: 1, endRow: 3, endCol: 2 },
    ]);
  });

  it('ignores a single-cell merge', () => {
    const sheet = new SheetImpl('s', 'S');
    sheet.mergeCells({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    expect(sheet.getMergedRegions()).toEqual([]);
  });

  it('clears covered cells, keeping the anchor', () => {
    const sheet = new SheetImpl('s', 'S');
    sheet.setCellValue(0, 0, 'anchor');
    sheet.setCellValue(0, 1, 'covered');
    sheet.setCellValue(1, 0, 'covered');
    sheet.mergeCells({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
    expect(sheet.getCell(0, 0)?.value).toBe('anchor');
    expect(sheet.getCell(0, 1)).toBeUndefined();
    expect(sheet.getCell(1, 0)).toBeUndefined();
  });

  it('reports the region covering a cell via getMergeAt', () => {
    const sheet = new SheetImpl('s', 'S');
    sheet.mergeCells({ startRow: 2, startCol: 2, endRow: 4, endCol: 4 });
    expect(sheet.getMergeAt(3, 3)).toEqual({
      startRow: 2, startCol: 2, endRow: 4, endCol: 4,
    });
    expect(sheet.getMergeAt(0, 0)).toBeUndefined();
  });

  it('unmerges any region intersecting the range', () => {
    const sheet = new SheetImpl('s', 'S');
    sheet.mergeCells({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
    sheet.unmergeCells({ startRow: 1, startCol: 1, endRow: 1, endCol: 1 });
    expect(sheet.getMergedRegions()).toEqual([]);
  });

  it('replaces an overlapping region on a new merge', () => {
    const sheet = new SheetImpl('s', 'S');
    sheet.mergeCells({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
    sheet.mergeCells({ startRow: 1, startCol: 1, endRow: 2, endCol: 2 });
    expect(sheet.getMergedRegions()).toEqual([
      { startRow: 1, startCol: 1, endRow: 2, endCol: 2 },
    ]);
  });

  it('shifts a region down when a row is inserted above it', () => {
    const sheet = new SheetImpl('s', 'S');
    sheet.mergeCells({ startRow: 2, startCol: 0, endRow: 3, endCol: 1 });
    sheet.insertRows(0, 1);
    expect(sheet.getMergedRegions()).toEqual([
      { startRow: 3, startCol: 0, endRow: 4, endCol: 1 },
    ]);
  });

  it('expands a region when a row is inserted inside it', () => {
    const sheet = new SheetImpl('s', 'S');
    sheet.mergeCells({ startRow: 0, startCol: 0, endRow: 2, endCol: 1 });
    sheet.insertRows(1, 1);
    expect(sheet.getMergedRegions()).toEqual([
      { startRow: 0, startCol: 0, endRow: 3, endCol: 1 },
    ]);
  });

  it('drops a region when one of its corner rows is deleted', () => {
    const sheet = new SheetImpl('s', 'S');
    sheet.mergeCells({ startRow: 1, startCol: 0, endRow: 2, endCol: 1 });
    sheet.deleteRows(2, 1);
    expect(sheet.getMergedRegions()).toEqual([]);
  });
});

describe('WorkbookImpl merged cells', () => {
  it('records merge in history so undo restores covered cells', () => {
    const wb = new WorkbookImpl('w', 'W');
    wb.setCellValue(undefined, 0, 1, 'covered');
    wb.mergeCells({ startRow: 0, startCol: 0, endRow: 0, endCol: 1 });
    expect(wb.getSheet().getMergedRegions()).toHaveLength(1);
    expect(wb.getSheet().getCell(0, 1)).toBeUndefined();

    wb.undo();
    expect(wb.getSheet().getMergedRegions()).toEqual([]);
    expect(wb.getSheet().getCell(0, 1)?.value).toBe('covered');
  });

  it('round-trips merged regions through getData/setData', () => {
    const wb = new WorkbookImpl('w', 'W');
    wb.mergeCells({ startRow: 1, startCol: 1, endRow: 2, endCol: 3 });
    const data = wb.getData();

    const restored = new WorkbookImpl('w2', 'W2');
    restored.setData(data);
    expect(restored.getSheet().getMergedRegions()).toEqual([
      { startRow: 1, startCol: 1, endRow: 2, endCol: 3 },
    ]);
  });

  it('refuses to sort while a merged region exists', () => {
    const wb = new WorkbookImpl('w', 'W');
    wb.setCellValue(undefined, 0, 0, 3);
    wb.setCellValue(undefined, 1, 0, 1);
    wb.setCellValue(undefined, 2, 0, 2);
    wb.mergeCells({ startRow: 0, startCol: 2, endRow: 1, endCol: 2 });

    wb.setSortOrder([{ column: 0, direction: 'asc' }]);
    wb.sortSheet();

    // Sort was blocked — column A keeps its original order.
    expect(wb.getSheet().getCellValue(0, 0)).toBe(3);
    expect(wb.getSheet().getCellValue(1, 0)).toBe(1);
  });
});
