// Z-order operations. Order is a fractional index (ascending = back-to-front),
// so reordering rewrites only the moved elements' indices — never array
// positions (Yjs has no move op). All pure; the engine wraps these.

import { indexesBetween, sortByIndex } from './fractional-index';

export interface ZItem {
  id: string;
  index: string;
}

/** New indices for the selected items, or [] if nothing moved. */
export type ZResult = Array<{ id: string; index: string }>;

/**
 * Given the slide's element order and a target ordering of ids, assign fresh
 * indices to the *selected* elements so they land in their new slots between
 * the unchanged (non-selected) neighbours that bracket each run.
 */
function reflowSelected(newOrder: string[], selected: Set<string>, indexById: Map<string, string>): ZResult {
  const result: ZResult = [];
  let i = 0;
  while (i < newOrder.length) {
    if (!selected.has(newOrder[i])) {
      i++;
      continue;
    }
    // Maximal run of selected ids.
    let j = i;
    while (j < newOrder.length && selected.has(newOrder[j])) j++;
    const leftAnchor = i > 0 ? indexById.get(newOrder[i - 1])! : null;
    const rightAnchor = j < newOrder.length ? indexById.get(newOrder[j])! : null;
    const keys = indexesBetween(leftAnchor, rightAnchor, j - i);
    for (let k = i; k < j; k++) result.push({ id: newOrder[k], index: keys[k - i] });
    i = j;
  }
  return result;
}

function prepare(items: ZItem[], ids: string[]): {
  order: string[];
  selected: Set<string>;
  indexById: Map<string, string>;
} {
  const sorted = sortByIndex(items.map((it) => ({ id: it.id, index: it.index })));
  return {
    order: sorted.map((it) => it.id),
    selected: new Set(ids),
    indexById: new Map(sorted.map((it) => [it.id, it.index])),
  };
}

export function bringToFront(items: ZItem[], ids: string[]): ZResult {
  const { order, selected, indexById } = prepare(items, ids);
  const nonSelected = order.filter((id) => !selected.has(id));
  const selectedInOrder = order.filter((id) => selected.has(id));
  if (selectedInOrder.length === 0) return [];
  const newOrder = [...nonSelected, ...selectedInOrder];
  if (arraysEqual(newOrder, order)) return [];
  return reflowSelected(newOrder, selected, indexById);
}

export function sendToBack(items: ZItem[], ids: string[]): ZResult {
  const { order, selected, indexById } = prepare(items, ids);
  const nonSelected = order.filter((id) => !selected.has(id));
  const selectedInOrder = order.filter((id) => selected.has(id));
  if (selectedInOrder.length === 0) return [];
  const newOrder = [...selectedInOrder, ...nonSelected];
  if (arraysEqual(newOrder, order)) return [];
  return reflowSelected(newOrder, selected, indexById);
}

export function bringForward(items: ZItem[], ids: string[]): ZResult {
  const { order, selected, indexById } = prepare(items, ids);
  const newOrder = [...order];
  // Walk from the top; each selected element hops above the next non-selected.
  for (let i = newOrder.length - 2; i >= 0; i--) {
    if (selected.has(newOrder[i]) && !selected.has(newOrder[i + 1])) {
      [newOrder[i], newOrder[i + 1]] = [newOrder[i + 1], newOrder[i]];
    }
  }
  if (arraysEqual(newOrder, order)) return [];
  return reflowSelected(newOrder, selected, indexById);
}

export function sendBackward(items: ZItem[], ids: string[]): ZResult {
  const { order, selected, indexById } = prepare(items, ids);
  const newOrder = [...order];
  for (let i = 1; i < newOrder.length; i++) {
    if (selected.has(newOrder[i]) && !selected.has(newOrder[i - 1])) {
      [newOrder[i], newOrder[i - 1]] = [newOrder[i - 1], newOrder[i]];
    }
  }
  if (arraysEqual(newOrder, order)) return [];
  return reflowSelected(newOrder, selected, indexById);
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
