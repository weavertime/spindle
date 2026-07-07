import { DeckImpl } from './deck';
import type { DeckData, DeckEventType, ElementChangePayload } from './types';
import { richTextFromPlainText } from './text/model';

function capture(deck: DeckImpl, event: DeckEventType): unknown[] {
  const seen: unknown[] = [];
  deck.on(event, (e) => seen.push(e.payload));
  return seen;
}

describe('DeckImpl construction', () => {
  it('starts with one slide and a valid active slide', () => {
    const deck = new DeckImpl();
    expect(deck.slideCount()).toBe(1);
    expect(deck.getSlideIds()).toContain(deck.getActiveSlideId());
  });
});

describe('slides', () => {
  it('adds slides in order and keeps them sorted by fractional index', () => {
    const deck = new DeckImpl();
    const [first] = deck.getSlideIds();
    const b = deck.addSlide({ afterSlideId: first });
    const c = deck.addSlide({ afterSlideId: first }); // between first and b
    expect(deck.getSlideIds()).toEqual([first, c.id, b.id]);
  });

  it('refuses to delete the last slide', () => {
    const deck = new DeckImpl();
    expect(() => deck.deleteSlide(deck.getActiveSlideId())).toThrow();
  });

  it('reassigns active slide when the active one is deleted', () => {
    const deck = new DeckImpl();
    const first = deck.getActiveSlideId();
    const b = deck.addSlide();
    deck.setActiveSlide(b.id);
    deck.deleteSlide(b.id);
    expect(deck.getActiveSlideId()).toBe(first);
  });

  it('moves a slide to a new position', () => {
    const deck = new DeckImpl();
    const first = deck.getActiveSlideId();
    const b = deck.addSlide();
    const c = deck.addSlide();
    // Order: first, b, c → move c to front
    deck.moveSlide(c.id, {});
    expect(deck.getSlideIds()).toEqual([c.id, first, b.id]);
  });

  it('duplicates a slide together with its elements', () => {
    const deck = new DeckImpl();
    const slide = deck.getActiveSlideId();
    deck.addElement(slide, { type: 'shape', shape: 'ellipse' });
    const copy = deck.duplicateSlide(slide);
    expect(copy).toBeDefined();
    const copyEls = deck.getElementsForSlide(copy!.id);
    expect(copyEls).toHaveLength(1);
    expect(copyEls[0].containerId).toBe(copy!.id);
    // Duplicated elements are independent records with new ids.
    expect(copyEls[0].id).not.toBe(deck.getElementsForSlide(slide)[0].id);
  });
});

describe('elements', () => {
  it('adds elements at the top of the z-order', () => {
    const deck = new DeckImpl();
    const slide = deck.getActiveSlideId();
    const a = deck.addElement(slide, { type: 'shape' });
    const b = deck.addElement(slide, { type: 'text' });
    expect(deck.getElementIdsForSlide(slide)).toEqual([a.id, b.id]);
    expect(a.index < b.index).toBe(true);
  });

  it('replaces the record on update (immutable) and emits keys', () => {
    const deck = new DeckImpl();
    const slide = deck.getActiveSlideId();
    const el = deck.addElement(slide, { type: 'shape' });
    const changes = capture(deck, 'elementChange') as ElementChangePayload[];
    deck.updateElement(el.id, { x: 500 });
    const updated = deck.getElement(el.id)!;
    expect(updated).not.toBe(el); // new object reference
    expect(updated.x).toBe(500);
    expect(changes[0]).toMatchObject({ elementId: el.id, slideId: slide, keys: ['x'] });
  });

  it('batches multi-element updates', () => {
    const deck = new DeckImpl();
    const slide = deck.getActiveSlideId();
    const a = deck.addElement(slide, { type: 'shape' });
    const b = deck.addElement(slide, { type: 'shape' });
    const changes = capture(deck, 'elementChange');
    deck.updateElements([
      { id: a.id, patch: { x: 10 } },
      { id: b.id, patch: { x: 20 } },
    ]);
    expect(changes).toHaveLength(2);
    expect(deck.getElement(a.id)!.x).toBe(10);
    expect(deck.getElement(b.id)!.x).toBe(20);
  });

  it('deletes elements and duplicates with an offset', () => {
    const deck = new DeckImpl();
    const slide = deck.getActiveSlideId();
    const el = deck.addElement(slide, { type: 'shape', x: 100, y: 100 });
    const copy = deck.duplicateElement(el.id)!;
    expect(copy.x).toBe(116);
    expect(copy.y).toBe(116);
    deck.deleteElement(el.id);
    expect(deck.getElement(el.id)).toBeUndefined();
    expect(deck.getElementsForSlide(slide)).toHaveLength(1);
  });

  it('moves elements by a delta as one undo entry', () => {
    const deck = new DeckImpl();
    const slide = deck.getActiveSlideId();
    const a = deck.addElement(slide, { type: 'shape', x: 0, y: 0 });
    const b = deck.addElement(slide, { type: 'shape', x: 50, y: 50 });
    deck.moveElements([a.id, b.id], 10, -5);
    expect(deck.getElement(a.id)!).toMatchObject({ x: 10, y: -5 });
    expect(deck.getElement(b.id)!).toMatchObject({ x: 60, y: 45 });
  });
});

