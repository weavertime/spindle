// Formula parser - simplified but functional

import type { ParsedFormulaNode, ParseResult, EvaluationContext, RangeReference } from './types';
import { parseCellReference, parseRangeReference, cellReferenceToKey } from './cell-reference';
import { eagerFunctions, lazyFunctions, refFunctions } from './functions';
import type { EagerFn, LazyFn, RefFn } from './functions';

export class FormulaParser {
  private functions: Map<string, EagerFn> = new Map();
  private lazyFunctions: Map<string, LazyFn> = new Map();
  private refFunctions: Map<string, RefFn> = new Map();

  constructor() {
    this.registerBuiltInFunctions();
  }

  private registerBuiltInFunctions(): void {
    for (const [name, fn] of Object.entries(eagerFunctions)) {
      this.functions.set(name, fn);
    }
    for (const [name, fn] of Object.entries(lazyFunctions)) {
      this.lazyFunctions.set(name, fn);
    }
    for (const [name, fn] of Object.entries(refFunctions)) {
      this.refFunctions.set(name, fn);
    }
  }

  parse(formula: string, currentRow: number = 0, currentCol: number = 0): ParseResult {
    const dependencies = new Set<string>();
    let error: string | undefined;

    try {
      // Remove leading = if present
      const expression = formula.startsWith('=') ? formula.slice(1) : formula;

      // Simple parser - handles basic cases
      const ast = this.parseExpression(expression, currentRow, currentCol, dependencies);

      return { ast, dependencies, error };
    } catch (e) {
      error = e instanceof Error ? e.message : '#ERROR!';
      return {
        ast: { type: 'string', value: '' },
        dependencies,
        error,
      };
    }
  }

  private parseExpression(
    expr: string,
    currentRow: number,
    currentCol: number,
    dependencies: Set<string>
  ): ParsedFormulaNode {
    expr = expr.trim();

    // Try to parse as arithmetic/comparison expression
    const operatorMatch = this.findLowestPrecedenceOperator(expr);
    if (operatorMatch) {
      const { operator, index } = operatorMatch;
      const leftExpr = expr.substring(0, index).trim();
      const rightExpr = expr.substring(index + operator.length).trim();
      
      return {
        type: 'operator',
        operator,
        left: this.parseExpression(leftExpr, currentRow, currentCol, dependencies),
        right: this.parseExpression(rightExpr, currentRow, currentCol, dependencies),
      };
    }

    // Try to parse as cell reference
    const cellRef = parseCellReference(expr);
    if (cellRef) {
      // For relative references, convert absolute position to offset
      if (!cellRef.rowAbsolute || !cellRef.colAbsolute) {
        // Calculate offset from current cell
        const rowOffset = cellRef.row - currentRow;
        const colOffset = cellRef.col - currentCol;
        // Store as offset for relative references
        const adjustedRef = {
          row: cellRef.rowAbsolute ? cellRef.row : rowOffset,
          col: cellRef.colAbsolute ? cellRef.col : colOffset,
          rowAbsolute: cellRef.rowAbsolute,
          colAbsolute: cellRef.colAbsolute,
          sheetName: cellRef.sheetName, // Preserve sheet name
        };
        const key = cellReferenceToKey(adjustedRef, currentRow, currentCol);
        // For cross-sheet references, include sheet name in dependency key
        const depKey = cellRef.sheetName ? `${cellRef.sheetName}!${key}` : key;
        dependencies.add(depKey);
        return { type: 'cell', cellRef: adjustedRef };
      }
      // Absolute reference - use as-is
      const key = cellReferenceToKey(cellRef, currentRow, currentCol);
      // For cross-sheet references, include sheet name in dependency key
      const depKey = cellRef.sheetName ? `${cellRef.sheetName}!${key}` : key;
      dependencies.add(depKey);
      return { type: 'cell', cellRef };
    }

    // Try to parse as range
    const rangeRef = parseRangeReference(expr);
    if (rangeRef) {
      // Add all cells in range to dependencies
      const { start, end } = rangeRef;
      
      // For relative references, convert absolute position to offset (like we do for single cells)
      // parseCellReference returns absolute positions, so we need to calculate the offset
      const startRowOffset = start.rowAbsolute ? 0 : start.row - currentRow;
      const startColOffset = start.colAbsolute ? 0 : start.col - currentCol;
      const endRowOffset = end.rowAbsolute ? 0 : end.row - currentRow;
      const endColOffset = end.colAbsolute ? 0 : end.col - currentCol;
      
      // Create adjusted range reference with offsets for relative refs
      const sheetName = start.sheetName || end.sheetName; // Get sheet name from either start or end
      const adjustedRangeRef: RangeReference = {
        start: {
          row: start.rowAbsolute ? start.row : startRowOffset,
          col: start.colAbsolute ? start.col : startColOffset,
          rowAbsolute: start.rowAbsolute,
          colAbsolute: start.colAbsolute,
          sheetName: sheetName, // Preserve sheet name
        },
        end: {
          row: end.rowAbsolute ? end.row : endRowOffset,
          col: end.colAbsolute ? end.col : endColOffset,
          rowAbsolute: end.rowAbsolute,
          colAbsolute: end.colAbsolute,
          sheetName: sheetName, // Preserve sheet name
        },
      };
      
      // Calculate absolute positions for dependency tracking
      const startRow = adjustedRangeRef.start.rowAbsolute 
        ? adjustedRangeRef.start.row 
        : currentRow + adjustedRangeRef.start.row;
      const endRow = adjustedRangeRef.end.rowAbsolute 
        ? adjustedRangeRef.end.row 
        : currentRow + adjustedRangeRef.end.row;
      const startCol = adjustedRangeRef.start.colAbsolute 
        ? adjustedRangeRef.start.col 
        : currentCol + adjustedRangeRef.start.col;
      const endCol = adjustedRangeRef.end.colAbsolute 
        ? adjustedRangeRef.end.col 
        : currentCol + adjustedRangeRef.end.col;

      // Add dependencies with sheet name prefix if it's a cross-sheet reference
      const sheetPrefix = sheetName ? `${sheetName}!` : '';
      for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
        for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
          dependencies.add(`${sheetPrefix}${r}:${c}`);
        }
      }

