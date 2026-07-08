import { anchorPoint, resolveEndpoints, connectorBox, resolveConnectorFrame } from './connector';
import type { Frame, LineElement } from './types';

const f = (x: number, y: number, w: number, h: number, rotation = 0): Frame => ({ x, y, w, h, rotation });

const line = (over: Partial<LineElement>): LineElement => ({
  id: 'l', containerId: 's', index: 'a', type: 'line',
  x: 0, y: 0, w: 100, h: 100, rotation: 0,
  stroke: { color: { kind: 'rgb', hex: '#000' }, width: 2 },
  ...over,
});

describe('anchorPoint', () => {
  const box = f(100, 200, 200, 100);
  it('resolves edge midpoints', () => {
    expect(anchorPoint(box, 'n')).toEqual({ x: 200, y: 200 });
    expect(anchorPoint(box, 's')).toEqual({ x: 200, y: 300 });
    expect(anchorPoint(box, 'w')).toEqual({ x: 100, y: 250 });
    expect(anchorPoint(box, 'e')).toEqual({ x: 300, y: 250 });
  });
  it('resolves corners', () => {
    expect(anchorPoint(box, 'nw')).toEqual({ x: 100, y: 200 });
    expect(anchorPoint(box, 'se')).toEqual({ x: 300, y: 300 });
  });
  it('rotates the anchor with the frame', () => {
    // 180° about centre maps 'nw' to 'se'.
    const p = anchorPoint(f(0, 0, 100, 100, 180), 'nw');
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(100);
  });
});

describe('connectorBox round-trips endpoints', () => {
  it('main diagonal (no flip)', () => {
    const b = connectorBox({ x: 10, y: 20 }, { x: 110, y: 220 });
    expect(b).toEqual({ x: 10, y: 20, w: 100, h: 200, flipV: false });
  });
  it('anti-diagonal (flip)', () => {
    const b = connectorBox({ x: 10, y: 220 }, { x: 110, y: 20 });
    expect(b).toEqual({ x: 10, y: 20, w: 100, h: 200, flipV: true });
  });
  it('start below-right of end still reconstructs the same box', () => {
    const b = connectorBox({ x: 110, y: 220 }, { x: 10, y: 20 });
    expect(b).toEqual({ x: 10, y: 20, w: 100, h: 200, flipV: false });
  });
});

describe('resolveEndpoints', () => {
  const frames: Record<string, Frame> = { A: f(0, 0, 100, 100), B: f(400, 400, 100, 100) };
  const getFrame = (id: string) => frames[id];

  it('uses box corners when unbound', () => {
    const { start, end } = resolveEndpoints(line({ x: 10, y: 10, w: 90, h: 90 }), getFrame);
    expect(start).toEqual({ x: 10, y: 10 });
    expect(end).toEqual({ x: 100, y: 100 });
  });

  it('binds start to a target anchor, end stays free', () => {
    const { start, end } = resolveEndpoints(
      line({ x: 200, y: 200, w: 50, h: 50, startBind: { elementId: 'A', anchor: 'e' } }),
      getFrame
    );
    expect(start).toEqual({ x: 100, y: 50 }); // A's east midpoint
    expect(end).toEqual({ x: 250, y: 250 }); // free box end corner
  });

  it('binds both ends', () => {
    const { start, end } = resolveEndpoints(
      line({ startBind: { elementId: 'A', anchor: 'se' }, endBind: { elementId: 'B', anchor: 'nw' } }),
      getFrame
    );
    expect(start).toEqual({ x: 100, y: 100 });
    expect(end).toEqual({ x: 400, y: 400 });
  });

  it('uses an explicit free point for an unbound end (mid-air connector)', () => {
    // Bound start to A (east = 100,50); free end dropped up-left at (40,20).
    // The box corner would ambiguously coincide with the source — the explicit
    // point must win so the connector is not zero-length/invisible.
    const line = { id: 'l', containerId: 's', index: 'a', type: 'line' as const,
      x: 40, y: 20, w: 60, h: 30, rotation: 0, stroke: { color: { kind: 'rgb' as const, hex: '#000' }, width: 2 },
      startBind: { elementId: 'A', anchor: 'e' as const }, endPoint: { x: 40, y: 20 } };
    const { start, end } = resolveEndpoints(line, getFrame);
    expect(start).toEqual({ x: 100, y: 50 });
    expect(end).toEqual({ x: 40, y: 20 });
    // Not zero-length.
    expect(start).not.toEqual(end);
  });

  it('falls back to box corner when a bound target is missing', () => {
    const { start } = resolveEndpoints(
      line({ x: 5, y: 6, w: 10, h: 10, startBind: { elementId: 'gone', anchor: 'n' } }),
      getFrame
    );
    expect(start).toEqual({ x: 5, y: 6 });
  });
});

describe('resolveConnectorFrame', () => {
  it('produces a box whose diagonal hits both bound anchors', () => {
    const frames: Record<string, Frame> = { A: f(0, 0, 100, 100), B: f(300, 200, 100, 100) };
    const box = resolveConnectorFrame(
      line({ startBind: { elementId: 'A', anchor: 'e' }, endBind: { elementId: 'B', anchor: 'w' } }),
      (id) => frames[id]
    );
    // A east = (100,50); B west = (300,250).
    expect(box).toEqual({ x: 100, y: 50, w: 200, h: 200, flipV: false });
  });
});
