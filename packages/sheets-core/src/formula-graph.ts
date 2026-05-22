// Formula dependency graph for incremental recalculation

import type { FormulaGraph, FormulaNode, CellValue } from './types';

export class FormulaGraphImpl implements FormulaGraph {
  nodes: Map<string, FormulaNode> = new Map();

  addFormula(cellKey: string, formula: string, dependencies: Set<string>): void {
    const node: FormulaNode = {
      cellKey,
      formula,
      dependencies: new Set(dependencies),
      dependents: new Set(),
      isDirty: true,
    };

    // Update dependents of dependencies
    for (const depKey of dependencies) {
      const depNode = this.nodes.get(depKey);
      if (depNode) {
        depNode.dependents.add(cellKey);
      }
    }

    this.nodes.set(cellKey, node);
  }

  removeFormula(cellKey: string): void {
    const node = this.nodes.get(cellKey);
    if (!node) return;

    // Remove from dependents of dependencies
    for (const depKey of node.dependencies) {
      const depNode = this.nodes.get(depKey);
      if (depNode) {
        depNode.dependents.delete(cellKey);
      }
    }

    this.nodes.delete(cellKey);
  }

  getDependents(cellKey: string): Set<string> {
    const node = this.nodes.get(cellKey);
    return node ? new Set(node.dependents) : new Set();
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
      if (!node) continue;
      node.isDirty = true;
      node.cachedValue = undefined;
      for (const dependentKey of node.dependents) {
        if (!seen.has(dependentKey)) stack.push(dependentKey);
      }
    }
  }

  markDirtyDependents(cellKey: string): Set<string> {
    const dirty = new Set<string>();
    const start = this.nodes.get(cellKey);
    if (!start) return dirty;

    const stack: string[] = [...start.dependents];
    while (stack.length > 0) {
      const key = stack.pop();
      if (key === undefined || dirty.has(key)) continue;
      dirty.add(key);
      const node = this.nodes.get(key);
      if (!node) continue;
      node.isDirty = true;
      node.cachedValue = undefined;
      for (const dependentKey of node.dependents) {
        if (!dirty.has(dependentKey)) stack.push(dependentKey);
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
      const node = this.nodes.get(key);
      if (!node) continue;
      for (const dependentKey of node.dependents) {
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

