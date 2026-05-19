// Y.Doc schema for collaborative workbooks.
//
// Layout:
//   meta:       Y.Map  — workbook-level fields (id, name, activeSheetId, defaults)
//   stylePool:  Y.Map  — styleId  → CellStyle JSON
//   formatPool: Y.Map  — formatId → CellFormat JSON
//   sheetIds:   Y.Array<string>  — sheet display order
//   sheets:     Y.Map  — sheetId → per-sheet Y.Map (see SheetYTypes below)
//
// Each sheet's Y.Map contains:
//   meta:       Y.Map  — id, name, rowCount, colCount, frozenRows/Cols, showGridLines, sortOrder JSON
//   rowOrder:   Y.Array<rowId>
//   colOrder:   Y.Array<colId>
//   cells:      Y.Map<"rowId:colId", Cell JSON>
//   rowHeights: Y.Map<rowId, number>
//   colWidths:  Y.Map<colId, number>
//   hiddenRows: Y.Map<rowId, true>   — used as a set
//   hiddenCols: Y.Map<colId, true>
//   filters:    Y.Map<colId, ColumnFilter JSON>
//
// Cells are stored as plain JSON inside the Y.Map. Concurrent writes to
// DIFFERENT cells merge cleanly via Y.Map; same-cell concurrent writes are
// last-writer-wins, which is acceptable for v1. Going finer-grained (per
// cell-field Y.Map) is a future option.

import * as Y from 'yjs';
import type {
  Cell,
  CellFormat,
  CellStyle,
  ColumnFilter,
  Selection,
  SheetData,
  SortOrder,
  WorkbookData,
} from '../types';

export interface SheetYTypes {
  root: Y.Map<unknown>;
  meta: Y.Map<unknown>;
  rowOrder: Y.Array<string>;
  colOrder: Y.Array<string>;
  cells: Y.Map<Cell>;
  rowHeights: Y.Map<number>;
  colWidths: Y.Map<number>;
  hiddenRows: Y.Map<true>;
  hiddenCols: Y.Map<true>;
  filters: Y.Map<ColumnFilter>;
}

export interface WorkbookYTypes {
  meta: Y.Map<unknown>;
  stylePool: Y.Map<CellStyle>;
  formatPool: Y.Map<CellFormat>;
  sheetIds: Y.Array<string>;
  sheets: Y.Map<Y.Map<unknown>>;
}

/** Return the named top-level Y types. Idempotent. */
export function getWorkbookYTypes(ydoc: Y.Doc): WorkbookYTypes {
  return {
    meta: ydoc.getMap<unknown>('meta'),
    stylePool: ydoc.getMap<CellStyle>('stylePool'),
    formatPool: ydoc.getMap<CellFormat>('formatPool'),
    sheetIds: ydoc.getArray<string>('sheetIds'),
    sheets: ydoc.getMap<Y.Map<unknown>>('sheets'),
  };
}

/** Pull out the named sub-types from a sheet's Y.Map. Caller ensures the
 *  map is shaped correctly (created via createSheetYMap or hydrated). */
export function getSheetYTypes(sheetMap: Y.Map<unknown>): SheetYTypes {
  return {
    root: sheetMap,
    meta: sheetMap.get('meta') as Y.Map<unknown>,
    rowOrder: sheetMap.get('rowOrder') as Y.Array<string>,
    colOrder: sheetMap.get('colOrder') as Y.Array<string>,
    cells: sheetMap.get('cells') as Y.Map<Cell>,
    rowHeights: sheetMap.get('rowHeights') as Y.Map<number>,
    colWidths: sheetMap.get('colWidths') as Y.Map<number>,
    hiddenRows: sheetMap.get('hiddenRows') as Y.Map<true>,
    hiddenCols: sheetMap.get('hiddenCols') as Y.Map<true>,
    filters: sheetMap.get('filters') as Y.Map<ColumnFilter>,
  };
}

/**
 * Build an empty Y.Map shaped like a sheet, ready to be inserted into the
 * workbook's `sheets` Y.Map. Must be called inside a Y transaction.
 */
