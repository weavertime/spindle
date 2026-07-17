import type { Sheet } from '../types';
import type { WorkbookImpl } from '../workbook';

export function exportToCSV(workbook: WorkbookImpl, sheetId?: string): string {
  const sheet = workbook.getSheet(sheetId);
  const rows: string[][] = [];

  // Find the maximum row and column with data
  let maxRow = 0;
  let maxCol = 0;

  for (const [row, col] of sheet.entries()) {
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
  }

  // Generate CSV rows
  for (let row = 0; row <= maxRow; row++) {
    const csvRow: string[] = [];
    for (let col = 0; col <= maxCol; col++) {
      const cell = sheet.getCell(row, col);
      let value = '';

      if (cell) {
        // Neutralize CSV / formula injection: a text cell that begins with =, +,
        // -, @, or a control char is run as a formula by Excel/Sheets when the
        // file is opened. Guard string content and exported formula strings, but
        // never numbers/booleans — a numeric cell like -5 is not an injection
        // vector, and quoting it would corrupt it into text on re-import.
        if (cell.formula) {
          value = guardCsvInjection(cell.formula);
        } else if (typeof cell.value === 'number' || typeof cell.value === 'boolean') {
          value = cell.value.toString();
        } else if (cell.value != null) {
          value = guardCsvInjection(cell.value.toString());
        }
      }

      // Escape CSV value
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = `"${value.replace(/"/g, '""')}"`;
      }

      csvRow.push(value);
    }
    rows.push(csvRow);
  }

  return rows.map((row) => row.join(',')).join('\n');
}

/** Prefix a leading formula-trigger character with a quote to prevent CSV injection. */
function guardCsvInjection(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function importFromCSV(csv: string, sheet: Sheet): void {
  const rows = parseCSV(csv);
  rows.forEach((values, row) => {
    values.forEach((value, col) => {
      // Set any non-empty field (including whitespace-only, which is a real
      // value between commas: `a, ,c`). Empty fields are left blank.
      if (value !== '') {
        sheet.setCellValue(row, col, coerceCsvField(value));
      }
    });
  });
}

/**
 * Coerce a CSV field to a number when it round-trips exactly (so exportToCSV's
 * unquoted numbers re-import as numbers, per its own contract), while preserving
 * as text anything where coercion would lose information — leading zeros
 * ("007"), exponential spellings ("1e21"), or explicit trailing zeros ("5.0").
 */
function coerceCsvField(value: string): string | number {
  const n = Number(value);
  if (value.trim() !== '' && !Number.isNaN(n) && String(n) === value.trim()) {
    return n;
  }
  return value;
}

/**
 * Parse a CSV document into rows of fields. Handles quoted fields containing
 * commas and embedded newlines, escaped quotes (`""`), and CRLF / CR / LF line
 * endings — so it round-trips this module's own `exportToCSV` output and does
 * not mangle Windows CSVs (trailing `\r` on the last column) or quoted-newline
 * cells (which the old line-then-field split scrambled).
 */
function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let field: string[] = [];
  let inQuotes = false;

  const endField = (): void => {
    field.push(current);
    current = '';
  };
  const endRow = (): void => {
    endField();
    rows.push(field);
    field = [];
  };

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (inQuotes) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          current += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      endField();
    } else if (char === '\r') {
      // CRLF or bare CR ends a row; swallow the paired LF.
      if (csv[i + 1] === '\n') i++;
      endRow();
    } else if (char === '\n') {
      endRow();
    } else {
      current += char;
    }
  }
  // Flush the final field/row unless the file ended exactly on a row break.
  if (current !== '' || field.length > 0) endRow();
  // Drop a trailing fully-empty row produced by a terminal newline.
  if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }
  return rows;
}

