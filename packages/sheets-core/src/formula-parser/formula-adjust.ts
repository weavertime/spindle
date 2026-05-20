// Adjust a formula's relative references for drag-fill / copy-paste.
//
// Replaces the old regex-based string rewriter. The new path:
//   formula text → parser → numeric AST → stable AST (against source pos)
//                → rebase relative refs by source→target offset → render
//
// Because the rebasing walks a stable AST, relative refs follow cells
// through arbitrary row/column reorderings — the regex version implicitly
// assumed numeric A1 coords always matched current visual indices.

import type { WorkbookImpl } from '../workbook';
import { FormulaParser } from './parser';
import {
  adjustStableAstForCopy,
  renderStableAst,
  toStableAst,
  type SheetResolver,
} from './stable-ast';

const parser = new FormulaParser();

/**
 * Rebase a formula string when filling/copying from a source cell to a target
 * cell on the same sheet. Absolute refs ($A$1) stay; relative refs shift by
 * (target - source).
 */
export function adjustFormula(
  formula: string,
  workbook: WorkbookImpl,
  sheetId: string | undefined,
  sourceRow: number,
  sourceCol: number,
  targetRow: number,
  targetCol: number,
): string {
  if (!formula.startsWith('=')) return formula;
  if (sourceRow === targetRow && sourceCol === targetCol) return formula;

  const sheet = workbook.getSheet(sheetId);

  const parsed = parser.parse(formula, sourceRow, sourceCol);
  if (parsed.error) return formula;

  const resolver: SheetResolver = {
    getSheet: (name?: string) => {
      if (!name) return undefined;
      const id = workbook.getSheetIdByName(name);
      return id ? workbook.getSheet(id) : undefined;
    },
  };

  const stable = toStableAst(parsed.ast, resolver, sheet, sourceRow, sourceCol);
  const rebased = adjustStableAstForCopy(
    stable,
    resolver,
    sheet,
    sourceRow,
    sourceCol,
    targetRow,
    targetCol,
  );
  return renderStableAst(rebased, resolver, sheet);
}
