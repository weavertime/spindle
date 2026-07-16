// TSV encoding/parsing for grid copy & paste. Quoting matches what Excel/Sheets
// put on the clipboard, so a cell containing tabs or newlines round-trips
// instead of scrambling the grid.

/** Quote a TSV field that contains a tab, newline, or quote (Excel-compatible). */
export function encodeTsvField(v: string): string {
  return /[\t\n\r"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Serialize a grid of fields to TSV, quoting fields with embedded delimiters. */
export function encodeTsv(rows: string[][]): string {
  return rows.map((r) => r.map(encodeTsvField).join('\t')).join('\n');
}

/**
 * Parse TSV into rows of fields, honoring quoted fields that contain tabs and
 * newlines (as Excel/Sheets emit) and escaped quotes (`""`). Handles CRLF/CR/LF.
 */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const endField = (): void => {
    row.push(field);
    field = '';
  };
  const endRow = (): void => {
    endField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === '\t') endField();
    else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      endRow();
    } else if (ch === '\n') endRow();
    else field += ch;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}
