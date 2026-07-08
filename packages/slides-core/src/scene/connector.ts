// Connector geometry — resolving a line's endpoints when they are bound to
// other elements' anchors, and reconstructing the line's box (x/y/w/h/flipV)
// from two endpoints. A line occupies its box diagonal; flipV selects which
// diagonal, so any two points map to a unique (box, flipV) pair. Pure + tested.

import type { AnchorId, Frame, LineElement } from './types';
import { frameCenter, rotatePoint, type Point } from './geometry';

export const ANCHOR_IDS: readonly AnchorId[] = ['n', 'e', 's', 'w', 'nw', 'ne', 'se', 'sw'];

/** Fractional (u, v) position of each anchor within the un-rotated box. */
const ANCHOR_UV: Record<AnchorId, { u: number; v: number }> = {
  nw: { u: 0, v: 0 }, n: { u: 0.5, v: 0 }, ne: { u: 1, v: 0 },
  w: { u: 0, v: 0.5 }, e: { u: 1, v: 0.5 },
  sw: { u: 0, v: 1 }, s: { u: 0.5, v: 1 }, se: { u: 1, v: 1 },
};

/** Resolve an anchor on a (possibly rotated) frame to slide coordinates. */
export function anchorPoint(f: Frame, anchor: AnchorId): Point {
  const { u, v } = ANCHOR_UV[anchor];
  const local = { x: f.x + u * f.w, y: f.y + v * f.h };
  return f.rotation ? rotatePoint(local, frameCenter(f), f.rotation) : local;
}

/** All 8 anchor points of a frame, keyed by id (screen order irrelevant). */
export function anchorPoints(f: Frame): Array<{ anchor: AnchorId; point: Point }> {
  return ANCHOR_IDS.map((anchor) => ({ anchor, point: anchorPoint(f, anchor) }));
}

/** The box corner an unbound start/end occupies, given the line's flipV. */
function freeStart(line: LineElement): Point {
  return line.flipV ? { x: line.x, y: line.y + line.h } : { x: line.x, y: line.y };
}
function freeEnd(line: LineElement): Point {
  return line.flipV ? { x: line.x + line.w, y: line.y } : { x: line.x + line.w, y: line.y + line.h };
}

export type FrameLookup = (elementId: string) => Frame | undefined;

/**
 * Resolve a line's two endpoints in slide coordinates. Bound endpoints derive
 * from the target's anchor (via `getFrame`); unbound endpoints use the box
 * corner. A binding whose target is missing falls back to the box corner.
 */
export function resolveEndpoints(line: LineElement, getFrame: FrameLookup): { start: Point; end: Point } {
  const startFrame = line.startBind && getFrame(line.startBind.elementId);
  const endFrame = line.endBind && getFrame(line.endBind.elementId);
  const start = startFrame ? anchorPoint(startFrame, line.startBind!.anchor) : freeStart(line);
  const end = endFrame ? anchorPoint(endFrame, line.endBind!.anchor) : freeEnd(line);
  return { start, end };
}

/**
 * Reconstruct a line's axis-aligned box + diagonal orientation from two
 * endpoints, so the (start → end) diagonal renders through those exact points.
 */
export function connectorBox(start: Point, end: Point): { x: number; y: number; w: number; h: number; flipV: boolean } {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);
  // Main diagonal (top-left → bottom-right) when the deltas share sign; the
  // other diagonal (flipV) when they oppose.
  const flipV = (start.x - end.x) * (start.y - end.y) < 0;
  return { x, y, w, h, flipV };
}

/** Effective box for a (possibly bound) line, resolved against `getFrame`. */
export function resolveConnectorFrame(line: LineElement, getFrame: FrameLookup): { x: number; y: number; w: number; h: number; flipV: boolean } {
  const { start, end } = resolveEndpoints(line, getFrame);
  return connectorBox(start, end);
}
