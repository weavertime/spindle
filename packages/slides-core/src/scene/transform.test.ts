import { resizeFrame, rotateFrame, MIN_SIZE, type ResizeHandle } from './transform';
import { frameCorners } from './geometry';
import type { Frame } from './types';

// Which rotated corner is the fixed anchor for each corner handle.
const ANCHOR_CORNER: Record<'nw' | 'ne' | 'se' | 'sw', number> = {
  se: 0, // anchor = top-left
  sw: 1, // anchor = top-right
  nw: 2, // anchor = bottom-right
  ne: 3, // anchor = bottom-left
};

function randFrame(rng: () => number): Frame {
  return {
    x: rng() * 400 - 200,
    y: rng() * 400 - 200,
    w: 40 + rng() * 300,
    h: 40 + rng() * 300,
    rotation: rng() * 360 - 180,
  };
}

describe('resizeFrame — anchor invariance', () => {
  it('keeps the opposite corner fixed for every corner handle at any rotation', () => {
    let seed = 12345;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const handles: Array<keyof typeof ANCHOR_CORNER> = ['nw', 'ne', 'se', 'sw'];
    for (let i = 0; i < 400; i++) {
      const frame = randFrame(rng);
      const handle = handles[i % 4];
      const anchorBefore = frameCorners(frame)[ANCHOR_CORNER[handle]];
      // Drag the handle to an arbitrary world point.
      const pointer = { x: rng() * 800 - 400, y: rng() * 800 - 400 };
      const next = resizeFrame(frame, handle as ResizeHandle, pointer);
      const anchorAfter = frameCorners(next)[ANCHOR_CORNER[handle]];
      expect(anchorAfter.x).toBeCloseTo(anchorBefore.x, 4);
      expect(anchorAfter.y).toBeCloseTo(anchorBefore.y, 4);
    }
  });

  it('clamps to the minimum size', () => {
    const frame: Frame = { x: 0, y: 0, w: 100, h: 100, rotation: 0 };
    // Drag SE handle back past the NW anchor → clamps, no flip.
    const next = resizeFrame(frame, 'se', { x: -50, y: -50 });
    expect(next.w).toBe(MIN_SIZE);
    expect(next.h).toBe(MIN_SIZE);
  });

  it('preserves aspect ratio when locked (corner)', () => {
    const frame: Frame = { x: 0, y: 0, w: 200, h: 100, rotation: 0 };
    const next = resizeFrame(frame, 'se', { x: 400, y: 150 }, { lockAspect: true });
    expect(next.w / next.h).toBeCloseTo(2, 5);
  });

  it('edge handle changes only one dimension', () => {
    const frame: Frame = { x: 0, y: 0, w: 100, h: 100, rotation: 0 };
    const next = resizeFrame(frame, 'e', { x: 260, y: 999 });
    expect(next.h).toBe(100);
    expect(next.w).toBeCloseTo(260, 5);
    expect(next.y).toBe(0);
  });
});

describe('rotateFrame', () => {
  it('points the handle toward the pointer', () => {
    const frame: Frame = { x: 0, y: 0, w: 100, h: 100, rotation: 0 };
    // Pointer directly to the right of centre → handle rotates from up to right = 90°.
    const next = rotateFrame(frame, { x: 200, y: 50 });
    expect(next.rotation).toBeCloseTo(90, 5);
  });

  it('snaps within 3° of a 45° step', () => {
    const frame: Frame = { x: 0, y: 0, w: 100, h: 100, rotation: 0 };
    // ~1° past vertical-down: pointer below centre → ~180°, snaps to 180.
    const next = rotateFrame(frame, { x: 51, y: 200 });
    expect(Math.abs(next.rotation)).toBeCloseTo(180, 5);
  });

  it('snaps to 15° increments when snap is set', () => {
    const frame: Frame = { x: 0, y: 0, w: 100, h: 100, rotation: 0 };
    const next = rotateFrame(frame, { x: 180, y: 30 }, { snap: true });
    expect(next.rotation % 15).toBeCloseTo(0, 5);
  });

  it('leaves the centre fixed', () => {
    const frame: Frame = { x: 10, y: 20, w: 100, h: 60, rotation: 0 };
    const next = rotateFrame(frame, { x: 300, y: 300 });
    expect(next.x + next.w / 2).toBeCloseTo(60);
    expect(next.y + next.h / 2).toBeCloseTo(50);
  });
});
