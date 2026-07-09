// Snapping + smart guides. Targets (other elements' AABB edges/centres + slide
// edges/centre) are collected once at gesture start; computeSnap runs per
// pointer move and returns the (dx, dy) nudge plus the guide lines to draw.
// Pure — the React layer supplies a screen-space threshold divided by zoom.

import type { Frame } from './types';
import { frameAABB, type Rect } from './geometry';

export interface SnapTargets {
  xs: number[];
  ys: number[];
}

export interface GuideLine {
  axis: 'x' | 'y';
  pos: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: GuideLine[];
}

/** The three snap candidate positions of a rect along each axis. */
export function boundsCandidates(rect: Rect): { xs: number[]; ys: number[] } {
  return {
    xs: [rect.x, rect.x + rect.w / 2, rect.x + rect.w],
    ys: [rect.y, rect.y + rect.h / 2, rect.y + rect.h],
  };
}

/** Collect snap lines from the other elements' AABBs and the slide bounds. */
export function collectSnapTargets(others: Frame[], slideSize: { w: number; h: number }): SnapTargets {
  const xs = new Set<number>([0, slideSize.w / 2, slideSize.w]);
  const ys = new Set<number>([0, slideSize.h / 2, slideSize.h]);
  for (const f of others) {
    const a = frameAABB(f);
    xs.add(a.x).add(a.x + a.w / 2).add(a.x + a.w);
    ys.add(a.y).add(a.y + a.h / 2).add(a.y + a.h);
  }
  return { xs: [...xs], ys: [...ys] };
}

function bestSnap(moving: number[], targets: number[], threshold: number): { delta: number; pos: number } | null {
  let best: { delta: number; pos: number } | null = null;
  for (const m of moving) {
    for (const t of targets) {
      const d = t - m;
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta))) {
        best = { delta: d, pos: t };
      }
    }
  }
  return best;
}

/**
 * Snap the moving candidate positions to the nearest targets within
 * `threshold` (slide units). Returns the nudge to apply and the guide lines.
 */
export function computeSnap(
  movingXs: number[],
  movingYs: number[],
  targets: SnapTargets,
  threshold: number
): SnapResult {
  const guides: GuideLine[] = [];
  const snapX = bestSnap(movingXs, targets.xs, threshold);
  const snapY = bestSnap(movingYs, targets.ys, threshold);
  if (snapX) guides.push({ axis: 'x', pos: snapX.pos });
  if (snapY) guides.push({ axis: 'y', pos: snapY.pos });
  return { dx: snapX?.delta ?? 0, dy: snapY?.delta ?? 0, guides };
}
