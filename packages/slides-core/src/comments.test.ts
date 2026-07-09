import { SlidesCommentStore } from './comments';
import { DeckImpl } from './deck';
import type { DeckEventType } from './types';

const author = { id: 'alice', name: 'Alice' };
const anchor = (elementId: string) => ({ slideId: 's1', elementId });

describe('SlidesCommentStore', () => {
  it('creates a thread with a root comment and notifies', () => {
    const store = new SlidesCommentStore();
    const events: string[] = [];
    store.__setChangeListener((e) => events.push(e.type));
    const t = store.addThread(anchor('e1'), 'Nice shape', author, ['bob']);
    expect(t.comments).toHaveLength(1);
    expect(t.comments[0].mentions).toEqual(['bob']);
    expect(store.hasOpenThread('e1')).toBe(true);
    expect(events).toEqual(['thread-created']);
  });

  it('adds replies, edits, resolves and reopens', () => {
    const store = new SlidesCommentStore();
    const t = store.addThread(anchor('e1'), 'root', author);
    store.addReply(t.id, 'reply', author);
    expect(store.getThread(t.id)!.comments).toHaveLength(2);
    store.editComment(t.id, t.comments[0].id, 'edited');
    expect(store.getThread(t.id)!.comments[0].body).toBe('edited');
    store.resolveThread(t.id, author);
    expect(store.getThread(t.id)!.status).toBe('resolved');
    expect(store.hasOpenThread('e1')).toBe(false);
    store.reopenThread(t.id, author);
    expect(store.getThread(t.id)!.status).toBe('open');
  });

  it('removes the thread when its last comment is deleted', () => {
    const store = new SlidesCommentStore();
    const t = store.addThread(anchor('e1'), 'only', author);
    store.deleteComment(t.id, t.comments[0].id);
    expect(store.getThread(t.id)).toBeUndefined();
  });

  it('round-trips through JSON', () => {
    const store = new SlidesCommentStore();
    store.addThread(anchor('e1'), 'a', author);
    const json = store.toJSON();
    const store2 = new SlidesCommentStore();
    store2.loadJSON(json);
    expect(store2.toJSON()).toEqual(json);
  });
});

describe('DeckImpl comments', () => {
  function deckWithElement(): { deck: DeckImpl; slideId: string; elId: string } {
    const deck = new DeckImpl();
    const slideId = deck.getActiveSlideId();
    const el = deck.addElement(slideId, { type: 'shape' });
    return { deck, slideId, elId: el.id };
  }

  it('emits commentEvent + commentChange on local mutations', () => {
    const { deck, slideId, elId } = deckWithElement();
    const seen: DeckEventType[] = [];
    deck.on('commentEvent', () => seen.push('commentEvent'));
    deck.on('commentChange', () => seen.push('commentChange'));
    deck.getComments().addThread({ slideId, elementId: elId }, 'hi', author);
    expect(seen).toContain('commentEvent');
    expect(seen).toContain('commentChange');
  });

  it('round-trips threads through getData/setData', () => {
    const { deck, slideId, elId } = deckWithElement();
    deck.getComments().addThread({ slideId, elementId: elId }, 'hi', author);
    const data = deck.getData();
    expect(data.threads).toHaveLength(1);
    const deck2 = new DeckImpl();
    deck2.setData(data);
    expect(deck2.getComments().getThreads()).toHaveLength(1);
  });

  it('orphans a thread when its element is deleted', () => {
    const { deck, slideId, elId } = deckWithElement();
    const t = deck.getComments().addThread({ slideId, elementId: elId }, 'hi', author);
    expect(deck.isThreadOrphaned(t.id)).toBe(false);
    deck.deleteElement(elId);
    expect(deck.isThreadOrphaned(t.id)).toBe(true);
    // Thread is kept, not silently dropped.
    expect(deck.getComments().getThread(t.id)).toBeDefined();
  });
});
