// Lightweight analysis of an in-progress formula, for autocomplete and
// parameter help. This is NOT the real parser — the text is incomplete while
// the user is typing — it is a backward scanner around the caret.

/** A partial identifier the caret sits in — a candidate function name. */
export interface FormulaToken {
  text: string;
  start: number;
  end: number;
}

/** The function call whose argument list the caret is inside. */
export interface FormulaCall {
  name: string; // UPPERCASE
  argIndex: number; // 0-based
  openParen: number;
}

/**
 * What the caret is doing. `token` and `call` are independent: the caret can be
 * typing an identifier (`token`) while also being inside a call's arguments
 * (`call`). The consumer decides — a `token` matching function names drives
 * autocomplete, otherwise the `call` drives signature help.
 */
export interface FormulaContext {
  token?: FormulaToken;
  call?: FormulaCall;
}

const IDENT_CHAR = /[A-Za-z0-9_.]/;
const IDENT_START = /[A-Za-z]/;

/** Mark every index of `s` that lies inside a double-quoted string. */
function computeStringMask(s: string): boolean[] {
  const mask = new Array<boolean>(s.length).fill(false);
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"') {
      mask[i] = true;
      inString = !inString;
    } else if (inString) {
      mask[i] = true;
    }
  }
  return mask;
}

export function analyzeFormula(text: string, caret: number): FormulaContext {
  const pos = Math.max(0, Math.min(caret, text.length));
  const prefix = text.slice(0, pos);
  const inString = computeStringMask(prefix);
  const result: FormulaContext = {};

  // --- The identifier the caret sits in (extend left and right) ---
  let tokenStart = pos;
  while (
    tokenStart > 0 &&
    IDENT_CHAR.test(text[tokenStart - 1]) &&
    !inString[tokenStart - 1]
  ) {
    tokenStart--;
  }
  let tokenEnd = pos;
  while (tokenEnd < text.length && IDENT_CHAR.test(text[tokenEnd])) {
    tokenEnd++;
  }
  // A token only counts if it starts with a letter and is not already a
  // completed call (immediately followed by `(`).
  if (
    tokenStart < tokenEnd &&
    IDENT_START.test(text[tokenStart]) &&
    text[tokenEnd] !== '('
  ) {
    result.token = { text: text.slice(tokenStart, tokenEnd), start: tokenStart, end: tokenEnd };
  }

  // --- The innermost unclosed `(` before the caret ---
  let depth = 0;
  let openParen = -1;
  for (let i = pos - 1; i >= 0; i--) {
    if (inString[i]) continue;
    const ch = prefix[i];
    if (ch === ')') depth++;
    else if (ch === '(') {
      if (depth > 0) depth--;
      else {
        openParen = i;
        break;
      }
    }
  }

  if (openParen >= 0) {
    // The function name is the identifier just left of the `(`.
    let j = openParen - 1;
    while (j >= 0 && /\s/.test(prefix[j])) j--;
    const nameEnd = j + 1;
    while (j >= 0 && IDENT_CHAR.test(prefix[j]) && !inString[j]) j--;
    const name = prefix.slice(j + 1, nameEnd);

    if (name.length > 0 && IDENT_START.test(name[0])) {
      // Count top-level commas between the `(` and the caret.
      let argIndex = 0;
      let argDepth = 0;
      for (let i = openParen + 1; i < pos; i++) {
        if (inString[i]) continue;
        const ch = prefix[i];
        if (ch === '(') argDepth++;
        else if (ch === ')') {
          if (argDepth > 0) argDepth--;
        } else if (ch === ',' && argDepth === 0) {
          argIndex++;
        }
      }
      result.call = { name: name.toUpperCase(), argIndex, openParen };
    }
  }

  return result;
}
