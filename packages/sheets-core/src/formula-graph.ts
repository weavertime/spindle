// Formula dependency graph for incremental recalculation.

import type { FormulaGraph, FormulaNode, CellValue } from './types';

export class FormulaGraphImpl implements FormulaGraph {
  nodes: Map<string, FormulaNode> = new Map();

  /**
   * Reverse index: for every referenced cell key — a formula cell *or* a
   * plain-value cell — the set of formulas that read it. This is the single
   * source of truth for "what depends on X", so a change to a value cell, or
   * to any cell inside a referenced range, correctly triggers a recalc.
   */
  private cellDependents: Map<string, Set<string>> = new Map();

  /** Cell keys of volatile formulas — kept in sync so recalc need not scan. */
  private volatileNodes: Set<string> = new Set();

  addFormula(
    cellKey: string,
    formula: string,
    dependencies: Set<string>,
    volatile = false
  ): void {
    // If this cell was already a formula, unlink its previous dependencies
    // first so re-adding it leaves no stale reverse-index entries.
    const existing = this.nodes.get(cellKey);
    if (existing) this.unlink(cellKey, existing.dependencies);

    const node: FormulaNode = {
      cellKey,
      formula,
      dependencies: new Set(dependencies),
      isDirty: true,
      volatile,
    };
    this.nodes.set(cellKey, node);

    for (const depKey of dependencies) {
      let set = this.cellDependents.get(depKey);
      if (!set) {
        set = new Set();
        this.cellDependents.set(depKey, set);
      }
      set.add(cellKey);
    }

    if (volatile) this.volatileNodes.add(cellKey);
    else this.volatileNodes.delete(cellKey);
  }

  removeFormula(cellKey: string): void {
    const node = this.nodes.get(cellKey);
    if (!node) return;
    this.unlink(cellKey, node.dependencies);
    this.nodes.delete(cellKey);
    this.volatileNodes.delete(cellKey);
  }

  /** Drop `cellKey` from the reverse-index entry of each of its dependencies. */
  private unlink(cellKey: string, dependencies: Set<string>): void {
    for (const depKey of dependencies) {
      const set = this.cellDependents.get(depKey);
      if (!set) continue;
      set.delete(cellKey);
      if (set.size === 0) this.cellDependents.delete(depKey);
    }
  }

  getDependents(cellKey: string): Set<string> {
    return new Set(this.cellDependents.get(cellKey) ?? []);
  }

  getDependencies(cellKey: string): Set<string> {
    const node = this.nodes.get(cellKey);
    return node ? new Set(node.dependencies) : new Set();
  }

  invalidate(cellKey: string): void {
    // Iterative + visited-guarded: a dependency cycle must not stack-overflow.
    const stack: string[] = [cellKey];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const key = stack.pop();
      if (key === undefined || seen.has(key)) continue;
      seen.add(key);
      const node = this.nodes.get(key);
      if (node) {
        node.isDirty = true;
        node.cachedValue = undefined;
      }
      for (const dependentKey of this.cellDependents.get(key) ?? []) {
        if (!seen.has(dependentKey)) stack.push(dependentKey);
      }
    }
  }

  markDirtyDependents(cellKey: string): Set<string> {
    const dirty = new Set<string>();
    const stack: string[] = [...(this.cellDependents.get(cellKey) ?? [])];
    while (stack.length > 0) {
      const key = stack.pop();
      if (key === undefined || dirty.has(key)) continue;
      dirty.add(key);
      const node = this.nodes.get(key);
      if (node) {
        node.isDirty = true;
        node.cachedValue = undefined;
      }
      for (const dependentKey of this.cellDependents.get(key) ?? []) {
        if (!dirty.has(dependentKey)) stack.push(dependentKey);
      }
    }
    return dirty;
  }

  markDirtyVolatile(): Set<string> {
    const dirty = new Set<string>();
    for (const key of this.volatileNodes) {
      const node = this.nodes.get(key);
      if (!node) continue;
      node.isDirty = true;
      node.cachedValue = undefined;
      dirty.add(key);
      for (const dependentKey of this.markDirtyDependents(key)) {
        dirty.add(dependentKey);
      }
    }
    return dirty;
  }

  topologicalOrder(dirty: Set<string>): { ordered: string[]; cyclic: string[] } {
    // Kahn's algorithm over the subgraph induced by `dirty`. A node's in-degree
    // counts only its dependencies that are themselves in the dirty set.
    const inDegree = new Map<string, number>();
    for (const key of dirty) {
      const node = this.nodes.get(key);
      let degree = 0;
      if (node) {
        for (const dep of node.dependencies) {
          if (dirty.has(dep)) degree++;
        }
      }
      inDegree.set(key, degree);
    }

    const queue: string[] = [];
    for (const [key, degree] of inDegree) {
      if (degree === 0) queue.push(key);
    }

    const ordered: string[] = [];
    let head = 0;
    while (head < queue.length) {
      const key = queue[head];
      head++;
      ordered.push(key);
      for (const dependentKey of this.cellDependents.get(key) ?? []) {
        const degree = inDegree.get(dependentKey);
        if (degree === undefined) continue;
        const next = degree - 1;
        inDegree.set(dependentKey, next);
        if (next === 0) queue.push(dependentKey);
      }
    }

    // Anything still owing dependencies is in, or downstream of, a cycle.
    const cyclic: string[] = [];
    for (const [key, degree] of inDegree) {
      if (degree > 0) cyclic.push(key);
    }
    return { ordered, cyclic };
  }

  getDirtyCells(): Set<string> {
    const dirty = new Set<string>();
    for (const [key, node] of this.nodes) {
      if (node.isDirty) {
        dirty.add(key);
      }
    }
    return dirty;
  }

  markClean(cellKey: string, value: CellValue): void {
    const node = this.nodes.get(cellKey);
    if (node) {
      node.isDirty = false;
      node.cachedValue = value;
    }
  }
}
