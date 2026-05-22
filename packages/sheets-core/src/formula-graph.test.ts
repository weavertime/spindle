import { FormulaGraphImpl } from './formula-graph';
import type { CellResolver } from './types';

/**
 * Resolver for tests: a key of the form "row:col" resolves to those numeric
 * coordinates (used by range tests); any other key resolves to undefined
 * (single-cell tests never have range formulas, so the resolver is unused).
 */
const resolve: CellResolver = (key) => {
  const m = key.match(/^(\d+):(\d+)$/);
  return m ? { row: Number(m[1]), col: Number(m[2]) } : undefined;
};

function cellDeps(...cells: string[]) {
  return { cells: new Set(cells), ranges: [] };
}
function rangeDeps(startKey: string, endKey: string) {
  return { cells: new Set<string>(), ranges: [{ startKey, endKey }] };
}

describe('collectDirty — single-cell dependencies', () => {
  it('collects every transitive dependent and marks it dirty', () => {
    // A <- B <- C
    const g = new FormulaGraphImpl();
    g.addFormula('A', '=x', cellDeps());
    g.addFormula('B', '=x', cellDeps('A'));
    g.addFormula('C', '=x', cellDeps('B'));
    g.markClean('B', 1);
    g.markClean('C', 1);

    const { dirty } = g.collectDirty('A', resolve);

    expect([...dirty].sort()).toEqual(['B', 'C']);
    expect(g.nodes.get('B')?.isDirty).toBe(true);
    expect(g.nodes.get('C')?.isDirty).toBe(true);
    expect(dirty.has('A')).toBe(false);
  });

  it('finds dependents of a plain value cell that is not itself a formula', () => {
    const g = new FormulaGraphImpl();
    g.addFormula('F', '=V', cellDeps('V')); // V is never added as a formula
    expect([...g.collectDirty('V', resolve).dirty]).toEqual(['F']);
  });

  it('drops reverse-index edges when a formula is re-added', () => {
    const g = new FormulaGraphImpl();
    g.addFormula('F', '=A', cellDeps('A'));
    expect([...g.collectDirty('A', resolve).dirty]).toEqual(['F']);

    g.addFormula('F', '=B', cellDeps('B')); // F now reads B instead of A
    expect([...g.collectDirty('A', resolve).dirty]).toEqual([]);
    expect([...g.collectDirty('B', resolve).dirty]).toEqual(['F']);
  });
});

describe('collectDirty — range dependencies', () => {
  it('tracks a cell inside a range, including non-corner cells', () => {
    const g = new FormulaGraphImpl();
    g.addFormula('5:5', '=SUM(1:1:3:1)', rangeDeps('1:1', '3:1')); // range rows 1-3, col 1

    expect([...g.collectDirty('2:1', resolve).dirty]).toEqual(['5:5']); // interior cell
    expect([...g.collectDirty('1:1', resolve).dirty]).toEqual(['5:5']); // corner cell
    expect([...g.collectDirty('9:1', resolve).dirty]).toEqual([]); // outside the range
    expect([...g.collectDirty('2:2', resolve).dirty]).toEqual([]); // outside the column
  });

  it('walks transitively through a formula that sits inside a range', () => {
    const g = new FormulaGraphImpl();
    // G is the formula at cell 2:1; it reads value cell 9:9.
    g.addFormula('2:1', '=9:9', cellDeps('9:9'));
    // F sums the range 1:1..3:1, which contains G's cell 2:1.
    g.addFormula('5:5', '=SUM(...)', rangeDeps('1:1', '3:1'));

    const { dirty, edges } = g.collectDirty('9:9', resolve);
    expect([...dirty].sort()).toEqual(['2:1', '5:5']);
    const { ordered } = g.topologicalOrder(dirty, edges);
    expect(ordered).toEqual(['2:1', '5:5']); // G before the F that ranges over it
  });
});

describe('topologicalOrder', () => {
  it('computes a diamond apex exactly once, after both branches', () => {
    //   A
    //  / \
    // B   C
    //  \ /
    //   D
    const g = new FormulaGraphImpl();
    g.addFormula('A', '=x', cellDeps());
    g.addFormula('B', '=x', cellDeps('A'));
    g.addFormula('C', '=x', cellDeps('A'));
    g.addFormula('D', '=x', cellDeps('B', 'C'));

    const { dirty, edges } = g.collectDirty('A', resolve);
    const { ordered, cyclic } = g.topologicalOrder(dirty, edges);

    expect(cyclic).toEqual([]);
    expect(ordered).toHaveLength(3);
    expect(ordered.filter((k) => k === 'D')).toHaveLength(1);
    expect(ordered.indexOf('D')).toBeGreaterThan(ordered.indexOf('B'));
    expect(ordered.indexOf('D')).toBeGreaterThan(ordered.indexOf('C'));
  });

  it('reports a dependency cycle as cyclic, not ordered, without hanging', () => {
    const g = new FormulaGraphImpl();
    g.addFormula('A', '=B', cellDeps('B'));
    g.addFormula('B', '=A', cellDeps('A'));

    const { dirty, edges } = g.collectDirty('A', resolve);
    const { ordered, cyclic } = g.topologicalOrder(dirty, edges);
    expect(ordered).toEqual([]);
    expect([...cyclic].sort()).toEqual(['A', 'B']);
  });
});

describe('volatile seeding', () => {
  it('collectDirty always includes volatile cells and their dependents', () => {
    const g = new FormulaGraphImpl();
    g.addFormula('V', '=NOW()', cellDeps(), true); // volatile
    g.addFormula('D', '=V', cellDeps('V'));
    g.addFormula('N', '=1', cellDeps()); // unrelated, non-volatile
    g.markClean('V', 1);
    g.markClean('D', 1);

    // An edit somewhere unrelated still recomputes the volatile cell.
    const { dirty } = g.collectDirty('unrelated', resolve);
    expect([...dirty].sort()).toEqual(['D', 'V']);
    expect(g.nodes.get('V')?.isDirty).toBe(true);
    expect(dirty.has('N')).toBe(false);
  });

  it('drops a cell from the volatile set when re-added non-volatile', () => {
    const g = new FormulaGraphImpl();
    g.addFormula('V', '=NOW()', cellDeps(), true);
    expect(g.collectDirty('x', resolve).dirty.has('V')).toBe(true);

    g.addFormula('V', '=5', cellDeps()); // re-added, no longer volatile
    expect(g.collectDirty('x', resolve).dirty.size).toBe(0);
  });
});
