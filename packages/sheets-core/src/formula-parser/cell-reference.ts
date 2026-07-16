// Cell reference parsing utilities

import type { CellReference, RangeReference } from './types';

const COLUMN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function parseCellReference(ref: string): CellReference | null {
  // Match patterns like A1, $A1, A$1, $A$1, sheetname!A1, 'sheet name'!A1
  let sheetName: string | undefined;
  let cellPart = ref;

  // Check for cross-sheet reference (sheetname!A1 or 'sheet name'!A1)
  const sheetMatch = ref.match(/^(?:'([^']+)'|([^!]+))!(.+)$/);
  if (sheetMatch) {
    sheetName = sheetMatch[1] || sheetMatch[2]; // Use quoted name if present, otherwise unquoted
    cellPart = sheetMatch[3];
  }

  // Match patterns like A1, $A1, A$1, $A$1. Column letters are accepted in any
  // case (Excel/Sheets are case-insensitive: `a1` === `A1`); columnLabelToIndex
  // upper-cases internally.
  const match = cellPart.match(/^(\$?)([A-Za-z]+)(\$?)(\d+)$/);
  if (!match) return null;

  const [, colAbs, colStr, rowAbs, rowStr] = match;
  const col = columnLabelToIndex(colStr);
  const row = parseInt(rowStr, 10) - 1; // Convert to 0-based

  if (col === -1 || isNaN(row) || row < 0) return null;

  // $ prefix means absolute, no $ means relative
  return {
    row,
    col,
    rowAbsolute: rowAbs === '$', // Row is absolute if $ is present before row number
    colAbsolute: colAbs === '$', // Column is absolute if $ is present before column letter
    sheetName,
  };
}

export function parseRangeReference(ref: string): RangeReference | null {
  // Match patterns like A1:B10, $A$1:$B$10, sheetname!A1:B10, 'sheet name'!A1:B10
  let sheetName: string | undefined;
  let rangePart = ref;

  // Check for cross-sheet reference (sheetname!A1:B10 or 'sheet name'!A1:B10)
  const sheetMatch = ref.match(/^(?:'([^']+)'|([^!]+))!(.+)$/);
  if (sheetMatch) {
    sheetName = sheetMatch[1] || sheetMatch[2]; // Use quoted name if present, otherwise unquoted
    rangePart = sheetMatch[3];
  }

  // Split by colon, but be careful not to split if colon is inside quotes
  const colonIndex = rangePart.indexOf(':');
  if (colonIndex === -1) return null;

  const startPart = rangePart.substring(0, colonIndex);
  const endPart = rangePart.substring(colonIndex + 1);

  const start = parseCellReference(sheetName ? `${sheetName}!${startPart}` : startPart);
  const end = parseCellReference(sheetName ? `${sheetName}!${endPart}` : endPart);

  if (!start || !end) return null;

  // Ensure both start and end have the same sheet name
  if (sheetName) {
    start.sheetName = sheetName;
    end.sheetName = sheetName;
  }

  return { start, end };
}

export function columnLabelToIndex(label: string): number {
  let index = 0;
  for (let i = 0; i < label.length; i++) {
    const char = label[i].toUpperCase();
    const charIndex = COLUMN_LETTERS.indexOf(char);
    if (charIndex === -1) return -1;
    index = index * 26 + (charIndex + 1);
  }
  return index - 1; // Convert to 0-based
}

export function columnIndexToLabel(index: number): string {
  let label = '';
  index += 1; // Convert to 1-based
  while (index > 0) {
    index -= 1;
    label = COLUMN_LETTERS[index % 26] + label;
    index = Math.floor(index / 26);
  }
  return label;
}

export function cellReferenceToKey(ref: CellReference, currentRow: number, currentCol: number): string {
  const row = ref.rowAbsolute ? ref.row : currentRow + ref.row;
  const col = ref.colAbsolute ? ref.col : currentCol + ref.col;
  return `${row}:${col}`;
}

