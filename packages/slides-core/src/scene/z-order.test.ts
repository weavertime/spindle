import { bringToFront, sendToBack, bringForward, sendBackward, type ZItem } from './z-order';
import { sortByIndex } from './fractional-index';

// Items with simple ascending indices; ids A..E in back-to-front order.
function items(): ZItem[] {
  return [
    { id: 'A', index: 'a' },
    { id: 'B', index: 'b' },
    { id: 'C', index: 'c' },
    { id: 'D', index: 'd' },
    { id: 'E', index: 'e' },
  ];
}

function orderAfter(base: ZItem[], changes: Array<{ id: string; index: string }>): string[] {
  const byId = new Map(base.map((it) => [it.id, it.index]));
  for (const c of changes) byId.set(c.id, c.index);
  const merged = [...byId.entries()].map(([id, index]) => ({ id, index }));
  return sortByIndex(merged).map((it) => it.id);
}

describe('z-order', () => {
  it('brings a selection to the front', () => {
    expect(orderAfter(items(), bringToFront(items(), ['B']))).toEqual(['A', 'C', 'D', 'E', 'B']);
  });

  it('sends a selection to the back', () => {
    expect(orderAfter(items(), sendToBack(items(), ['D']))).toEqual(['D', 'A', 'B', 'C', 'E']);
  });

  it('brings a selection forward one step', () => {
    expect(orderAfter(items(), bringForward(items(), ['B']))).toEqual(['A', 'C', 'B', 'D', 'E']);
  });

  it('sends a selection backward one step', () => {
    expect(orderAfter(items(), sendBackward(items(), ['D']))).toEqual(['A', 'B', 'D', 'C', 'E']);
  });

  it('keeps relative order of a multi-selection brought to front', () => {
    expect(orderAfter(items(), bringToFront(items(), ['A', 'C']))).toEqual(['B', 'D', 'E', 'A', 'C']);
  });

  it('is a no-op when already at the front', () => {
    expect(bringToFront(items(), ['E'])).toEqual([]);
    expect(bringForward(items(), ['E'])).toEqual([]);
  });

  it('is a no-op when already at the back', () => {
    expect(sendToBack(items(), ['A'])).toEqual([]);
    expect(sendBackward(items(), ['A'])).toEqual([]);
  });
});
