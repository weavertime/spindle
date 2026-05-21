import type { EvaluationContext } from '../types';
import { financialFunctions } from './financial';

const ctx: EvaluationContext = {
  getCellValue: () => null,
  getRangeValues: () => [],
};

function call(name: string, args: unknown[]): number {
  return financialFunctions[name](args, ctx) as number;
}

describe('annuity values', () => {
  it('PMT computes the periodic payment', () => {
    expect(call('PMT', [0.1, 10, 1000])).toBeCloseTo(-162.745, 2);
    expect(call('PMT', [0, 10, 1000])).toBe(-100);
  });

  it('FV computes the future value', () => {
    expect(call('FV', [0.1, 10, -100, 0])).toBeCloseTo(1593.742, 2);
    expect(call('FV', [0, 5, -100, 0])).toBe(500);
  });

  it('PV computes the present value', () => {
    expect(call('PV', [0.1, 10, -100])).toBeCloseTo(614.457, 2);
  });

  it('NPER computes the number of periods', () => {
    expect(call('NPER', [0.1, -100, 0, 1593.742])).toBeCloseTo(10, 4);
    expect(call('NPER', [0, -100, 1000])).toBe(10);
  });

  it('RATE solves for the periodic rate', () => {
    expect(call('RATE', [10, -162.745, 1000])).toBeCloseTo(0.1, 4);
  });
});

describe('discounted cash flow', () => {
  it('NPV discounts a stream of cash flows', () => {
    expect(call('NPV', [0.1, 100, 100, 100])).toBeCloseTo(248.685, 2);
  });

  it('IRR finds the rate that zeroes the NPV', () => {
    expect(call('IRR', [[[-100], [50], [50], [50]]])).toBeCloseTo(0.2337, 3);
  });

  it('IRR rejects a stream with fewer than two flows', () => {
    expect(() => call('IRR', [[[100]]])).toThrow('#NUM!');
  });
});

describe('payment breakdown', () => {
  it('IPMT and PPMT split a payment into interest and principal', () => {
    expect(call('IPMT', [0.1, 1, 10, 1000])).toBeCloseTo(-100, 6);
    expect(call('PPMT', [0.1, 1, 10, 1000])).toBeCloseTo(-62.745, 2);
  });

  it('IPMT + PPMT reconstructs the full payment', () => {
    const rate = 0.08;
    const nper = 12;
    const pv = 5000;
    const pmt = call('PMT', [rate, nper, pv]);
    for (let per = 1; per <= nper; per++) {
      const ipmt = call('IPMT', [rate, per, nper, pv]);
      const ppmt = call('PPMT', [rate, per, nper, pv]);
      expect(ipmt + ppmt).toBeCloseTo(pmt, 6);
    }
  });
});
