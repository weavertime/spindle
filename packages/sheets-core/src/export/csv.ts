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
  const lines = csv.split('\n');
  let row = 0;

  for (const line of lines) {
    if (!line.trim()) {
      row++;
      continue;
    }

    // Simple CSV parsing (doesn't handle all edge cases)
    const values = parseCSVLine(line);
    values.forEach((value, col) => {
      if (value.trim()) {
        sheet.setCellValue(row, col, value);
      }
    });

    row++;
  }
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of value
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last value
  values.push(current);

  return values;
}

