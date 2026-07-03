# Formula System

The formula system gives `@weavertime/spindle-sheets-core` spreadsheet calculation:
a parser, a library of **146 built-in functions**, a dependency graph with
**topological recalculation**, **dynamic arrays (spill)**, and the metadata
that powers **formula autocomplete**. Everything lives under
`packages/sheets-core/src/formula-parser/` (plus `formula-graph.ts` and
`spill.ts` alongside `workbook.ts`).

## Function library

Functions are organised by category, one module per category under
`formula-parser/functions/`:

| Module | Category | Count |
|---|---|---|
| `math.ts` | math & aggregation | 37 |
| `logical.ts` | logical | 11 |
| `text.ts` | text | 21 |
| `lookup.ts` | lookup & reference | 12 |
| `stats.ts` | statistical | 13 |
| `date.ts` | date & time | 19 |
| `information.ts` | information | 11 |
| `financial.ts` | financial | 9 |
| `reference.ts` | reference-aware | 7 |
| `array.ts` | dynamic arrays | 6 |

`functions/index.ts` is the registry. It exposes three maps, by how the
evaluator must call the function:

- **`eagerFunctions`** — arguments are fully evaluated before the function
  runs. The default; most functions are eager.
- **`lazyFunctions`** — the function receives argument *thunks* so it can
  short-circuit and catch errors from a branch it does not take
  (`IF`, `IFS`, `SWITCH`, `IFERROR`, `IFNA`, the `IS*` predicates).
- **`refFunctions`** — the function receives the argument's *AST* rather than
  its value, because it needs the reference itself (`ROW`, `COLUMN`,
  `OFFSET`, `INDIRECT`, `ISREF`, `ISFORMULA`, `CELL`).

`volatileFunctions` is the set of functions whose result can change with no
input change (`RAND`, `RANDBETWEEN`, `NOW`, `TODAY`, `OFFSET`, `INDIRECT`).

### Function-metadata catalog

`functions/catalog.ts` holds a `FunctionDoc` for every function — its
signature, argument names (with optional/variadic flags), category and a
one-line description:

```typescript
interface FunctionDoc {
  name: string;
  category: FunctionCategory;
  args: { name: string; optional?: boolean; variadic?: boolean }[];
  description: string;
}
```

A test enforces two-way completeness: every registered function has a
catalog entry and vice-versa. The catalog is exported from the package's
public API and drives formula autocomplete in the React editors.

## Parser

`FormulaParser` (`parser.ts`) turns a formula string into a
`ParsedFormulaNode` AST and collects the cells it depends on. The workbook
then converts that numeric AST into a **stable AST** (`stable-ast.ts`) in
which every reference is a `(rowId, colId)` stable-ID pair instead of a
numeric coordinate. Because inserts, deletes and sorts only renumber the
sheet's order maps, stable-ID references keep pointing at the same logical
cells; the displayed `A1` text is regenerated from the AST on each evaluation.

Evaluation walks the AST and dispatches each function call down one of the
three paths above (reference → lazy → eager).

## Dependency graph and recalculation

`FormulaGraphImpl` (`formula-graph.ts`) tracks which formulas depend on
which cells:

- **`cellDependents`** — a reverse index from *any* referenced cell key
  (a value cell or a formula cell) to the formulas that read it. Because it
  covers value cells too, changing a plain value correctly recalculates the
  formulas above it.
- **Range dependencies** are stored as **rectangles** of two stable corner
  keys, not expanded cell-by-cell. Containment is tested at recalc time, so
  a cell that is empty when the formula is entered — or a row/column
  inserted into the range later — is still tracked.

On a change, `collectDirty` walks the transitive dependents (plus every
volatile cell) and records the dependency edges among them.
`topologicalOrder` (Kahn's algorithm) then orders that set so each cell is
recomputed **exactly once**, dependencies before dependents; any cell in, or
downstream of, a cycle is reported as `#CIRCULAR!`.

## Dynamic arrays (spill)

A formula that returns a 2D array — `SEQUENCE`, `FILTER`, `SORT`, `SORTBY`,
`UNIQUE`, `SPLIT` — **spills** into a rectangular block of cells. The anchor
cell holds the formula and the array's top-left value; the rest of the array
is a **derived overlay** held in a per-sheet `SpillIndex` (`spill.ts`). The
overlay is never written to `sheet.cells` and never synced over the
collaboration CRDT — each client recomputes it from the anchor formula. A
target cell that already holds content yields `#SPILL!`.

Recalculation runs to a fixed point: when a recomputed formula spills (or
stops spilling), its footprint cells are fed back as recalc seeds, so a
formula that reads a spilled cell stays in sync.

## Autocomplete and parameter help

`analyzeFormula` (`formula-context.ts`) is a lightweight backward scanner —
not the full parser — that inspects the in-progress formula text and the
caret position to report the partial function-name token and/or the
enclosing function call and argument index. Combined with the catalog, it
drives the autocomplete dropdown and the signature tooltip in the React
in-cell editor and formula bar.

## Reference adjustment

When formulas are copied or filled, `formula-adjust.ts` rewrites their
references — relative references shift with the copy offset, absolute
(`$`-marked) references stay put, mixed references shift only their relative
part. Structural edits (insert/delete/sort) need no formula rewriting: the
stable AST already references cells by ID.