      return { type: 'range', rangeRef: adjustedRangeRef };
    }

    // Try to parse as function call (e.g., SUM(A1:A10) or ERROR.TYPE(A1))
    const functionMatch = expr.match(/^([A-Z][A-Z.]*)\s*\((.*)\)$/);
    if (functionMatch) {
      const [, funcName, argsStr] = functionMatch;
      const args = this.parseArguments(argsStr, currentRow, currentCol, dependencies);
      return {
        type: 'function',
        functionName: funcName.toUpperCase(),
        args,
      };
    }

    // Try to parse as number
    const num = Number(expr);
    if (!isNaN(num) && expr.trim() !== '') {
      return { type: 'number', value: num };
    }

    // Try to parse as string (quoted)
    if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
      return { type: 'string', value: expr.slice(1, -1) };
    }

    // Default to string
    return { type: 'string', value: expr };
  }

  /**
   * Find the operator with lowest precedence (to parse correctly)
   * Returns the rightmost operator of lowest precedence to handle left-associativity
   */
  private findLowestPrecedenceOperator(expr: string): { operator: string; index: number } | null {
    let depth = 0;
    let lowestPrecOp: { operator: string; index: number } | null = null;
    let lowestPrec = Infinity;

    // Operator precedence (lower number = lower precedence, evaluated later):
    // Comparison operators (precedence 0) < +, - (precedence 1) < *, / (precedence 2)
    const operators = [
      { op: '>=', prec: 0 },
      { op: '<=', prec: 0 },
      { op: '<>', prec: 0 },
      { op: '>', prec: 0 },
      { op: '<', prec: 0 },
      { op: '=', prec: 0 },
      { op: '+', prec: 1 },
      { op: '-', prec: 1 },
      { op: '*', prec: 2 },
      { op: '/', prec: 2 },
    ];

    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];
      
      // Track parentheses depth
      if (char === '(') depth++;
      else if (char === ')') depth--;
      // Skip if inside parentheses or quotes
      else if (depth > 0) continue;
      else if (char === '"' || char === "'") {
        // Skip quoted strings
        const quote = char;
        i++;
        while (i < expr.length && expr[i] !== quote) {
          if (expr[i] === '\\') i++; // Skip escaped characters
          i++;
        }
        continue;
      }
      // Check for operators (but not at start, and not part of a number or cell reference)
      else {
        for (const { op, prec } of operators) {
          // Check for multi-character operators first
          if (op.length === 2 && i < expr.length - 1) {
            const twoChars = expr.substring(i, i + 2);
            if (twoChars === op) {
              if (prec < lowestPrec || (prec === lowestPrec && i > (lowestPrecOp?.index ?? -1))) {
                lowestPrec = prec;
                lowestPrecOp = { operator: op, index: i };
              }
              continue;
            }
          }
          
          // Single character operators
          if (op.length === 1 && char === op) {
            // Make sure it's not part of a number (e.g., -5 or 1e-5)
            const prevChar = i > 0 ? expr[i - 1] : '';
            const isPartOfNumber = 
              (op === '-' && (prevChar === 'e' || prevChar === 'E')) ||
              (op === '+' && (prevChar === 'e' || prevChar === 'E'));
            
            // Make sure single < or > isn't part of a two-char operator
            const nextChar = i < expr.length - 1 ? expr[i + 1] : '';
            const isTwoCharOp = 
              (op === '<' && (nextChar === '>' || nextChar === '=')) ||
              (op === '>' && nextChar === '=');
            
            if (!isPartOfNumber && !isTwoCharOp && (prec < lowestPrec || (prec === lowestPrec && i > (lowestPrecOp?.index ?? -1)))) {
              lowestPrec = prec;
              lowestPrecOp = { operator: op, index: i };
            }
          }
        }
      }
    }

    return lowestPrecOp;
  }

  private parseArguments(
    argsStr: string,
    currentRow: number,
    currentCol: number,
    dependencies: Set<string>
  ): ParsedFormulaNode[] {
    if (!argsStr.trim()) return [];

    const args: ParsedFormulaNode[] = [];
    let depth = 0;
    let current = '';

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];
      // Copy quoted strings through verbatim so a comma inside a string
      // literal (e.g. a TEXTJOIN delimiter) is not treated as a separator.
      if (char === '"' || char === "'") {
        const quote = char;
        current += char;
        i++;
        while (i < argsStr.length && argsStr[i] !== quote) {
          current += argsStr[i];
          i++;
        }
        if (i < argsStr.length) current += argsStr[i];
        continue;
      }
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && depth === 0) {
        if (current.trim()) {
          args.push(this.parseExpression(current.trim(), currentRow, currentCol, dependencies));
        }
        current = '';
        continue;
      }
      current += char;
    }

    if (current.trim()) {
      args.push(this.parseExpression(current.trim(), currentRow, currentCol, dependencies));
    }

    return args;
  }

  evaluate(ast: ParsedFormulaNode, ctx: EvaluationContext, currentRow: number = 0, currentCol: number = 0): unknown {
    return this.evaluateNode(ast, ctx, currentRow, currentCol);
  }

  private evaluateNode(
    node: ParsedFormulaNode,
    ctx: EvaluationContext,
    currentRow: number = 0,
    currentCol: number = 0
  ): unknown {
    switch (node.type) {
      case 'number':
        return node.value;
      case 'string':
        return node.value;
      case 'cell':
        if (node.cellRef) {
          const ref = node.cellRef;
          const row = ref.rowAbsolute ? ref.row : currentRow + ref.row;
          const col = ref.colAbsolute ? ref.col : currentCol + ref.col;
          // Use sheet name if provided, otherwise use sheetId from context
          return ctx.getCellValue(row, col, undefined, ref.sheetName);
        }
        return null;
      case 'range':
        if (node.rangeRef) {
          const sheetName = node.rangeRef.start.sheetName || node.rangeRef.end.sheetName;
          return ctx.getRangeValues(node.rangeRef, undefined, sheetName);
        }
        return null;
      case 'operator':
        if (node.operator && node.left && node.right) {
          const leftVal = this.evaluateNode(node.left, ctx, currentRow, currentCol);
          const rightVal = this.evaluateNode(node.right, ctx, currentRow, currentCol);
          
          // Comparison operators work with any types
          switch (node.operator) {
            case '>':
              return Number(leftVal) > Number(rightVal);
            case '<':
              return Number(leftVal) < Number(rightVal);
            case '>=':
              return Number(leftVal) >= Number(rightVal);
            case '<=':
              return Number(leftVal) <= Number(rightVal);
            case '=':
              // Excel-style equality: compare values directly
              return leftVal === rightVal || Number(leftVal) === Number(rightVal);
            case '<>':
              return leftVal !== rightVal && Number(leftVal) !== Number(rightVal);
          }
          
          // Arithmetic operators require numbers
          const leftNum = Number(leftVal);
          const rightNum = Number(rightVal);
          
          if (isNaN(leftNum) || isNaN(rightNum)) {
            throw new Error('#VALUE!');
          }
          
          switch (node.operator) {
            case '+':
              return leftNum + rightNum;
            case '-':
              return leftNum - rightNum;
            case '*':
              return leftNum * rightNum;
            case '/':
              if (rightNum === 0) {
                throw new Error('#DIV/0!');
              }
              return leftNum / rightNum;
            default:
              throw new Error(`#ERROR! Unknown operator: ${node.operator}`);
          }
        }
        return null;
      case 'function':
        if (node.functionName && node.args) {
          // Reference functions (ROW, OFFSET, INDIRECT, …) need the raw
          // argument AST so they can read an argument's reference.
          const refFunc = this.refFunctions.get(node.functionName);
          if (refFunc) {
            return refFunc({
              args: node.args,
              ctx,
              currentRow,
              currentCol,
              evaluate: (n) => this.evaluateNode(n, ctx, currentRow, currentCol),
            });
          }
          // Lazy functions (IF, IFERROR, IFS, …) receive thunks so they can
          // short-circuit and catch errors thrown while evaluating a branch.
          const lazyFunc = this.lazyFunctions.get(node.functionName);
          if (lazyFunc) {
            const thunks = node.args.map(
              (arg) => () => this.evaluateNode(arg, ctx, currentRow, currentCol)
            );
            return lazyFunc(thunks, ctx);
          }
          const func = this.functions.get(node.functionName);
          if (!func) {
            throw new Error(`#NAME? Function ${node.functionName} not found`);
          }
          const evaluatedArgs = node.args.map((arg) => this.evaluateNode(arg, ctx, currentRow, currentCol));
          return func(evaluatedArgs, ctx);
        }
        return null;
      default:
        return null;
    }
  }
}

