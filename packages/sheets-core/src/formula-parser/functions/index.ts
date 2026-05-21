// Built-in formula function registry.

import type { EagerFn, LazyFn } from './helpers';
import { mathFunctions } from './math';
import { logicalEagerFunctions, logicalLazyFunctions } from './logical';
import { textFunctions } from './text';
import { lookupFunctions } from './lookup';
import { statsFunctions } from './stats';
import { dateFunctions } from './date';
import { informationEagerFunctions, informationLazyFunctions } from './information';

export type { EagerFn, LazyFn } from './helpers';

/** Functions whose arguments are fully evaluated before the function runs. */
export const eagerFunctions: Record<string, EagerFn> = {
  ...mathFunctions,
  ...logicalEagerFunctions,
  ...textFunctions,
  ...lookupFunctions,
  ...statsFunctions,
  ...dateFunctions,
  ...informationEagerFunctions,
};

/** Functions that receive argument thunks so they can short-circuit. */
export const lazyFunctions: Record<string, LazyFn> = {
  ...logicalLazyFunctions,
  ...informationLazyFunctions,
};
