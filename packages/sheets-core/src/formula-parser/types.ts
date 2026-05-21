// Formula parser types

export interface CellReference {
  row: number;
  col: number;
  rowAbsolute: boolean;
  colAbsolute: boolean;
  sheetName?: string; // Optional sheet name for cross-sheet references
}

export interface RangeReference {
  start: CellReference;
  end: CellReference;
}

export interface ParsedFormulaNode {
  type: 'number' | 'string' | 'cell' | 'range' | 'function' | 'operator' | 'variable';
  value?: unknown;
  cellRef?: CellReference;
  rangeRef?: RangeReference;
  functionName?: string;
  args?: ParsedFormulaNode[];
  operator?: string;
  left?: ParsedFormulaNode;
  right?: ParsedFormulaNode;
}

export interface ParseResult {
  ast: ParsedFormulaNode;
  dependencies: Set<string>; // cellKeys
  error?: string;
}

export interface EvaluationContext {
  getCellValue: (row: number, col: number, sheetId?: string, sheetName?: string) => unknown;
  getRangeValues: (range: RangeReference, sheetId?: string, sheetName?: string) => unknown[][];
  getSheetIdByName?: (sheetName: string) => string | undefined; // Helper to resolve sheet name to sheet ID
  isCellFormula?: (row: number, col: number, sheetName?: string) => boolean; // Whether a cell holds a formula (for ISFORMULA)
}

