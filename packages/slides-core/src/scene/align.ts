// Align/distribute — pure frame transforms. Alignment works on each frame's
// axis-aligned bounding box, so rotated elements align by their visual bounds.
// Elements only translate (x/y change); size and rotation are untouched.

import type { Frame } from './types';
import { frameAABB, unionAABB, type Rect } from './geometry';

export type AlignMode = 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom';

export interface FrameItem {
  id: string;
  frame: Frame;
}

/**
 * Align frames to `bounds` (defaults to the selection's union AABB). Pass slide
 * bounds to align a single element to the slide.
 */
export function alignFrames(items: FrameItem[], mode: AlignMode, bounds?: Rect): FrameItem[] {
  if (items.length === 0) return [];
  const ref = bounds ?? unionAABB(items.map((it) => it.frame))!;
  return items.map(({ id, frame }) => {
    const aabb = frameAABB(frame);
    let dx = 0;
    let dy = 0;
    switch (mode) {
      case 'left':
        dx = ref.x - aabb.x;
        break;
      case 'right':
        dx = ref.x + ref.w - (aabb.x + aabb.w);
        break;
      case 'centerH':
        dx = ref.x + ref.w / 2 - (aabb.x + aabb.w / 2);
        break;
      case 'top':
        dy = ref.y - aabb.y;
        break;
      case 'bottom':
        dy = ref.y + ref.h - (aabb.y + aabb.h);
        break;
      case 'centerV':
        dy = ref.y + ref.h / 2 - (aabb.y + aabb.h / 2);
        break;
    }
    return { id, frame: { ...frame, x: frame.x + dx, y: frame.y + dy } };
  });
}

/**
 * Distribute frames so their AABB centres are evenly spaced along an axis. The
 * outermost two frames stay put. Needs at least 3 frames.
 */
export function distributeFrames(items: FrameItem[], axis: 'h' | 'v'): FrameItem[] {
  if (items.length < 3) return items;
  const withCenter = items.map((it) => {
    const a = frameAABB(it.frame);
    return { it, center: axis === 'h' ? a.x + a.w / 2 : a.y + a.h / 2 };
  });
  withCenter.sort((p, q) => p.center - q.center);
  const first = withCenter[0].center;
  const last = withCenter[withCenter.length - 1].center;
  const step = (last - first) / (withCenter.length - 1);

  return withCenter.map(({ it }, i) => {
    const target = first + step * i;
    const a = frameAABB(it.frame);
    const currentCenter = axis === 'h' ? a.x + a.w / 2 : a.y + a.h / 2;
    const delta = target - currentCenter;
    return {
      id: it.id,
      frame: axis === 'h' ? { ...it.frame, x: it.frame.x + delta } : { ...it.frame, y: it.frame.y + delta },
    };
  });
}
