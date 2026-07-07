// Resize/rotate math in a rotated frame's local space. The invariant that
// matters (and is property-tested): after a resize, the corner/edge OPPOSITE
// the dragged handle stays fixed in world space, at any rotation.

import type { Frame } from './types';
import type { Point } from './geometry';
import { frameCenter } from './geometry';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const MIN_SIZE = 8;

/** Normalized local coordinates (0..1) of each resize handle within the frame. */
const HANDLE_POS: Record<ResizeHandle, { x: number; y: number }> = {
  nw: { x: 0, y: 0 }, n: { x: 0.5, y: 0 }, ne: { x: 1, y: 0 },
  e: { x: 1, y: 0.5 }, se: { x: 1, y: 1 }, s: { x: 0.5, y: 1 },
  sw: { x: 0, y: 1 }, w: { x: 0, y: 0.5 },
};

export interface ResizeOptions {
  lockAspect?: boolean;
  minSize?: number;
}

function axes(rotationDeg: number): { ux: Point; uy: Point } {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { ux: { x: cos, y: sin }, uy: { x: -sin, y: cos } };
}

/**
 * Resize `frame` by dragging `handle` to world-space `pointer`, keeping the
 * opposite anchor fixed. Corners may aspect-lock; every result clamps to
 * minSize (no negative/flipped sizes in v1).
 */
export function resizeFrame(
  frame: Frame,
  handle: ResizeHandle,
  pointer: Point,
  opts: ResizeOptions = {}
): Frame {
  const minSize = opts.minSize ?? MIN_SIZE;
  const H = HANDLE_POS[handle];
  const A = { x: 1 - H.x, y: 1 - H.y }; // opposite anchor
  const { ux, uy } = axes(frame.rotation);
  const center = frameCenter(frame);

  // Anchor position in world space (stays fixed).
  const anchorWorld: Point = {
    x: center.x + (A.x - 0.5) * frame.w * ux.x + (A.y - 0.5) * frame.h * uy.x,
    y: center.y + (A.x - 0.5) * frame.w * ux.y + (A.y - 0.5) * frame.h * uy.y,
  };

  // Pointer offset from the anchor, projected onto the frame's local axes.
  const dx = pointer.x - anchorWorld.x;
  const dy = pointer.y - anchorWorld.y;
  const localDx = dx * ux.x + dy * ux.y;
  const localDy = dx * uy.x + dy * uy.y;

  const freeX = H.x - A.x; // ±1 for corner/x-edge, 0 otherwise
  const freeY = H.y - A.y;

  let w = freeX !== 0 ? localDx / freeX : frame.w;
  let h = freeY !== 0 ? localDy / freeY : frame.h;

  w = Math.max(minSize, w);
  h = Math.max(minSize, h);

  if (opts.lockAspect && freeX !== 0 && freeY !== 0) {
    const ratio = frame.w / frame.h;
    // Grow/shrink uniformly, driven by whichever axis moved more.
    const s = Math.max(w / frame.w, h / frame.h);
    w = Math.max(minSize, frame.w * s);
    h = Math.max(minSize, frame.h * s);
    // Keep exact aspect after the min clamp.
    if (w / h !== ratio) h = w / ratio;
  }

  // New centre so the anchor stays put.
  const newCenter: Point = {
    x: anchorWorld.x + (0.5 - A.x) * w * ux.x + (0.5 - A.y) * h * uy.x,
    y: anchorWorld.y + (0.5 - A.x) * w * ux.y + (0.5 - A.y) * h * uy.y,
  };

  return {
    x: newCenter.x - w / 2,
    y: newCenter.y - h / 2,
    w,
    h,
    rotation: frame.rotation,
  };
}

export interface RotateOptions {
  /** Snap to 15° increments (e.g. while Shift is held). */
  snap?: boolean;
  /** Snap radius, in degrees, around each 45° step. Default 3. */
  snapThreshold?: number;
}

function normalizeAngle(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

/**
 * Rotate `frame` about its centre so the top rotation handle points toward
 * `pointer`. Snaps within `snapThreshold`° of each 45° step; Shift snaps to
 * 15° increments.
 */
export function rotateFrame(frame: Frame, pointer: Point, opts: RotateOptions = {}): Frame {
  const c = frameCenter(frame);
  const angleToPointer = (Math.atan2(pointer.y - c.y, pointer.x - c.x) * 180) / Math.PI;
  // Handle sits above the frame (local -y); at rotation 0 it points up (-90°).
  let rotation = normalizeAngle(angleToPointer + 90);

  if (opts.snap) {
    rotation = normalizeAngle(Math.round(rotation / 15) * 15);
  } else {
    const threshold = opts.snapThreshold ?? 3;
    const nearest = Math.round(rotation / 45) * 45;
    if (Math.abs(normalizeAngle(rotation - nearest)) <= threshold) {
      rotation = normalizeAngle(nearest);
    }
  }

  return { ...frame, rotation };
}
