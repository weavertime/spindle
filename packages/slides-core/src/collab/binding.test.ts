import * as Y from 'yjs';
import { InMemoryProvider, __resetInMemoryRooms, type CollabIdentity } from '@weavertime/spindle-shared';
import { DeckImpl } from '../deck';
import { getBuiltinTheme } from '../theme/builtin';
import { richTextFromPlainText, richTextToPlainText, type RichTextDoc } from '../text/model';
import { hydrateYDocFromData, serializeYDocToData } from './y-schema';
import type { CollabHandle } from './binding';
import type { DeckData } from '../types';

const identity = (name: string): CollabIdentity => ({ userId: name, displayName: name, color: '#123456' });

function stripSelection(data: DeckData): Omit<DeckData, 'selection'> {
  const { selection: _selection, ...rest } = data;
  return rest;
}

function seedDeck(): DeckData {
  return {
    id: 'room',
    title: 'Deck',
    slideSize: { w: 1280, h: 720 },
    theme: getBuiltinTheme('Clean'),
    slides: [
      {
        id: 's1',
        index: 'V',
        layoutRef: 'blank',
        elements: [
          { id: 'e1', containerId: 's1', index: 'a', type: 'shape', shape: 'rect', x: 0, y: 0, w: 100, h: 100, rotation: 0, fill: { kind: 'solid', color: { kind: 'theme', slot: 'accent1' } } },
          { id: 'e2', containerId: 's1', index: 'b', type: 'text', x: 0, y: 200, w: 300, h: 80, rotation: 0, richText: richTextFromPlainText('hello') },
        ],
      },
    ],
  };
}

async function attachedPair(seed?: DeckData): Promise<{ a: DeckImpl; b: DeckImpl; ha: CollabHandle; hb: CollabHandle }> {
  __resetInMemoryRooms();
  const a = new DeckImpl('room', 'Deck');
  if (seed) a.setData(seed);
  const ha = await a.attachCollab(new InMemoryProvider(), identity('A'), { roomId: 'room' });
  const b = new DeckImpl('joiner');
  const hb = await b.attachCollab(new InMemoryProvider(), identity('B'), { roomId: 'room' });
  return { a, b, ha, hb };
}

afterEach(() => __resetInMemoryRooms());

describe('y-schema round-trip', () => {
  it('is idempotent through hydrate → serialize', () => {
    const a = new DeckImpl();
    a.setData(seedDeck());
    const d1 = new Y.Doc();
    hydrateYDocFromData(d1, a.getData());
    const round = serializeYDocToData(d1, { elementIds: [] }, a.getActiveSlideId());

    const b = new DeckImpl();
    b.setData(round);
    const d2 = new Y.Doc();
    hydrateYDocFromData(d2, b.getData());
    const round2 = serializeYDocToData(d2, { elementIds: [] }, b.getActiveSlideId());

    expect(stripSelection(round2)).toEqual(stripSelection(round));
    // Text body survived the fragment round-trip.
    const textEl = round.slides[0].elements.find((e) => e.type === 'text')!;
    expect(richTextToPlainText((textEl as unknown as { richText: RichTextDoc }).richText)).toBe('hello');
  });
});

describe('two-peer convergence over InMemoryProvider', () => {
  it('propagates a joiner into an existing room without duplicating', async () => {
    const { a, b } = await attachedPair(seedDeck());
    expect(b.slideCount()).toBe(1);
    expect(b.getElementsForSlide(b.getActiveSlideId())).toHaveLength(2);
    expect(stripSelection(a.getData())).toEqual(stripSelection(b.getData()));
  });

  it('converges on concurrent moves and reorders of different elements', async () => {
    const { a, b } = await attachedPair(seedDeck());
    const slideId = a.getActiveSlideId();
    const [e1, e2] = a.getElementIdsForSlide(slideId);

    a.moveElements([e1], 40, 0);
    b.moveElements([e2], 0, 25);
    a.bringToFront([e1]);

    expect(stripSelection(a.getData())).toEqual(stripSelection(b.getData()));
    expect(a.getElement(e1)!.x).toBe(40);
    expect(a.getElement(e2)!.y).toBe(225);
  });

  it('converges on rich-text edits in different elements', async () => {
    const { a, b } = await attachedPair(seedDeck());
    const slideId = a.getActiveSlideId();
    const textId = a.getElementsForSlide(slideId).find((e) => e.type === 'text')!.id;

    a.setElementRichText(textId, richTextFromPlainText('hello world'));
    expect(richTextToPlainText((b.getElement(textId) as unknown as { richText: RichTextDoc }).richText)).toBe('hello world');
    expect(stripSelection(a.getData())).toEqual(stripSelection(b.getData()));
  });

  it('converges on a new element added by a peer', async () => {
    const { a, b } = await attachedPair(seedDeck());
    const slideId = a.getActiveSlideId();
    const created = b.addElement(slideId, { type: 'shape', shape: 'ellipse', x: 500, y: 100 });
    expect(a.getElement(created.id)).toBeDefined();
    expect(stripSelection(a.getData())).toEqual(stripSelection(b.getData()));
  });
});

describe('collab undo', () => {
  it("undo reverts only the local peer's edit, not a remote one", async () => {
    const { a, b } = await attachedPair(seedDeck());
    const slideId = a.getActiveSlideId();
    const ea = a.addElement(slideId, { type: 'shape', x: 10, y: 10 });
    const eb = b.addElement(slideId, { type: 'shape', x: 20, y: 20 });
    expect(a.getElement(eb.id)).toBeDefined(); // remote add visible locally

    a.undo();
    expect(a.getElement(ea.id)).toBeUndefined(); // own add undone
    expect(a.getElement(eb.id)).toBeDefined(); // remote add survives
    expect(stripSelection(a.getData())).toEqual(stripSelection(b.getData()));
  });

  it('tracks a rich-text fragment created after the UndoManager exists', async () => {
    const { a, b, ha } = await attachedPair(seedDeck());
    const slideId = a.getActiveSlideId();
    const t = a.addElement(slideId, { type: 'text', x: 0, y: 400, richText: richTextFromPlainText('one') });
    ha.undoManager.stopCapturing(); // separate the text edit into its own undo step
    a.setElementRichText(t.id, richTextFromPlainText('one two'));
    expect(richTextToPlainText((b.getElement(t.id) as unknown as { richText: RichTextDoc }).richText)).toBe('one two');

    a.undo(); // should revert just the text edit
    expect(richTextToPlainText((a.getElement(t.id) as unknown as { richText: RichTextDoc }).richText)).toBe('one');
    expect(a.getElement(t.id)).toBeDefined();
  });
});
