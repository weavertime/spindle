import { groupAABB, rotateGroup, scaleGroup } from './group';
import { frameCenter } from './geometry';
import type { FrameItem } from './align';
import type { Frame } from './types';

const item = (id: string, x: number, y: number, w = 40, h = 40, rotation = 0): FrameItem => ({
  id,
  frame: { x, y, w, h, rotation } as Frame,
});

describe('group', () => {
  it('computes the group AABB', () => {
    expect(groupAABB([item('a', 0, 0).frame, item('b', 60, 60).frame])).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });

  it('rotating a group orbits member centres and adds Δθ', () => {
    const items = [item('a', 0, 0, 40, 40), item('b', 160, 160, 40, 40)];
    const pivot = { x: 100, y: 100 };
    const res = rotateGroup(items, 180, pivot);
    // 180° about (100,100): centre (20,20) → (180,180); (180,180) → (20,20).
    expect(frameCenter(res[0].frame).x).toBeCloseTo(180);
    expect(frameCenter(res[0].frame).y).toBeCloseTo(180);
    expect(res[0].frame.rotation).toBe(180);
    expect(frameCenter(res[1].frame).x).toBeCloseTo(20);
  });

  it('scaling a group scales centres about the origin and sizes', () => {
    const items = [item('a', 100, 100, 40, 40)];
    const res = scaleGroup(items, 2, 2, { x: 0, y: 0 });
    // Centre (120,120) → (240,240); size 40 → 80.
    expect(res[0].frame.w).toBe(80);
    expect(res[0].frame.h).toBe(80);
    expect(frameCenter(res[0].frame).x).toBeCloseTo(240);
    expect(frameCenter(res[0].frame).y).toBeCloseTo(240);
  });
});
