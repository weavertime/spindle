// Span-aware column insert/delete for the ProseMirror table editor.
//
// A table cell may carry colspan/rowspan (from pasted/imported HTML), so a
// cell's *physical* index within its row is not its *logical* column. Operating
// by physical index (as the naive version did) corrupts merged tables: it
// removes/inserts a different logical column in each row, leaving a ragged grid
// and losing content. These helpers build the logical grid (the standard HTML
// table placement algorithm) and translate a logical-column operation into
// ProseMirror edits.

import type { Node as PmNode, Schema } from 'prosemirror-model';
import type { Transaction } from 'prosemirror-state';

export interface PmCellInfo {
  rowIndex: number;
  /** Physical index of the cell within its row. */
  ci: number;
  /** Document position of the cell node's start. */
  pos: number;
  node: PmNode;
  colspan: number;
  rowspan: number;
  /** Logical column where this cell begins. */
  logicalStart: number;
}

export interface ColumnGrid {
  /** grid[row][logicalCol] -> the origin cell occupying that slot (or null). */
  grid: (PmCellInfo | null)[][];
  /** Physical cells per row, in order. */
  rowCells: PmCellInfo[][];
  /** Logical column count (width of the rectangular grid). */
  colCount: number;
}

/** Build the logical column grid for a table node whose start is at `tablePos`. */
export function buildColumnGrid(table: PmNode, tablePos: number): ColumnGrid {
  const grid: (PmCellInfo | null)[][] = [];
  const rowCells: PmCellInfo[][] = [];
  const ensureRow = (r: number): void => {
    while (grid.length <= r) grid.push([]);
  };

  let rowPos = tablePos + 1; // enter table
  table.forEach((rowNode, _rowOffset, rIdx) => {
    ensureRow(rIdx);
    rowCells[rIdx] = [];
    let col = 0;
    let cellPos = rowPos + 1; // enter row
    rowNode.forEach((cellNode, _cellOffset, ci) => {
      while (grid[rIdx][col]) col++; // skip slots covered by a rowspan from above
      const colspan = (cellNode.attrs.colspan as number) || 1;
      const rowspan = (cellNode.attrs.rowspan as number) || 1;
      const info: PmCellInfo = {
        rowIndex: rIdx,
        ci,
        pos: cellPos,
        node: cellNode,
        colspan,
        rowspan,
        logicalStart: col,
      };
      rowCells[rIdx].push(info);
      for (let dr = 0; dr < rowspan; dr++) {
        ensureRow(rIdx + dr);
        for (let dc = 0; dc < colspan; dc++) grid[rIdx + dr][col + dc] = info;
      }
      col += colspan;
      cellPos += cellNode.nodeSize;
    });
    rowPos += rowNode.nodeSize;
  });

  const colCount = rowCells[0] ? rowCells[0].reduce((s, c) => s + c.colspan, 0) : 0;
  return { grid, rowCells, colCount };
}

/** Logical column of the physical cell at (rowIndex, physicalCol), or 0. */
export function logicalColumnForCell(
  table: PmNode,
  tablePos: number,
  rowIndex: number,
  physicalCol: number,
): number {
  const { rowCells } = buildColumnGrid(table, tablePos);
  return rowCells[rowIndex]?.[physicalCol]?.logicalStart ?? 0;
}

type Edit =
  | { pos: number; kind: 'insert'; node: PmNode }
  | { pos: number; kind: 'markup'; node: PmNode; attrs: Record<string, unknown> };

/** Apply edits to the transaction from highest position to lowest, so an
 *  earlier-applied (higher) edit never shifts a later one. */
function applyEdits(tr: Transaction, edits: Edit[]): void {
  edits.sort((a, b) => b.pos - a.pos);
  for (const e of edits) {
    if (e.kind === 'insert') tr.insert(e.pos, e.node);
    else tr.setNodeMarkup(e.pos, undefined, e.attrs);
  }
}

/**
 * Insert a logical column at `logicalCol`. A cell straddling the boundary widens
 * its colspan (once, even across a rowspan); every other row gets a fresh empty
 * cell at the physical position for that logical column. Returns false (no edit)
 * if the table has no rows.
 */
