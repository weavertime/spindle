import { indexBetween, indexesBetween, sortByIndex } from './fractional-index';

describe('indexBetween', () => {
  it('places a key strictly between two neighbours', () => {
    const a = indexBetween(null, null);
    const b = indexBetween(a, null);
    const mid = indexBetween(a, b);
    expect(a < mid).toBe(true);
    expect(mid < b).toBe(true);
  });

  it('appends before the first key', () => {
    const a = indexBetween(null, null);
    const before = indexBetween(null, a);
    expect(before < a).toBe(true);
  });

  it('appends after the last key', () => {
    const a = indexBetween(null, null);
    const after = indexBetween(a, null);
    expect(a < after).toBe(true);
  });

  it('throws when a >= b', () => {
    const a = indexBetween(null, null);
    const b = indexBetween(a, null);
    expect(() => indexBetween(b, a)).toThrow();
  });

  it('never produces a key ending in the smallest digit', () => {
    for (let i = 0; i < 500; i++) {
      const a = indexBetween(null, null);
      const b = indexBetween(a, null);
      expect(indexBetween(a, b).endsWith('0')).toBe(false);
    }
  });

  it('keeps order across thousands of random insertions', () => {
    // Maintain a sorted list of keys; repeatedly insert into a random gap and
    // assert the list stays strictly ascending and free of duplicates.
    const keys: string[] = [indexBetween(null, null)];
    for (let i = 0; i < 3000; i++) {
      const pos = Math.floor(Math.random() * (keys.length + 1));
      const a = pos > 0 ? keys[pos - 1] : null;
      const b = pos < keys.length ? keys[pos] : null;
      const key = indexBetween(a, b);
      keys.splice(pos, 0, key);
    }
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i - 1] < keys[i]).toBe(true);
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps concurrent inserts into the same gap in range, with jitter spreading them', () => {
    // Two peers inserting between the same pair each land strictly inside the
    // gap. Jitter makes an exact key collision rare; on the rare collision the
    // id tie-break in sortByIndex still yields a total order, so a collision is
    // harmless (verified in the sortByIndex suite), not a correctness bug.
    const a = indexBetween(null, null);
    const b = indexBetween(a, null);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const key = indexBetween(a, b);
      expect(a < key && key < b).toBe(true);
      seen.add(key);
    }
    // Jitter should keep the vast majority distinct (birthday collisions on a
    // 62² suffix space are few); assert it is clearly doing its job.
    expect(seen.size).toBeGreaterThan(180);
  });
});

describe('indexesBetween', () => {
  it('returns n ascending keys strictly inside the gap', () => {
    const a = indexBetween(null, null);
    const b = indexBetween(a, null);
    const keys = indexesBetween(a, b, 10);
    expect(keys).toHaveLength(10);
    expect(a < keys[0]).toBe(true);
    expect(keys[keys.length - 1] < b).toBe(true);
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i - 1] < keys[i]).toBe(true);
    }
  });

  it('handles open bounds and edge counts', () => {
    expect(indexesBetween(null, null, 0)).toEqual([]);
    expect(indexesBetween(null, null, 1)).toHaveLength(1);
    const many = indexesBetween(null, null, 25);
    for (let i = 1; i < many.length; i++) {
      expect(many[i - 1] < many[i]).toBe(true);
    }
  });
});

describe('sortByIndex', () => {
  it('sorts by index then id, without mutating input', () => {
    const items = [
      { id: 'c', index: 'V' },
      { id: 'a', index: 'G' },
      { id: 'b', index: 'G' },
    ];
    const sorted = sortByIndex(items);
    expect(sorted.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(items.map((i) => i.id)).toEqual(['c', 'a', 'b']); // untouched
  });
});
