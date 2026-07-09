import {
  frameCenter,
  frameCorners,
  frameAABB,
  pointInFrame,
  frameIntersectsRect,
  rectContainsFrame,
  rectFromPoints,
  unionAABB,
} from './geometry';
import type { Frame } from './types';

const f = (x: number, y: number, w: number, h: number, rotation = 0): Frame => ({ x, y, w, h, rotation });

describe('geometry basics', () => {
  it('computes the centre', () => {
    expect(frameCenter(f(0, 0, 100, 50))).toEqual({ x: 50, y: 25 });
  });

  it('AABB of an unrotated frame is itself', () => {
    expect(frameAABB(f(10, 20, 100, 40))).toEqual({ x: 10, y: 20, w: 100, h: 40 });
  });

  it('AABB of a 90°-rotated square-ish frame swaps extents', () => {
    const a = frameAABB(f(0, 0, 100, 40, 90));
    // Rotating 100×40 about centre (50,20) by 90° → AABB 40×100 centred at (50,20).
    expect(a.x).toBeCloseTo(30);
    expect(a.y).toBeCloseTo(-30);
    expect(a.w).toBeCloseTo(40);
    expect(a.h).toBeCloseTo(100);
  });

  it('hit-tests points inside/outside an unrotated frame', () => {
    const frame = f(0, 0, 100, 100);
    expect(pointInFrame({ x: 50, y: 50 }, frame)).toBe(true);
    expect(pointInFrame({ x: 120, y: 50 }, frame)).toBe(false);
  });

  it('hit-tests points against a rotated frame', () => {
    const frame = f(0, 0, 100, 20, 45);
    // A point far along the rotated long axis is inside; its axis-aligned twin is not.
    const corner = frameCorners(frame);
    const mid = { x: (corner[0].x + corner[2].x) / 2, y: (corner[0].y + corner[2].y) / 2 };
    expect(pointInFrame(mid, frame)).toBe(true);
    expect(pointInFrame({ x: 95, y: 5 }, frame)).toBe(false);
  });

  it('marquee intersects a rotated frame it overlaps', () => {
    const frame = f(100, 100, 80, 80, 30);
    expect(frameIntersectsRect(frame, { x: 90, y: 90, w: 40, h: 40 })).toBe(true);
    expect(frameIntersectsRect(frame, { x: 400, y: 400, w: 20, h: 20 })).toBe(false);
  });

  it('detects full containment of a rotated frame', () => {
    const frame = f(100, 100, 80, 40, 25);
    const aabb = frameAABB(frame);
    expect(rectContainsFrame({ x: aabb.x - 1, y: aabb.y - 1, w: aabb.w + 2, h: aabb.h + 2 }, frame)).toBe(true);
    expect(rectContainsFrame({ x: 100, y: 100, w: 80, h: 40 }, frame)).toBe(false);
  });

  it('builds a normalized rect from any two points', () => {
    expect(rectFromPoints({ x: 30, y: 40 }, { x: 10, y: 5 })).toEqual({ x: 10, y: 5, w: 20, h: 35 });
  });

  it('unions several frames', () => {
    expect(unionAABB([f(0, 0, 10, 10), f(90, 40, 10, 10)])).toEqual({ x: 0, y: 0, w: 100, h: 50 });
    expect(unionAABB([])).toBeNull();
  });
});
