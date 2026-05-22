import { FormulaGraphImpl } from './formula-graph';

/**
 * Build a graph from `[cell, dependencies]` pairs. Order does not matter — the
 * reverse index is keyed by dependency, so cyclic graphs wire up correctly too.
 */
function graphOf(edges: Array<[cell: string, deps: string[]]>): FormulaGraphImpl {
  const g = new FormulaGraphImpl();
  for (const [cell, deps] of edges) {
    g.addFormula(cell, '=x', new Set(deps));
  }
  return g;
}

describe('markDirtyDependents', () => {
  it('collects every transitive dependent and marks it dirty', () => {
    // A <- B <- C
    const g = graphOf([
      ['A', []],
      ['B', ['A']],
      ['C', ['B']],
    ]);
    g.markClean('B', 1);
    g.markClean('C', 1);

    const dirty = g.markDirtyDependents('A');

    expect([...dirty].sort()).toEqual(['B', 'C']);
    expect(g.nodes.get('B')?.isDirty).toBe(true);
    expect(g.nodes.get('C')?.isDirty).toBe(true);
    expect(dirty.has('A')).toBe(false);
  });

  it('finds dependents of a plain value cell that is not itself a formula', () => {
    // F reads value cell V; V is never added as a formula.
    const g = graphOf([['F', ['V']]]);
    expect([...g.markDirtyDependents('V')]).toEqual(['F']);
  });

  it('terminates on a dependency cycle', () => {
    const g = graphOf([
      ['A', ['B']],
      ['B', ['A']],
    ]);
    expect([...g.markDirtyDependents('A')].sort()).toEqual(['A', 'B']);
  });
});

describe('topologicalOrder', () => {
  it('orders a chain dependencies-first', () => {
    const g = graphOf([
      ['A', []],
      ['B', ['A']],
      ['C', ['B']],
    ]);
    const { ordered, cyclic } = g.topologicalOrder(new Set(['B', 'C']));
    expect(ordered).toEqual(['B', 'C']);
    expect(cyclic).toEqual([]);
  });

  it('computes a diamond apex exactly once, after both branches', () => {
    //   A
    //  / \
    // B   C
    //  \ /
    //   D
    const g = graphOf([
      ['A', []],
      ['B', ['A']],
      ['C', ['A']],
      ['D', ['B', 'C']],
    ]);
    const dirty = g.markDirtyDependents('A');
    const { ordered, cyclic } = g.topologicalOrder(dirty);

    expect(cyclic).toEqual([]);
    expect(ordered).toHaveLength(3);
    expect(ordered.filter((k) => k === 'D')).toHaveLength(1);
    expect(ordered.indexOf('D')).toBeGreaterThan(ordered.indexOf('B'));
    expect(ordered.indexOf('D')).toBeGreaterThan(ordered.indexOf('C'));
  });

  it('reports a cycle and its downstream as cyclic, not ordered', () => {
    // A <-> B cycle; C depends on B but is not itself in the cycle.
    const g = graphOf([
      ['A', ['B']],
      ['B', ['A']],
      ['C', ['B']],
    ]);
    const { ordered, cyclic } = g.topologicalOrder(new Set(['A', 'B', 'C']));
    expect(ordered).toEqual([]);
    expect([...cyclic].sort()).toEqual(['A', 'B', 'C']);
  });
});

describe('invalidate', () => {
  it('does not stack-overflow on a dependency cycle', () => {
    const g = graphOf([
      ['A', ['B']],
      ['B', ['A']],
    ]);
    g.markClean('A', 1);
    g.markClean('B', 1);

    expect(() => g.invalidate('A')).not.toThrow();
    expect(g.nodes.get('A')?.isDirty).toBe(true);
    expect(g.nodes.get('B')?.isDirty).toBe(true);
  });
});

describe('re-adding a formula', () => {
  it('drops reverse-index edges for dependencies it no longer reads', () => {
    const g = new FormulaGraphImpl();
    g.addFormula('F', '=A', new Set(['A']));
    expect([...g.markDirtyDependents('A')]).toEqual(['F']);

    g.addFormula('F', '=B', new Set(['B'])); // F now reads B instead of A
    expect([...g.markDirtyDependents('A')]).toEqual([]);
    expect([...g.markDirtyDependents('B')]).toEqual(['F']);
  });
});

describe('markDirtyVolatile', () => {
  it('returns volatile cells and their dependents, and marks them dirty', () => {
    const g = new FormulaGraphImpl();
    g.addFormula('V', '=NOW()', new Set(), true); // volatile
    g.addFormula('D', '=V', new Set(['V'])); // depends on the volatile cell
    g.addFormula('N', '=1', new Set()); // unrelated, non-volatile
    g.markClean('V', 1);
    g.markClean('D', 1);

    const dirty = g.markDirtyVolatile();

    expect([...dirty].sort()).toEqual(['D', 'V']);
    expect(g.nodes.get('V')?.isDirty).toBe(true);
    expect(g.nodes.get('D')?.isDirty).toBe(true);
    expect(dirty.has('N')).toBe(false);
  });

  it('drops a cell from the volatile set when it is re-added non-volatile', () => {
    const g = new FormulaGraphImpl();
    g.addFormula('V', '=NOW()', new Set(), true);
    expect(g.markDirtyVolatile().has('V')).toBe(true);

    g.addFormula('V', '=5', new Set()); // re-added, no longer volatile
    expect(g.markDirtyVolatile().size).toBe(0);
  });
});