export function applyInsertColumn(
  tr: Transaction,
  table: PmNode,
  tablePos: number,
  logicalCol: number,
  schema: Schema,
): boolean {
  const { grid, rowCells } = buildColumnGrid(table, tablePos);
  if (rowCells.length === 0) return false;

  const widen = new Set<PmCellInfo>();
  const edits: Edit[] = [];
  const makeCell = (): PmNode =>
    schema.nodes.table_cell.create(null, schema.nodes.paragraph.create());

  for (let r = 0; r < rowCells.length; r++) {
    const gRow = grid[r];
    if (
      logicalCol > 0 &&
      logicalCol < gRow.length &&
      gRow[logicalCol - 1] &&
      gRow[logicalCol] === gRow[logicalCol - 1]
    ) {
      widen.add(gRow[logicalCol]!); // boundary runs through a span → widen it
      continue;
    }
    const cells = rowCells[r];
    const at = cells.find((c) => c.logicalStart >= logicalCol);
    const insertPos = at
      ? at.pos
      : cells.length > 0
        ? cells[cells.length - 1].pos + cells[cells.length - 1].node.nodeSize
        : null;
    if (insertPos !== null) edits.push({ pos: insertPos, kind: 'insert', node: makeCell() });
  }

  widen.forEach((c) =>
    edits.push({ pos: c.pos, kind: 'markup', node: c.node, attrs: { ...c.node.attrs, colspan: c.colspan + 1 } }),
  );

  if (edits.length === 0) return false;
  applyEdits(tr, edits);
  return true;
}

/**
 * Delete the logical column at `logicalCol`. An origin cell intersecting the
 * column is shrunk (colspan > 1) or removed (colspan === 1), each touched once
 * regardless of how many rows a rowspan makes it cover. Returns false if the
 * table would drop below one column (or has none).
 */
export function applyDeleteColumn(
  tr: Transaction,
  table: PmNode,
  tablePos: number,
  logicalCol: number,
): boolean {
  const { grid, colCount } = buildColumnGrid(table, tablePos);
  if (colCount <= 1 || logicalCol < 0 || logicalCol >= colCount) return false;

  const shrink = new Set<PmCellInfo>();
  const remove = new Set<PmCellInfo>();
  for (let r = 0; r < grid.length; r++) {
    const owner = grid[r][logicalCol];
    if (!owner) continue;
    if (owner.colspan > 1) shrink.add(owner);
    else remove.add(owner);
  }

  const edits: Array<{ pos: number; apply: () => void }> = [];
  shrink.forEach((c) =>
    edits.push({
      pos: c.pos,
      apply: () => tr.setNodeMarkup(c.pos, undefined, { ...c.node.attrs, colspan: c.colspan - 1 }),
    }),
  );
  remove.forEach((c) =>
    edits.push({ pos: c.pos, apply: () => tr.delete(c.pos, c.pos + c.node.nodeSize) }),
  );

  if (edits.length === 0) return false;
  edits.sort((a, b) => b.pos - a.pos); // highest position first
  for (const e of edits) e.apply();
  return true;
}

// --- Row operations -------------------------------------------------------
//
// Rows map 1:1 to table_row nodes (rowspan doesn't create phantom rows), so the
// caller's row index is already the logical row. But a rowspan cell can span a
// deleted/inserted boundary, so the naive "delete/insert a row node" corrupts
// merged tables. We rebuild the table from its logical origin cells — preserving
// each origin cell's content — which keeps spans consistent and never loses a
// cell's content (a rowspan cell deleted at its origin relocates down).

interface OriginCell {
  row: number;
  col: number; // logical start column
  colspan: number;
  rowspan: number;
  node: PmNode;
}

function tableToOrigins(table: PmNode, tablePos: number): { origins: OriginCell[]; rowCount: number; colCount: number } {
  const { rowCells, colCount } = buildColumnGrid(table, tablePos);
  const origins: OriginCell[] = [];
  for (const rowArr of rowCells) {
    for (const c of rowArr) {
      origins.push({ row: c.rowIndex, col: c.logicalStart, colspan: c.colspan, rowspan: c.rowspan, node: c.node });
    }
  }
  return { origins, rowCount: rowCells.length, colCount };
}

