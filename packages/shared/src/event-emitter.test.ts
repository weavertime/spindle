import { EventEmitter } from './event-emitter';

describe('EventEmitter batching', () => {
  it('nested batch() does not lose the outer queue and flushes once', () => {
    const em = new EventEmitter();
    const seen: string[] = [];
    em.on('e', (d) => seen.push(d.payload as string));

    em.batch(() => {
      em.emit('e', 'a'); // queued by outer batch
      em.batch(() => {
        em.emit('e', 'b'); // must NOT clear the outer queue or flush now
      });
      // Still batching (depth 1) — nothing dispatched yet.
      expect(seen).toEqual([]);
      em.emit('e', 'c');
    });

    // Outermost batch flushed all three in order, exactly once each.
    expect(seen).toEqual(['a', 'b', 'c']);
  });

  it('dispatches immediately when not batching', () => {
    const em = new EventEmitter();
    const seen: string[] = [];
    em.on('e', (d) => seen.push(d.payload as string));
    em.emit('e', 'x');
    expect(seen).toEqual(['x']);
  });

  it('a handler that unsubscribes during emit does not disturb the current dispatch', () => {
    const em = new EventEmitter();
    const seen: string[] = [];
    const off2 = em.on('e', () => seen.push('b'));
    em.on('e', () => {
      seen.push('a');
      off2(); // remove another handler mid-dispatch
    });
    em.emit('e', null);
    // Snapshot iteration: both handlers registered at emit time still run.
    expect(seen.sort()).toEqual(['a', 'b']);
  });
});
