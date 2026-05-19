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
  /**
   * rowId → numeric display index. Storing the reverse direction lets each
   * peer write to a different rowId without colliding (rowIds are random
   * per peer). When two peers concurrently shove different rowIds at the
   * same index, both entries persist and deserialization tie-breaks by
   * (index, rowId) — both peers converge to the same final order.
   */
  rowOrder: Y.Map<number>;
  colOrder: Y.Map<number>;
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
    rowOrder: sheetMap.get('rowOrder') as Y.Map<number>,
    colOrder: sheetMap.get('colOrder') as Y.Map<number>,
    cells: sheetMap.get('cells') as Y.Map<Cell>,
    rowHeights: sheetMap.get('rowHeights') as Y.Map<number>,
    colWidths: sheetMap.get('colWidths') as Y.Map<number>,
    hiddenRows: sheetMap.get('hiddenRows') as Y.Map<true>,
    hiddenCols: sheetMap.get('hiddenCols') as Y.Map<true>,
    filters: sheetMap.get('filters') as Y.Map<ColumnFilter>,
  };
}

/**
 * Get or create the per-sheet Y.Map under workbook.sheets[sheetId], wired
 * up with all its sub-Y.Maps. Must be called inside a Y transaction.
 *
 * The order matters: we integrate the parent sheetMap into workbook.sheets
 * BEFORE setting child Y.Maps on it. Y.js handles mutations on detached
 * types in most cases, but building a tree of nested Y.Maps and then
 * integrating the root can leave the child references in an inconsistent
 * state when read back via .get() — concretely, t.cells.set then throws
 * "Cannot read properties of undefined (reading 'set')". Integrating the
 * parent first sidesteps it entirely.
 */
export function ensureSheetYMap(
  parentSheets: Y.Map<Y.Map<unknown>>,
  sheetId: string,
): Y.Map<unknown> {
  let sheetMap = parentSheets.get(sheetId);
  if (sheetMap) return sheetMap;
  sheetMap = new Y.Map<unknown>();
  parentSheets.set(sheetId, sheetMap);
  sheetMap.set('meta', new Y.Map<unknown>());
  sheetMap.set('rowOrder', new Y.Map<number>());
  sheetMap.set('colOrder', new Y.Map<number>());
  sheetMap.set('cells', new Y.Map<Cell>());
  sheetMap.set('rowHeights', new Y.Map<number>());
  sheetMap.set('colWidths', new Y.Map<number>());
  sheetMap.set('hiddenRows', new Y.Map<true>());
  sheetMap.set('hiddenCols', new Y.Map<true>());
  sheetMap.set('filters', new Y.Map<ColumnFilter>());
  return sheetMap;
}

/** @deprecated kept as an alias during the transition; prefer ensureSheetYMap. */
export const createSheetYMap = (): Y.Map<unknown> => {
  // For callers that don't have the parent yet, fall back to the old shape.
  // Note: callers using this MUST integrate the returned map into a parent
  // BEFORE mutating its children, otherwise the sub-Y.Maps may be unreadable.
  const sheetMap = new Y.Map<unknown>();
  sheetMap.set('meta', new Y.Map<unknown>());
  sheetMap.set('rowOrder', new Y.Map<number>());
  sheetMap.set('colOrder', new Y.Map<number>());
  sheetMap.set('cells', new Y.Map<Cell>());
  sheetMap.set('rowHeights', new Y.Map<number>());
  sheetMap.set('colWidths', new Y.Map<number>());
  sheetMap.set('hiddenRows', new Y.Map<true>());
  sheetMap.set('hiddenCols', new Y.Map<true>());
  sheetMap.set('filters', new Y.Map<ColumnFilter>());
  return sheetMap;
};

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
      const sheetMap = ensureSheetYMap(types.sheets, sheetData.id);
      hydrateSheetYMap(sheetMap, sheetData);
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

  // rowOrder / colOrder: wire format is sparse Array<[idx, id]>; store as
  // Y.Map<rowId, idx>.
  if (data.rowOrder) {
    for (const [idx, id] of data.rowOrder) {
      t.rowOrder.set(id, idx);
    }
  }
  if (data.colOrder) {
    for (const [idx, id] of data.colOrder) {
      t.colOrder.set(id, idx);
    }
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
 * Read a Y.Map<id, idx> back into the SheetData sparse Array<[idx, id]>
 * form. Sorting by (idx, id) ensures deterministic tie-breaks across peers
 * when two rowIds end up at the same display index (rare; happens only on
 * truly-concurrent insertions).
 */
function serializeOrderMap(map: Y.Map<number>): Array<[number, string]> {
  const entries: Array<[number, string]> = [];
  for (const [id, idx] of map.entries()) entries.push([idx, id]);
  entries.sort(([a, ia], [b, ib]) => a - b || ia.localeCompare(ib));
  return entries;
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

  const rowOrderEntries = serializeOrderMap(t.rowOrder);
  const colOrderEntries = serializeOrderMap(t.colOrder);

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
    rowOrder: rowOrderEntries,
    colOrder: colOrderEntries,
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
