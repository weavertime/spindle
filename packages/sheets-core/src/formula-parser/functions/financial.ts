// Financial functions — time value of money.

import type { EagerFn } from './helpers';
import { toNum, strictNumbers } from './helpers';

/** Read an optional numeric argument, falling back to a default. */
function opt(args: unknown[], index: number, fallback: number): number {
  return args[index] !== undefined ? toNum(args[index]) : fallback;
}

/** Payment per period for a loan/annuity. */
function pmtValue(rate: number, nper: number, pv: number, fv: number, type: number): number {
  if (rate === 0) return -(pv + fv) / nper;
  const pvif = Math.pow(1 + rate, nper);
  return -(rate * (fv + pv * pvif)) / ((1 + rate * type) * (pvif - 1));
}

/** Future value of an investment. */
function fvValue(rate: number, nper: number, pmt: number, pv: number, type: number): number {
  if (rate === 0) return -(pv + pmt * nper);
  const pvif = Math.pow(1 + rate, nper);
  return -(pv * pvif + (pmt * (1 + rate * type) * (pvif - 1)) / rate);
}

/** Present value of an investment. */
function pvValue(rate: number, nper: number, pmt: number, fv: number, type: number): number {
  if (rate === 0) return -(fv + pmt * nper);
  const pvif = Math.pow(1 + rate, nper);
  return -(fv + (pmt * (1 + rate * type) * (pvif - 1)) / rate) / pvif;
}

/** Residual of the time-value-of-money equation — zero at the correct rate. */
function tvmResidual(
  rate: number,
  nper: number,
  pmt: number,
  pv: number,
  fv: number,
  type: number
): number {
  if (rate === 0) return pv + pmt * nper + fv;
  const pow = Math.pow(1 + rate, nper);
  return pv * pow + (pmt * (1 + rate * type) * (pow - 1)) / rate + fv;
}

/** Interest portion of the payment in a given period. */
function ipmtValue(
  rate: number,
  per: number,
  nper: number,
  pv: number,
  fv: number,
  type: number
): number {
  const payment = pmtValue(rate, nper, pv, fv, type);
  let balance: number;
  if (per === 1) {
    balance = type === 1 ? 0 : -pv;
  } else {
    balance =
      type === 1
        ? fvValue(rate, per - 2, payment, pv, 1) - payment
        : fvValue(rate, per - 1, payment, pv, 0);
  }
  return balance * rate;
}

export const financialFunctions: Record<string, EagerFn> = {
  PMT: (args) =>
    pmtValue(toNum(args[0]), toNum(args[1]), toNum(args[2]), opt(args, 3, 0), opt(args, 4, 0)),

  FV: (args) =>
    fvValue(toNum(args[0]), toNum(args[1]), toNum(args[2]), opt(args, 3, 0), opt(args, 4, 0)),

  PV: (args) =>
    pvValue(toNum(args[0]), toNum(args[1]), toNum(args[2]), opt(args, 3, 0), opt(args, 4, 0)),

  NPER: (args) => {
    const rate = toNum(args[0]);
    const pmt = toNum(args[1]);
    const pv = toNum(args[2]);
    const fv = opt(args, 3, 0);
    const type = opt(args, 4, 0);
    if (rate === 0) {
      if (pmt === 0) throw new Error('#DIV/0!');
      return -(pv + fv) / pmt;
    }
    const c = (pmt * (1 + rate * type)) / rate;
    const ratio = (c - fv) / (c + pv);
    if (ratio <= 0) throw new Error('#NUM!');
    return Math.log(ratio) / Math.log(1 + rate);
  },

  NPV: (args) => {
    const rate = toNum(args[0]);
    const flows = strictNumbers(args.slice(1));
    let npv = 0;
    for (let i = 0; i < flows.length; i++) {
      npv += flows[i] / Math.pow(1 + rate, i + 1);
    }
    return npv;
  },

  IRR: (args) => {
    const flows = strictNumbers([args[0]]);
    if (flows.length < 2) throw new Error('#NUM!');
    let rate = opt(args, 1, 0.1);
    for (let iter = 0; iter < 100; iter++) {
      let npv = 0;
      let deriv = 0;
      for (let i = 0; i < flows.length; i++) {
        npv += flows[i] / Math.pow(1 + rate, i);
        if (i > 0) deriv -= (i * flows[i]) / Math.pow(1 + rate, i + 1);
      }
      if (deriv === 0) break;
      const next = rate - npv / deriv;
      if (!isFinite(next)) break;
      if (Math.abs(next - rate) < 1e-10) return next;
      rate = next;
    }
    throw new Error('#NUM!');
  },

  RATE: (args) => {
    const nper = toNum(args[0]);
    const pmt = toNum(args[1]);
    const pv = toNum(args[2]);
    const fv = opt(args, 3, 0);
    const type = opt(args, 4, 0);
    let rate = opt(args, 5, 0.1);
    const h = 1e-6;
    for (let iter = 0; iter < 100; iter++) {
      const f = tvmResidual(rate, nper, pmt, pv, fv, type);
      const df =
        (tvmResidual(rate + h, nper, pmt, pv, fv, type) -
          tvmResidual(rate - h, nper, pmt, pv, fv, type)) /
        (2 * h);
      if (df === 0) break;
      const next = rate - f / df;
      if (!isFinite(next)) break;
      if (Math.abs(next - rate) < 1e-10) return next;
      rate = next;
    }
    throw new Error('#NUM!');
  },

  IPMT: (args) =>
    ipmtValue(
      toNum(args[0]),
      toNum(args[1]),
      toNum(args[2]),
      toNum(args[3]),
      opt(args, 4, 0),
      opt(args, 5, 0)
    ),

  PPMT: (args) => {
    const rate = toNum(args[0]);
    const per = toNum(args[1]);
    const nper = toNum(args[2]);
    const pv = toNum(args[3]);
    const fv = opt(args, 4, 0);
    const type = opt(args, 5, 0);
    return pmtValue(rate, nper, pv, fv, type) - ipmtValue(rate, per, nper, pv, fv, type);
  },
};
