import { adjustFormula } from './formula-adjust';
import { WorkbookImpl } from '../workbook';

describe('fill/copy formula adjustment out of bounds', () => {
  it('yields #REF! when a relative ref falls above row 1', () => {
    const wb = new WorkbookImpl('wb', 'WB');
    // =A4 at A5 references one row up; filled up to A1 the ref falls off the top.
    expect(adjustFormula('=A4', wb, undefined, 4, 0, 0, 0)).toContain('#REF!');
  });

  it('yields #REF! when a relative ref falls left of column A', () => {
    const wb = new WorkbookImpl('wb', 'WB');
    // =A1 at B1 references one column left; filled left to A1 the ref falls off.
    expect(adjustFormula('=A1', wb, undefined, 0, 1, 0, 0)).toContain('#REF!');
  });

  it('adjusts normally when the target stays in bounds', () => {
    const wb = new WorkbookImpl('wb', 'WB');
    expect(adjustFormula('=A4', wb, undefined, 4, 0, 6, 0)).toBe('=A6');
  });
});
