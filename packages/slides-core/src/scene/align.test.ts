import { alignFrames, distributeFrames, type FrameItem } from './align';
import type { Frame } from './types';

const item = (id: string, x: number, y: number, w = 40, h = 40, rotation = 0): FrameItem => ({
  id,
  frame: { x, y, w, h, rotation } as Frame,
});

describe('alignFrames', () => {
  const items = [item('a', 0, 0, 40, 40), item('b', 100, 50, 60, 20), item('c', 200, 200, 40, 40)];

  it('aligns left edges to the selection bounds', () => {
    const res = alignFrames(items, 'left');
    expect(res.map((r) => r.frame.x)).toEqual([0, 0, 0]);
  });

  it('aligns right edges', () => {
    const res = alignFrames(items, 'right');
    // Rightmost edge is 240 (c). Each frame's right edge becomes 240.
    expect(res.map((r) => r.frame.x + r.frame.w)).toEqual([240, 240, 240]);
  });

  it('centres horizontally', () => {
    const res = alignFrames(items, 'centerH');
    const centres = res.map((r) => r.frame.x + r.frame.w / 2);
    expect(centres[0]).toBeCloseTo(centres[1]);
    expect(centres[1]).toBeCloseTo(centres[2]);
  });

  it('aligns to explicit bounds (e.g. the slide) for a single element', () => {
    const res = alignFrames([item('a', 100, 100, 40, 40)], 'centerH', { x: 0, y: 0, w: 1280, h: 720 });
    expect(res[0].frame.x + 20).toBeCloseTo(640);
  });

  it('only translates — size and rotation untouched', () => {
    const res = alignFrames([item('a', 0, 0, 40, 20, 30)], 'top', { x: 0, y: 0, w: 100, h: 100 });
    expect(res[0].frame.w).toBe(40);
    expect(res[0].frame.h).toBe(20);
    expect(res[0].frame.rotation).toBe(30);
  });
});

describe('distributeFrames', () => {
  it('evenly spaces centres along the horizontal axis', () => {
    const items = [item('a', 0, 0, 20, 20), item('b', 30, 0, 20, 20), item('c', 200, 0, 20, 20)];
    const res = distributeFrames(items, 'h');
    const centres = res.map((r) => r.frame.x + r.frame.w / 2).sort((p, q) => p - q);
    expect(centres[1] - centres[0]).toBeCloseTo(centres[2] - centres[1]);
  });

  it('returns the input unchanged for fewer than 3 items', () => {
    const items = [item('a', 0, 0), item('b', 100, 0)];
    expect(distributeFrames(items, 'h')).toBe(items);
  });
});