export function createSheetYMap(): Y.Map<unknown> {
  const sheetMap = new Y.Map<unknown>();
  sheetMap.set('meta', new Y.Map<unknown>());
  sheetMap.set('rowOrder', new Y.Array<string>());
  sheetMap.set('colOrder', new Y.Array<string>());
  sheetMap.set('cells', new Y.Map<Cell>());
  sheetMap.set('rowHeights', new Y.Map<number>());
  sheetMap.set('colWidths', new Y.Map<number>());
  sheetMap.set('hiddenRows', new Y.Map<true>());
  sheetMap.set('hiddenCols', new Y.Map<true>());
  sheetMap.set('filters', new Y.Map<ColumnFilter>());
  return sheetMap;
}

// ============================================================================
// WorkbookData → Y.Doc  (called once on attachCollab to seed peer-zero)
// ============================================================================

export function hydrateYDocFromData(ydoc: Y.Doc, data: WorkbookData): void {
  const types = getWorkbookYTypes(ydoc);

  ydoc.transact(() => {
    types.meta.set('id', data.id);
    types.meta.set('name', data.name);
    types.meta.set('activeSheetId', data.activeSheetId);
    types.meta.set('defaultRowHeight', data.defaultRowHeight);
    types.meta.set('defaultColWidth', data.defaultColWidth);

    for (const [styleId, style] of Object.entries(data.stylePool)) {
      types.stylePool.set(styleId, style);
    }
    if (data.formatPool) {
      for (const [formatId, format] of Object.entries(data.formatPool)) {
        types.formatPool.set(formatId, format);
      }
    }

    for (const sheetData of data.sheets) {
      types.sheetIds.push([sheetData.id]);
      const sheetMap = createSheetYMap();
      hydrateSheetYMap(sheetMap, sheetData);
      types.sheets.set(sheetData.id, sheetMap);
    }
  });
}

function hydrateSheetYMap(sheetMap: Y.Map<unknown>, data: SheetData): void {
  const t = getSheetYTypes(sheetMap);

  // meta
  t.meta.set('id', data.id);
  t.meta.set('name', data.name);
  t.meta.set('rowCount', data.rowCount);
  t.meta.set('colCount', data.colCount);
  if (data.config.frozenRows !== undefined) {
    t.meta.set('frozenRows', data.config.frozenRows);
  }
  if (data.config.frozenCols !== undefined) {
    t.meta.set('frozenCols', data.config.frozenCols);
  }
  if (data.config.showGridLines !== undefined) {
    t.meta.set('showGridLines', data.config.showGridLines);
  }
  if (data.config.defaultRowHeight !== undefined) {
    t.meta.set('defaultRowHeight', data.config.defaultRowHeight);
  }
  if (data.config.defaultColWidth !== undefined) {
    t.meta.set('defaultColWidth', data.config.defaultColWidth);
  }
  if (data.config.sortOrder) {
    t.meta.set('sortOrder', data.config.sortOrder);
  }

  // rowOrder / colOrder. Wire format may be sparse Array<[idx, id]>; we
  // rebuild a dense order of rowIds in index order.
  if (data.rowOrder) {
    const dense = denseRowOrderFrom(data.rowOrder);
    t.rowOrder.push(dense);
  }
  if (data.colOrder) {
    const dense = denseRowOrderFrom(data.colOrder);
    t.colOrder.push(dense);
  }

  // cells — keys are already stable-form when rowOrder is present.
  for (const { key, cell } of data.cells) {
    t.cells.set(key, cell);
  }

  // ID-keyed config maps. These come through SheetData.config in
  // stable-form ([rowId, value] entries) when rowOrder is present.
  if (data.config.rowHeights) {
    for (const [key, h] of data.config.rowHeights) {
      if (typeof key === 'string') t.rowHeights.set(key, h);
    }
  }
  if (data.config.colWidths) {
    for (const [key, w] of data.config.colWidths) {
      if (typeof key === 'string') t.colWidths.set(key, w);
    }
  }
  if (data.config.hiddenRows) {
    for (const key of data.config.hiddenRows) {
      if (typeof key === 'string') t.hiddenRows.set(key, true);
    }
  }
  if (data.config.hiddenCols) {
    for (const key of data.config.hiddenCols) {
      if (typeof key === 'string') t.hiddenCols.set(key, true);
    }
  }
  if (data.config.filters) {
    for (const [key, filter] of data.config.filters) {
      if (typeof key === 'string') t.filters.set(key, filter);
    }
  }
}

