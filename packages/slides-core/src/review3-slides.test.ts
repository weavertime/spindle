import { DeckImpl } from './deck';
import { normalizeDeckData } from './serialization';
import { isValidIndex } from './scene/fractional-index';
import type { DeckData } from './types';

describe('normalizeDeckData repairs malformed fractional indices', () => {
  const deckWith = (slideIndex: string): DeckData =>
    ({
      id: 'd',
      title: 't',
      slideSize: { w: 1280, h: 720 },
      slides: [
        { id: 's1', index: slideIndex, elements: [] },
        { id: 's2', index: 'a1', elements: [] },
      ],
    }) as unknown as DeckData;

  it('re-keys a trailing-zero index (would crash the next edit)', () => {
    const norm = normalizeDeckData(deckWith('0'));
    for (const s of norm.slides) expect(isValidIndex(s.index)).toBe(true);
  });

  it('re-keys duplicate indices', () => {
    const dup = {
      id: 'd', title: 't', slideSize: { w: 1280, h: 720 },
      slides: [
        { id: 's1', index: 'a1', elements: [] },
        { id: 's2', index: 'a1', elements: [] },
      ],
    } as unknown as DeckData;
    const norm = normalizeDeckData(dup);
    expect(new Set(norm.slides.map((s) => s.index)).size).toBe(2);
  });

  it('a deck loaded with a bare-0 index stays editable (no crash on structural edit)', () => {
    const deck = new DeckImpl();
    deck.setData(deckWith('0'));
    // A structural edit that uses an index bound as a fractional key must not throw.
    expect(() => deck.addSlide()).not.toThrow();
  });

  it('leaves already-valid, unique indices untouched', () => {
    const norm = normalizeDeckData(deckWith('a5'));
    const s1 = norm.slides.find((s) => s.id === 's1')!;
    expect(s1.index).toBe('a5');
  });
});

describe('duplicateElements preserves grouping', () => {
  it('a group duplicates to a new group of only the copies', () => {
    const deck = new DeckImpl();
    const slide = deck.getActiveSlideId();
    const a = deck.addElement(slide, { type: 'shape', x: 0, y: 0, w: 50, h: 50 });
    const b = deck.addElement(slide, { type: 'shape', x: 100, y: 0, w: 50, h: 50 });
    const groupId = deck.groupElements([a.id, b.id])!;

    const copies = deck.duplicateElements([a.id, b.id]);
    expect(copies).toHaveLength(2);
    // Both copies share one fresh group id, different from the source group.
    const g = copies[0].groupId;
    expect(g).toBeDefined();
    expect(g).not.toBe(groupId);
    expect(copies[1].groupId).toBe(g);
    // The copied group contains only the copies.
    expect(deck.getGroupMembers(g!).sort()).toEqual(copies.map((c) => c.id).sort());
    // Source group untouched.
    expect(deck.getGroupMembers(groupId).sort()).toEqual([a.id, b.id].sort());
  });
});

describe('removeTableRows preserves rowHeights', () => {
  it('keeps rowHeights aligned after removing a range of rows', () => {
    const deck = new DeckImpl();
    const slide = deck.getActiveSlideId();
    const el = deck.addElement(slide, { type: 'table', rows: 4, cols: 2 } as never);
    // Give the last row a manual min-height.
    deck.updateElement(el.id, { rowHeights: [0, 0, 0, 999] } as never);
    deck.removeTableRows(el.id, 0, 1); // delete rows 0-1
    const t = deck.getElement(el.id) as unknown as { rows: number; rowHeights?: number[] };
    expect(t.rows).toBe(2);
    expect(t.rowHeights).toHaveLength(2);
    expect(t.rowHeights).toEqual([0, 999]); // 999 stays aligned to the surviving last row
  });
});
