// Cell key utilities.
//
// Two key formats coexist:
//   - Index keys ("r:c", numeric)   — used in events and on the wire (consumer-facing payloads)
//   - Stable keys ("rowId:colId")   — used internally by Sheet storage and FormulaGraph,
//                                     where collab safety requires identifiers that
//                                     don't shift under concurrent inserts.
//
// Translate at boundaries using SheetImpl's row/col order maps.

export function getCellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function parseCellKey(key: string): { row: number; col: number } {
  const [row, col] = key.split(':').map(Number);
  return { row, col };
}

export function isValidCellKey(key: string): boolean {
  const parts = key.split(':');
  if (parts.length !== 2) return false;
  const row = Number(parts[0]);
  const col = Number(parts[1]);
  return !isNaN(row) && !isNaN(col) && row >= 0 && col >= 0;
}

/** Build a stable cell key from row/column IDs. */
export function getStableCellKey(rowId: string, colId: string): string {
  return `${rowId}:${colId}`;
}

/** Parse a stable cell key back into its row/column ID parts. */
export function parseStableCellKey(key: string): { rowId: string; colId: string } {
  const sep = key.indexOf(':');
  return { rowId: key.slice(0, sep), colId: key.slice(sep + 1) };
}