describe('events', () => {
  it('fires slideAdd / elementAdd / selectionChange', () => {
    const deck = new DeckImpl();
    const slide = deck.getActiveSlideId();
    const slideAdds = capture(deck, 'slideAdd');
    const elementAdds = capture(deck, 'elementAdd');
    const selChanges = capture(deck, 'selectionChange');
    deck.addSlide();
    deck.addElement(slide, { type: 'text' });
    deck.setSelection({ slideId: slide, elementIds: ['x'] });
    expect(slideAdds).toHaveLength(1);
    expect(elementAdds).toHaveLength(1);
    expect(selChanges).toHaveLength(1);
  });
});

describe('undo / redo', () => {
  it('undoes and redoes an element addition', () => {
    const deck = new DeckImpl();
    const slide = deck.getActiveSlideId();
    const el = deck.addElement(slide, { type: 'shape' });
    expect(deck.canUndo()).toBe(true);
    deck.undo();
    expect(deck.getElement(el.id)).toBeUndefined();
    expect(deck.canRedo()).toBe(true);
    deck.redo();
    expect(deck.getElement(el.id)).toBeDefined();
  });

  it('undoes a transform back to the prior frame', () => {
    const deck = new DeckImpl();
    const slide = deck.getActiveSlideId();
    const el = deck.addElement(slide, { type: 'shape', x: 100 });
    deck.updateElement(el.id, { x: 400 });
    deck.undo();
    expect(deck.getElement(el.id)!.x).toBe(100);
  });
});

describe('getData / setData', () => {
  const handAuthored: DeckData = {
    id: 'deck1',
    title: 'Hand authored',
    slideSize: { w: 1280, h: 720 },
    theme: {
      name: 'Clean',
      colors: {
        dk1: '#000000', lt1: '#FFFFFF', dk2: '#333333', lt2: '#EEEEEE',
        accent1: '#2D7FF9', accent2: '#16B1A6', accent3: '#F5A623',
        accent4: '#E8543F', accent5: '#8C54FF', accent6: '#4CAF50',
        hlink: '#2D7FF9', folHlink: '#8C54FF',
      },
      fonts: { major: 'Inter', minor: 'Inter' },
    },
    // Deliberately omit slide/element ids and indices — normalization fills them.
    slides: [
      {
        elements: [
          { type: 'shape', shape: 'rect', x: 0, y: 0, w: 100, h: 100, rotation: 0, fill: { kind: 'solid', color: { kind: 'theme', slot: 'accent1' } }, containerId: '', id: '', index: '' },
          { type: 'text', x: 0, y: 0, w: 200, h: 50, rotation: 0, richText: richTextFromPlainText('Hi'), containerId: '', id: '', index: '' },
        ],
      } as never,
      { elements: [] } as never,
    ],
  };

  it('normalizes hand-authored data (ids, indices, containerIds)', () => {
    const deck = new DeckImpl();
    deck.setData(handAuthored);
    expect(deck.slideCount()).toBe(2);
    const slideId = deck.getSlideIds()[0];
    const els = deck.getElementsForSlide(slideId);
    expect(els).toHaveLength(2);
    for (const el of els) {
      expect(el.id.length).toBeGreaterThan(0);
      expect(el.index.length).toBeGreaterThan(0);
      expect(el.containerId).toBe(slideId);
    }
  });

  it('round-trips: getData → setData → getData is stable', () => {
    const a = new DeckImpl();
    a.setData(handAuthored);
    const dataA = a.getData();

    const b = new DeckImpl();
    b.setData(dataA);
    const dataB = b.getData();

    expect(dataB).toEqual(dataA);
  });
});