/**
 * SheetData.rowOrder / colOrder is `Array<[index, id]>` (sparse). Y.Array is
 * dense, so we sort by index and produce a packed list of IDs. Gaps are
 * preserved by inserting placeholder slots — but for v1 we just compact;
 * the engine treats untouched indices as virtual rows anyway.
 */
function denseRowOrderFrom(sparse: Array<[number, string]>): string[] {
  return [...sparse].sort(([a], [b]) => a - b).map(([, id]) => id);
}

// ============================================================================
// Y.Doc → WorkbookData  (called on attach to seed a late joiner)
// ============================================================================

export function serializeYDocToData(
  ydoc: Y.Doc,
  selection?: Selection,
): WorkbookData {
  const t = getWorkbookYTypes(ydoc);

  const stylePool: Record<string, CellStyle> = {};
  for (const [k, v] of t.stylePool.entries()) {
    stylePool[k] = v;
  }
  const formatPool: Record<string, CellFormat> = {};
  for (const [k, v] of t.formatPool.entries()) {
    formatPool[k] = v;
  }

  const sheets: SheetData[] = [];
  for (const sheetId of t.sheetIds.toArray()) {
    const sheetMap = t.sheets.get(sheetId);
    if (!sheetMap) continue;
    sheets.push(serializeSheetYMap(sheetMap));
  }

  return {
    id: (t.meta.get('id') as string) ?? '',
    name: (t.meta.get('name') as string) ?? '',
    activeSheetId: (t.meta.get('activeSheetId') as string) ?? '',
    defaultRowHeight: (t.meta.get('defaultRowHeight') as number) ?? 20,
    defaultColWidth: (t.meta.get('defaultColWidth') as number) ?? 100,
    stylePool,
    formatPool,
    sheets,
    selection,
  };
}

function serializeSheetYMap(sheetMap: Y.Map<unknown>): SheetData {
  const t = getSheetYTypes(sheetMap);

  const rowOrderArr = t.rowOrder.toArray();
  const colOrderArr = t.colOrder.toArray();

  const cells: Array<{ key: string; cell: Cell }> = [];
  for (const [key, cell] of t.cells.entries()) {
    cells.push({ key, cell });
  }

  const rowHeights: Array<[string, number]> = [];
  for (const [k, v] of t.rowHeights.entries()) rowHeights.push([k, v]);
  const colWidths: Array<[string, number]> = [];
  for (const [k, v] of t.colWidths.entries()) colWidths.push([k, v]);

  const hiddenRows: string[] = [];
  for (const k of t.hiddenRows.keys()) hiddenRows.push(k);
  const hiddenCols: string[] = [];
  for (const k of t.hiddenCols.keys()) hiddenCols.push(k);

  const filters: Array<[string, ColumnFilter]> = [];
  for (const [k, v] of t.filters.entries()) filters.push([k, v]);

  return {
    id: (t.meta.get('id') as string) ?? '',
    name: (t.meta.get('name') as string) ?? '',
    cells,
    rowOrder: rowOrderArr.map((id, idx) => [idx, id]),
    colOrder: colOrderArr.map((id, idx) => [idx, id]),
    config: {
      rowHeights: rowHeights.length ? rowHeights : undefined,
      colWidths: colWidths.length ? colWidths : undefined,
      hiddenRows: hiddenRows.length ? hiddenRows : undefined,
      hiddenCols: hiddenCols.length ? hiddenCols : undefined,
      frozenRows: t.meta.get('frozenRows') as number | undefined,
      frozenCols: t.meta.get('frozenCols') as number | undefined,
      showGridLines: t.meta.get('showGridLines') as boolean | undefined,
      defaultRowHeight: t.meta.get('defaultRowHeight') as number | undefined,
      defaultColWidth: t.meta.get('defaultColWidth') as number | undefined,
      sortOrder: t.meta.get('sortOrder') as SortOrder[] | undefined,
      filters: filters.length ? filters : undefined,
    },
    rowCount: (t.meta.get('rowCount') as number) ?? 1000,
    colCount: (t.meta.get('colCount') as number) ?? 100,
  };
}
