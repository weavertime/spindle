// Logical functions.
//
// Most are eager, but IF / IFS / SWITCH / IFERROR / IFNA must only evaluate
// the branches they actually need, so they are registered as lazy functions
// and receive argument thunks instead of values.

import type { EagerFn, LazyFn } from './helpers';
import { flatten, toBoolean, isErrorValue, looseEquals } from './helpers';

/** The boolean/numeric values among the args — text and blanks are ignored. */
function logicalValues(args: unknown[]): boolean[] {
  return flatten(args)
    .filter((v) => typeof v === 'boolean' || typeof v === 'number')
    .map((v) => (typeof v === 'number' ? v !== 0 : (v as boolean)));
}

export const logicalEagerFunctions: Record<string, EagerFn> = {
  AND: (args) => {
    const values = logicalValues(args);
    if (values.length === 0) throw new Error('#VALUE!');
    return values.every(Boolean);
  },

  OR: (args) => {
    const values = logicalValues(args);
    if (values.length === 0) throw new Error('#VALUE!');
    return values.some(Boolean);
  },

  XOR: (args) => {
    const values = logicalValues(args);
    if (values.length === 0) throw new Error('#VALUE!');
    return values.filter(Boolean).length % 2 === 1;
  },

  NOT: (args) => !toBoolean(args[0]),

  TRUE: () => true,

  FALSE: () => false,
};

export const logicalLazyFunctions: Record<string, LazyFn> = {
  IF: (thunks) => {
    if (thunks.length < 2) throw new Error('#VALUE!');
    if (toBoolean(thunks[0]())) return thunks[1]();
    return thunks.length > 2 ? thunks[2]() : false;
  },

  IFERROR: (thunks) => {
    if (thunks.length < 2) throw new Error('#VALUE!');
    try {
      const value = thunks[0]();
      return isErrorValue(value) ? thunks[1]() : value;
    } catch {
      return thunks[1]();
    }
  },

  IFNA: (thunks) => {
    if (thunks.length < 2) throw new Error('#VALUE!');
    try {
      const value = thunks[0]();
      return value === '#N/A' ? thunks[1]() : value;
    } catch (e) {
      if (e instanceof Error && e.message === '#N/A') return thunks[1]();
      throw e;
    }
  },

  IFS: (thunks) => {
    for (let i = 0; i + 1 < thunks.length; i += 2) {
      if (toBoolean(thunks[i]())) return thunks[i + 1]();
    }
    throw new Error('#N/A');
  },

  SWITCH: (thunks) => {
    if (thunks.length < 3) throw new Error('#VALUE!');
    const target = thunks[0]();
    let i = 1;
    for (; i + 1 < thunks.length; i += 2) {
      if (looseEquals(target, thunks[i]())) return thunks[i + 1]();
    }
    // A trailing odd argument is the default result.
    if (i < thunks.length) return thunks[i]();
    throw new Error('#N/A');
  },
};
