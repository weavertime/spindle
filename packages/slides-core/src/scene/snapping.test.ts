import { collectSnapTargets, computeSnap, boundsCandidates } from './snapping';
import type { Frame } from './types';

const slide = { w: 1280, h: 720 };

describe('snapping', () => {
  it('collects edge/centre targets from other frames and the slide', () => {
    const targets = collectSnapTargets([{ x: 100, y: 100, w: 200, h: 100, rotation: 0 } as Frame], slide);
    expect(targets.xs).toEqual(expect.arrayContaining([0, 640, 1280, 100, 200, 300]));
    expect(targets.ys).toEqual(expect.arrayContaining([0, 360, 720, 100, 150, 200]));
  });

  it('snaps a moving box to a nearby edge and reports a guide', () => {
    const targets = collectSnapTargets([{ x: 100, y: 100, w: 200, h: 100, rotation: 0 } as Frame], slide);
    const moving = { x: 104, y: 300, w: 50, h: 50 };
    const c = boundsCandidates(moving);
    const res = computeSnap(c.xs, c.ys, targets, 6);
    expect(res.dx).toBeCloseTo(-4); // left edge 104 → 100
    expect(res.guides).toContainEqual({ axis: 'x', pos: 100 });
  });

  it('does not snap beyond the threshold', () => {
    const targets = collectSnapTargets([], slide);
    const c = boundsCandidates({ x: 50, y: 50, w: 40, h: 40 });
    const res = computeSnap(c.xs, c.ys, targets, 3);
    expect(res.dx).toBe(0);
    expect(res.dy).toBe(0);
    expect(res.guides).toHaveLength(0);
  });

  it('snaps centre-to-centre with the slide centre', () => {
    const targets = collectSnapTargets([], slide);
    // Box whose centre is 2px left of slide centre.
    const c = boundsCandidates({ x: 640 - 25 - 2, y: 0, w: 50, h: 50 });
    const res = computeSnap(c.xs, c.ys, targets, 5);
    expect(res.dx).toBeCloseTo(2);
    expect(res.guides).toContainEqual({ axis: 'x', pos: 640 });
  });
});
