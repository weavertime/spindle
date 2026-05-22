# Pagent-Sheets — Pending Items

Tracks the gaps between the current spreadsheet implementation and the
feature set users expect from Excel / Google Sheets. **Formula coverage is
now essentially complete** — the remaining work is **feature parity** in the
non-formula feature set.

## Formula engine — done

The engine ships **146 functions** across math, logical, text, lookup,
statistical, date/time, information, financial, reference and array
categories. Functions and their metadata live in
`packages/sheets-core/src/formula-parser/functions/`.

- [x] **Standard function library** — all categories above
- [x] **Excel-grade recalculation** — topological dirty-propagation (each
      cell computed once per pass), volatile functions, and complete
      range-rectangle dependency tracking
- [x] **Dynamic arrays / spill** — `SEQUENCE`, `UNIQUE`, `SORT`, `SORTBY`,
      `FILTER`, `SPLIT`; a spilling formula fills a block of cells, with
      `#SPILL!` on a blocked target
- [x] **Formula autocomplete + parameter help** while editing a formula

### Remaining formula items

- [ ] **`AGGREGATE`** — 19 sub-functions plus the ignore-hidden /
      ignore-errors option matrix
- [ ] **`ARRAYFORMULA`** — full elementwise scalar broadcast (only a
      minimal pass-through exists)
- [ ] **`#SPILL!` auto-recovery** — a blocked anchor does not re-spill when
      the blocking cell is cleared; the formula must be re-entered

## Feature parity

Gaps against Excel / Google Sheets in the non-formula feature set.

### Wired but not implemented

- [ ] **Merge cells** — toolbar button exists; the `onMergeCells` handler
      in `WorkbookCanvas.tsx` is a no-op
- [ ] **Text rotation** — toolbar button exists; the handler is a no-op
- [ ] **Autofill / fill handle** — the selection renderer draws the handle,
      but drag-to-fill and series fill are not functional

### Not present

- [ ] **Conditional formatting** — value- and formula-driven cell styling
- [ ] **Data validation** — dropdown lists, input restrictions
- [ ] **Named ranges** — and their use in formulas
- [ ] **Find & replace**
- [ ] **Charts** — bar / line / pie, etc.
- [ ] **Pivot tables**
- [ ] **Cell & sheet protection** — locked cells, protected ranges
- [ ] **Multi-column sort UI** — the engine accepts a sort-key array;
      only single-column sort is exposed
- [ ] **Import** — a CSV import API, and XLSX import/export (only CSV
      *export* exists today)
- [ ] **Print / page setup** for sheets (PDF output)
- [ ] **Row / column grouping & outline**
- [ ] **Sparklines**
- [ ] **Paste special** — values-only, formats-only, transpose

## Already shipped

Real-time collaboration, comments and comment threads, freeze panes,
single-column sort, per-column filters, cell styles (fonts, colors,
borders, alignment, wrap), number formats, hyperlinks, hide/show and
insert/delete rows and columns, multiple sheets, undo/redo, CSV export,
the 146-function formula engine with dynamic arrays, and formula
autocomplete with parameter help.