/** Rebuild a table node from origin cells, or null if any row would be empty
 *  (an invalid/degenerate grid we refuse to touch rather than crash). */
function rebuildTable(schema: Schema, table: PmNode, origins: OriginCell[], rowCount: number): PmNode | null {
  const rows: PmNode[] = [];
  for (let r = 0; r < rowCount; r++) {
    const rowOrigins = origins.filter((o) => o.row === r).sort((a, b) => a.col - b.col);
    if (rowOrigins.length === 0) return null; // a fully-covered row can't be represented
    const cells = rowOrigins.map((o) =>
      o.node.type.create({ ...o.node.attrs, colspan: o.colspan, rowspan: o.rowspan }, o.node.content),
    );
    rows.push(schema.nodes.table_row.create(null, cells));
  }
  try {
    return table.type.create(table.attrs, rows);
  } catch {
    return null;
  }
}

function emptyCell(schema: Schema): PmNode {
  return schema.nodes.table_cell.create(null, schema.nodes.paragraph.create());
}

/** Insert a row before (`position: 'before'`) or after the given row index. */
export function applyInsertRow(
  tr: Transaction,
  table: PmNode,
  tablePos: number,
  rowIndex: number,
  position: 'before' | 'after',
  schema: Schema,
): boolean {
  const { origins, rowCount, colCount } = tableToOrigins(table, tablePos);
  const R = position === 'after' ? rowIndex + 1 : rowIndex;
  if (R < 0 || R > rowCount) return false;

  const newOrigins: OriginCell[] = [];
  const coveredCols = new Set<number>();
  for (const o of origins) {
    const oEnd = o.row + o.rowspan - 1;
    if (o.row < R && oEnd >= R) {
      // The new row splits this cell's vertical span — widen it.
      for (let c = o.col; c < o.col + o.colspan; c++) coveredCols.add(c);
      newOrigins.push({ ...o, rowspan: o.rowspan + 1 });
    } else if (o.row >= R) {
      newOrigins.push({ ...o, row: o.row + 1 });
    } else {
      newOrigins.push(o);
    }
  }
  // Fresh empty cells for every logical column not covered by a widened span.
  for (let c = 0; c < colCount; c++) {
    if (!coveredCols.has(c)) {
      newOrigins.push({ row: R, col: c, colspan: 1, rowspan: 1, node: emptyCell(schema) });
    }
  }
  const newTable = rebuildTable(schema, table, newOrigins, rowCount + 1);
  if (!newTable) return false;
  tr.replaceWith(tablePos, tablePos + table.nodeSize, newTable);
  return true;
}

/** Delete the row at `rowIndex`, shrinking spans and relocating a rowspan cell's
 *  content down instead of losing it. */
export function applyDeleteRow(
  tr: Transaction,
  table: PmNode,
  tablePos: number,
  rowIndex: number,
  schema: Schema,
): boolean {
  const { origins, rowCount } = tableToOrigins(table, tablePos);
  if (rowCount <= 1 || rowIndex < 0 || rowIndex >= rowCount) return false;
  const R = rowIndex;

  const newOrigins: OriginCell[] = [];
  for (const o of origins) {
    const oEnd = o.row + o.rowspan - 1;
    if (o.row < R) {
      // Starts above; shrink if it covers the deleted row.
      newOrigins.push({ ...o, rowspan: oEnd >= R ? o.rowspan - 1 : o.rowspan });
    } else if (o.row === R) {
      // Origin in the deleted row: rowspan 1 disappears; rowspan>1 relocates its
      // content down into the row that takes R's place (rowspan − 1).
      if (o.rowspan > 1) newOrigins.push({ ...o, row: R, rowspan: o.rowspan - 1 });
    } else {
      newOrigins.push({ ...o, row: o.row - 1 }); // below: shift up
    }
  }
  const newTable = rebuildTable(schema, table, newOrigins, rowCount - 1);
  if (!newTable) return false;
  tr.replaceWith(tablePos, tablePos + table.nodeSize, newTable);
  return true;
}
