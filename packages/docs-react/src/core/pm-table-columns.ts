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
