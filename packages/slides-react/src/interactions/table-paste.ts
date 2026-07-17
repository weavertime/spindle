// Parses clipboard data copied from a spreadsheet (Excel, Numbers, Google
// Sheets) into a rectangular grid of plain-text cells, so a paste can drop a
// real table onto the slide. Spreadsheets put an HTML <table> on the clipboard
// (richest — handles multi-line and empty cells) plus a tab-separated plain
// text fallback; we prefer the HTML and fall back to TSV.

// A pasted grid becomes a rows×cols table of live cells, so an adversarial (or
// accidental) huge paste would allocate an unbounded grid and freeze the editor.
// Cap generously — far beyond any real slide table — and truncate to the cap.
export const MAX_PASTE_ROWS = 1000;
export const MAX_PASTE_COLS = 100;

/** Pad every row to the same width so the grid is rectangular. Returns null if
 *  there's nothing tabular (empty, or a single lone value). The result is capped
 *  to MAX_PASTE_ROWS × MAX_PASTE_COLS to bound the allocation. */
export function normalizeGrid(rows: string[][]): string[][] | null {
  const cleaned = rows.filter((r) => r.length > 0).slice(0, MAX_PASTE_ROWS);
  if (!cleaned.length) return null;
  const cols = Math.min(MAX_PASTE_COLS, Math.max(...cleaned.map((r) => r.length)));
  if (cleaned.length === 1 && cols <= 1) return null; // a single value isn't a table
  return cleaned.map((r) => Array.from({ length: cols }, (_, c) => r[c] ?? ''));
}

/** Tab-separated values — the plain-text clipboard flavour of a cell range. */
export function parseTsv(text: string): string[][] | null {
  if (!text) return null;
  const body = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  if (!body) return null;
  const rows = body.split('\n').map((line) => line.split('\t'));
  // Guard against plain prose: only tabular if there's a tab or multiple lines.
  if (rows.length <= 1 && rows[0].length <= 1) return null;
  return normalizeGrid(rows);
}

/** The first <table> in an HTML clipboard fragment. Cell text is whitespace-
 *  collapsed. Needs a DOM (browser); returns null where DOMParser is absent. */
export function parseHtmlTable(html: string): string[][] | null {
  if (!html || typeof DOMParser === 'undefined') return null;
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return null;
  }
  const table = doc.querySelector('table');
  if (!table) return null;
  const rows: string[][] = [];
  for (const tr of Array.from(table.querySelectorAll('tr'))) {
    const cells = Array.from(tr.querySelectorAll('td, th'));
    if (!cells.length) continue;
    rows.push(cells.map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim()));
  }
  return normalizeGrid(rows);
}

export interface ClipboardText {
  html: string;
  text: string;
}

/** Best grid from a clipboard: prefer the HTML table, fall back to TSV. */
export function clipboardToGrid({ html, text }: ClipboardText): string[][] | null {
  return parseHtmlTable(html) ?? parseTsv(text);
}
