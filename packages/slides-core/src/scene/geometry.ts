// Rotated-rectangle geometry. Frames rotate clockwise (matching CSS
// `rotate()` in screen coordinates, y-down) about their centre. Everything
// here is pure and unit-tested; the React layer only calls it for marquee
// hit-testing and snap bounds (element hit-testing is done by the DOM).

import type { Frame } from './types';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEG = Math.PI / 180;

export function frameCenter(f: Frame): Point {
  return { x: f.x + f.w / 2, y: f.y + f.h / 2 };
}

/** Rotate a point about a centre by `deg` (clockwise, y-down). */
export function rotatePoint(p: Point, center: Point, deg: number): Point {
  if (deg === 0) return { x: p.x, y: p.y };
  const rad = deg * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/** The four rotated corners of a frame: [topLeft, topRight, bottomRight, bottomLeft]. */
export function frameCorners(f: Frame): [Point, Point, Point, Point] {
  const c = frameCenter(f);
  const tl = rotatePoint({ x: f.x, y: f.y }, c, f.rotation);
  const tr = rotatePoint({ x: f.x + f.w, y: f.y }, c, f.rotation);
  const br = rotatePoint({ x: f.x + f.w, y: f.y + f.h }, c, f.rotation);
  const bl = rotatePoint({ x: f.x, y: f.y + f.h }, c, f.rotation);
  return [tl, tr, br, bl];
}

/** Axis-aligned bounding box enclosing the rotated frame. */
export function frameAABB(f: Frame): Rect {
  if (f.rotation === 0) return { x: f.x, y: f.y, w: f.w, h: f.h };
  const corners = frameCorners(f);
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

/** Map a world point into a frame's un-rotated local coordinates. */
export function toLocal(p: Point, f: Frame): Point {
  const c = frameCenter(f);
  const rad = f.rotation * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  // Inverse rotation, then shift origin to the frame's top-left.
  return {
    x: f.w / 2 + (dx * cos + dy * sin),
    y: f.h / 2 + (-dx * sin + dy * cos),
  };
}

/** Whether a world point falls inside a (possibly rotated) frame. */
export function pointInFrame(p: Point, f: Frame): boolean {
  const local = toLocal(p, f);
  return local.x >= 0 && local.x <= f.w && local.y >= 0 && local.y <= f.h;
}

function polygonForRect(r: Rect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

/** Separating-axis test for two convex polygons. */
function polygonsIntersect(a: Point[], b: Point[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      // Axis = edge normal.
      const axis = { x: -(p2.y - p1.y), y: p2.x - p1.x };
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const p of a) {
        const proj = p.x * axis.x + p.y * axis.y;
        minA = Math.min(minA, proj);
        maxA = Math.max(maxA, proj);
      }
      for (const p of b) {
        const proj = p.x * axis.x + p.y * axis.y;
        minB = Math.min(minB, proj);
        maxB = Math.max(maxB, proj);
      }
      if (maxA < minB || maxB < minA) return false; // gap on this axis → disjoint
    }
  }
  return true;
}

/** Whether a rotated frame intersects an axis-aligned rectangle (marquee). */
export function frameIntersectsRect(f: Frame, rect: Rect): boolean {
  // Cheap AABB reject first.
  const aabb = frameAABB(f);
  if (aabb.x > rect.x + rect.w || aabb.x + aabb.w < rect.x || aabb.y > rect.y + rect.h || aabb.y + aabb.h < rect.y) {
    return false;
  }
  return polygonsIntersect(frameCorners(f), polygonForRect(rect));
}

/** Whether an axis-aligned rectangle fully contains a rotated frame. */
export function rectContainsFrame(rect: Rect, f: Frame): boolean {
  return frameCorners(f).every(
    (p) => p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h
  );
}

/** Normalize a rect defined by two corner points (any drag direction). */
export function rectFromPoints(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/** The AABB enclosing several frames (their union). */
export function unionAABB(frames: Frame[]): Rect | null {
  if (frames.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of frames) {
    const a = frameAABB(f);
    minX = Math.min(minX, a.x);
    minY = Math.min(minY, a.y);
    maxX = Math.max(maxX, a.x + a.w);
    maxY = Math.max(maxY, a.y + a.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
