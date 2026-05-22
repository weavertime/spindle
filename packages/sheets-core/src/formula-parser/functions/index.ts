// Built-in formula function registry.

import type { EagerFn, LazyFn, RefFn } from './helpers';
import { mathFunctions } from './math';
import { logicalEagerFunctions, logicalLazyFunctions } from './logical';
import { textFunctions } from './text';
import { lookupFunctions } from './lookup';
import { statsFunctions } from './stats';
import { dateFunctions } from './date';
import { informationEagerFunctions, informationLazyFunctions } from './information';
import { financialFunctions } from './financial';
import { referenceFunctions } from './reference';
import { arrayFunctions } from './array';

export type { EagerFn, LazyFn, RefFn } from './helpers';

/** Functions whose arguments are fully evaluated before the function runs. */
export const eagerFunctions: Record<string, EagerFn> = {
  ...mathFunctions,
  ...logicalEagerFunctions,
  ...textFunctions,
  ...lookupFunctions,
  ...statsFunctions,
  ...dateFunctions,
  ...informationEagerFunctions,
  ...financialFunctions,
  ...arrayFunctions,
};

/** Functions that receive argument thunks so they can short-circuit. */
export const lazyFunctions: Record<string, LazyFn> = {
  ...logicalLazyFunctions,
  ...informationLazyFunctions,
};

/** Functions that work with an argument's reference rather than its value. */
export const refFunctions: Record<string, RefFn> = {
  ...referenceFunctions,
};

/**
 * Functions whose result can change without any input changing. A formula
 * containing one of these is recomputed on every recalculation pass.
 */
export const volatileFunctions: ReadonlySet<string> = new Set([
  'RAND',
  'RANDBETWEEN',
  'NOW',
  'TODAY',
  'OFFSET',
  'INDIRECT',
]);
