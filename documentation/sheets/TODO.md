# Pagent-Sheets — Pending Items

Tracks the gaps between the current spreadsheet implementation and the
feature set users expect from Excel / Google Sheets. The two large areas
are **formula coverage** and **feature parity**.

> This supersedes the previous architecture-alignment TODO. The items it
> listed — collaboration, freeze-pane API, CSV export — have all shipped.

## Formula engine

The engine currently implements **6** functions: `SUM`, `AVERAGE`,
`COUNT`, `IF`, `MAX`, `MIN`. Excel and Google Sheets expose 400+. Building
out the standard library is the single biggest gap.

Functions are registered in
`packages/sheets-core/src/formula-parser/parser.ts` via
`this.functions.set(name, fn)`.

### Standard function library

- [ ] **Math & aggregation** — `SUMIF`, `SUMIFS`, `COUNTIF`, `COUNTIFS`,
      `COUNTA`, `COUNTBLANK`, `AVERAGEIF`, `AVERAGEIFS`, `ROUND`,
      `ROUNDUP`, `ROUNDDOWN`, `MROUND`, `INT`, `TRUNC`, `ABS`, `MOD`,
      `POWER`, `SQRT`, `EXP`, `LN`, `LOG`, `LOG10`, `SIGN`, `CEILING`,
      `FLOOR`, `GCD`, `LCM`, `PRODUCT`, `SUMPRODUCT`, `SUBTOTAL`,
      `AGGREGATE`, `RAND`, `RANDBETWEEN`
- [ ] **Logical** — `AND`, `OR`, `NOT`, `XOR`, `IFERROR`, `IFNA`, `IFS`,
      `SWITCH`, `TRUE`, `FALSE`
- [ ] **Lookup & reference** — `VLOOKUP`, `HLOOKUP`, `XLOOKUP`, `INDEX`,
      `MATCH`, `XMATCH`, `LOOKUP`, `OFFSET`, `INDIRECT`, `CHOOSE`, `ROW`,
      `ROWS`, `COLUMN`, `COLUMNS`, `ADDRESS`, `HYPERLINK`
- [ ] **Text** — `CONCAT`, `CONCATENATE`, `TEXTJOIN`, `LEFT`, `RIGHT`,
      `MID`, `LEN`, `FIND`, `SEARCH`, `SUBSTITUTE`, `REPLACE`, `UPPER`,
      `LOWER`, `PROPER`, `TRIM`, `TEXT`, `VALUE`, `REPT`, `CHAR`, `CODE`,
      `EXACT`, `SPLIT`
- [ ] **Date & time** — `TODAY`, `NOW`, `DATE`, `TIME`, `YEAR`, `MONTH`,
      `DAY`, `HOUR`, `MINUTE`, `SECOND`, `WEEKDAY`, `WEEKNUM`, `EOMONTH`,
      `EDATE`, `DATEDIF`, `NETWORKDAYS`, `WORKDAY`, `DATEVALUE`,
      `TIMEVALUE`
- [ ] **Statistical** — `MEDIAN`, `MODE`, `STDEV`, `STDEVP`, `VAR`,
      `VARP`, `PERCENTILE`, `QUARTILE`, `RANK`, `LARGE`, `SMALL`,
      `CORREL`, `COVAR`
- [ ] **Financial** — `PMT`, `FV`, `PV`, `NPV`, `IRR`, `RATE`, `NPER`,
      `IPMT`, `PPMT`
- [ ] **Information** — `ISBLANK`, `ISERROR`, `ISERR`, `ISNA`,
      `ISNUMBER`, `ISTEXT`, `ISLOGICAL`, `ISREF`, `ISFORMULA`, `NA`,
      `TYPE`, `CELL`, `ERROR.TYPE`, `N`

### Engine-level

- [ ] Standard error values — `#DIV/0!`, `#REF!`, `#VALUE!`, `#NAME?`,
      `#N/A`, `#NUM!`, `#NULL!` — produced and propagated correctly
- [ ] Cross-sheet references (`Sheet2!A1`) and 3D ranges — verify
      end-to-end
- [ ] Dynamic arrays / spill ranges — `FILTER`, `SORT`, `SORTBY`,
      `UNIQUE`, `SEQUENCE`, `ARRAYFORMULA`
- [ ] Verify operator coverage — `&` (concat), `^`, `%`, comparisons

## Feature parity

Gaps against Excel / Google Sheets in the non-formula feature set.

### Wired but not implemented

- [ ] **Merge cells** — toolbar button exists; the `onMergeCells`
      handler in `WorkbookCanvas.tsx` is a no-op
- [ ] **Text rotation** — toolbar button exists; the handler is a no-op
- [ ] **Autofill / fill handle** — the selection renderer draws hooks,
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

For reference, these are done: real-time collaboration, comments and
comment threads, freeze panes, single-column sort, per-column filters,
cell styles (fonts, colors, borders, alignment, wrap), number formats,
hyperlinks, hide/show and insert/delete rows and columns, multiple
sheets, undo/redo, and CSV export.
