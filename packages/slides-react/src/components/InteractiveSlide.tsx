// InteractiveSlide — the editable stage surface. Owns the scaled slide box,
// delegates pointerdown to the right gesture (resize/rotate handle, element
// move, or empty-space marquee), and installs window listeners for the drag.
// All per-move work happens in the gesture controller (direct-to-DOM); React
// only re-renders on the commit at pointerup.

import React, { useRef } from 'react';
import { anchorPoint, connectorBox, resolveEndpoints, type AnchorId, type DeckImpl, type Frame, type NewElementSpec, type ResizeHandle } from '@weavertime/spindle-slides-core';
import { useDeck } from '../hooks';
import { useDeckContext } from '../context/DeckContext';
import { SlideView } from './SlideView';
import { GuidesOverlay } from './GuidesOverlay';
import { SelectionOverlay } from './SelectionOverlay';
import { RemotePresenceOverlay } from './RemotePresenceOverlay';
import { CommentBadgesOverlay } from './CommentBadgesOverlay';
import { ConnectionPointsOverlay } from './ConnectionPointsOverlay';
import { elementUnderPoint, nearestAnchor } from '../interactions/connector-hit';
import { screenToSlide } from '../interactions/coords';
import {
  createMoveGesture,
  createResizeGesture,
  createRotateGesture,
  createMarqueeGesture,
  expandGroups,
  type GestureContext,
  type Gesture,
} from '../interactions/gesture';

/** Update selection on pointerdown; returns the resulting selected ids. */
function selectOnDown(deck: DeckImpl, slideId: string, id: string, shift: boolean): string[] {
  const cur = deck.getSelection().elementIds;
  const groupIds = expandGroups(deck, [id]);
  if (shift) {
    const isSelected = cur.includes(id);
    const next = isSelected
      ? cur.filter((x) => !groupIds.includes(x))
      : Array.from(new Set([...cur, ...groupIds]));
    deck.setSelection({ slideId, elementIds: next });
    return next;
  }
  if (cur.includes(id)) return cur; // keep multi-selection so a drag moves it all
  deck.setSelection({ slideId, elementIds: groupIds });
  return groupIds;
}

const ANCHOR_GRAB = 16; // slide px: snap radius + hover margin for connection dots

function frameOf(el: { x: number; y: number; w: number; h: number; rotation: number }): Frame {
  return { x: el.x, y: el.y, w: el.w, h: el.h, rotation: el.rotation };
}

export function InteractiveSlide({ slideId, scale }: { slideId: string; scale: number }): React.ReactElement {
  const deck = useDeck();
  const { nodes, transient, editing, connectors } = useDeckContext();
  const { w, h } = deck.getSlideSize();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const lastDown = useRef<{ id: string; t: number }>({ id: '', t: 0 });

  // Hover (no button pressed) → show the shape's connection dots, unless it is
  // the selected element (its resize handles own the corners then).
  const onHoverMove = (e: React.PointerEvent) => {
    if (e.buttons !== 0) return;
    const surface = surfaceRef.current;
    if (!surface || connectors.get().draft) return;
    const rect = surface.getBoundingClientRect();
    const p = screenToSlide(e.clientX, e.clientY, { rect: { left: rect.left, top: rect.top }, scale });
    let id = elementUnderPoint(deck, slideId, p, ANCHOR_GRAB);
    if (id && deck.getSelection().elementIds.includes(id)) id = null;
    connectors.setHover(id);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const surface = surfaceRef.current;
    if (!surface) return;
    // Any pointerdown that reaches the surface is outside the live editor (the
    // editor stops propagation on its own pointerdowns), so this is a genuine
    // "click away" → leave edit mode. The editor's blur commits the text.
    if (editing.getEditingId()) editing.setEditingId(null);
    // Focus the surface so keyboard shortcuts (Delete, arrows, ⌘Z) fire — they
    // live on the editor root, and keydown only bubbles there if focus is inside
    // it. (A text-edit gesture re-focuses the ProseMirror editor afterwards.)
    surface.focus({ preventScroll: true });
    const rect = surface.getBoundingClientRect();
    const metrics = { rect: { left: rect.left, top: rect.top }, scale };
    const toSlide = (clientX: number, clientY: number) => screenToSlide(clientX, clientY, metrics);

    const ctx: GestureContext = {
      deck,
      nodes,
      transient,
      slideId,
      slideSize: { w, h },
      snapThreshold: 5 / scale,
    };

    const target = e.target as HTMLElement;
    const connectEl = target.closest('[data-connect-anchor]') as HTMLElement | null;
    // Any pointerdown that isn't starting a connector clears the hover dots, so
    // they never linger over a shape's resize handles once it's selected.
    if (!connectEl) connectors.setHover(null);
    const endpointEl = target.closest('[data-endpoint]') as HTMLElement | null;
    const rotateEl = target.closest('[data-rotate]');
    const handleEl = target.closest('[data-handle]') as HTMLElement | null;
    const elEl = target.closest('[data-element-id]') as HTMLElement | null;

    let gesture: Gesture;
    if (endpointEl?.dataset.endpoint) {
      // Drag a selected line's tip: resize + rotate at once. The tip snaps to a
      // shape anchor and binds on release, or stays a free point. Previewed live
      // via the connector store's edit state (committed once at pointerup).
      const which = endpointEl.dataset.endpoint as 'start' | 'end';
      const lineId = deck.getSelection().elementIds[0];
      const lineEl = lineId ? deck.getElement(lineId) : undefined;
      if (!lineEl || lineEl.type !== 'line') return;
      const getFrame = (elId: string): Frame | undefined => { const el = deck.getElement(elId); return el ? frameOf(el) : undefined; };
      const orig = resolveEndpoints(lineEl, getFrame)[which];
      gesture = {
        onMove(p) {
          const snap = nearestAnchor(deck, slideId, p, lineId, ANCHOR_GRAB / scale);
          const over = snap ? snap.elementId : elementUnderPoint(deck, slideId, p, 0);
          connectors.setEdit({ elementId: lineId, end: which, point: snap ? snap.point : p, snap: snap ? { elementId: snap.elementId, anchor: snap.anchor } : null, overElementId: over });
        },
        onEnd() {
          const ed = connectors.get().edit;
          connectors.setEdit(null);
          if (!ed || Math.hypot(ed.point.x - orig.x, ed.point.y - orig.y) <= 3 / scale) return;
          if (ed.snap) deck.setLineEndpoint(lineId, which, { bind: { elementId: ed.snap.elementId, anchor: ed.snap.anchor } });
          else deck.setLineEndpoint(lineId, which, { point: { x: ed.point.x, y: ed.point.y } });
        },
      };
    } else if (connectEl?.dataset.connectAnchor) {
      // Draw a connector from this shape's anchor. The endpoint tracks the
      // cursor, snapping to the nearest anchor of any other shape; on release it
      // binds to that anchor (or hangs free in mid-air). Previewed live via the
      // connector store — the element is only created at pointerup.
      const fromElementId = connectEl.dataset.connectElement!;
      const fromAnchor = connectEl.dataset.connectAnchor as AnchorId;
      const srcEl = deck.getElement(fromElementId);
      if (!srcEl) return;
      const from = anchorPoint(frameOf(srcEl), fromAnchor);
      connectors.setHover(null);
      connectors.setDraft({ fromElementId, fromAnchor, from, to: from, snap: null, overElementId: null });
      let moved = false;
      gesture = {
        onMove(p) {
          if (Math.hypot(p.x - from.x, p.y - from.y) > 3 / scale) moved = true;
          const snap = nearestAnchor(deck, slideId, p, fromElementId, ANCHOR_GRAB / scale);
          const over = snap ? snap.elementId : elementUnderPoint(deck, slideId, p, 0);
          connectors.setDraft({
            fromElementId, fromAnchor, from,
            to: snap ? snap.point : p,
            snap: snap ? { elementId: snap.elementId, anchor: snap.anchor } : null,
            overElementId: over,
          });
        },
        onEnd() {
          const d = connectors.get().draft;
          connectors.setDraft(null);
          if (!moved || !d) return;
          const box = connectorBox(d.from, d.to);
          const spec: NewElementSpec = {
            type: 'line',
            startBind: { elementId: fromElementId, anchor: fromAnchor },
            endArrow: 'triangle',
            x: box.x, y: box.y, w: box.w, h: box.h, flipV: box.flipV,
            // Bound end → track the anchor; free end → pin the explicit drop
            // point (the box corner alone can't say which end is the free one).
            ...(d.snap ? { endBind: { elementId: d.snap.elementId, anchor: d.snap.anchor } } : { endPoint: { x: d.to.x, y: d.to.y } }),
          } as NewElementSpec;
          const el = deck.addElement(slideId, spec);
          deck.setSelection({ slideId, elementIds: [el.id] });
        },
      };
    } else if (rotateEl) {
      gesture = createRotateGesture(ctx, deck.getSelection().elementIds, { shiftKey: e.shiftKey });
    } else if (handleEl?.dataset.handle) {
      gesture = createResizeGesture(ctx, handleEl.dataset.handle as ResizeHandle, deck.getSelection().elementIds, {
        shiftKey: e.shiftKey,
      });
    } else if (elEl?.dataset.elementId) {
      const id = elEl.dataset.elementId;
      const el = deck.getElement(id);
      // A second pointerdown on the same element within 400ms is a double-click.
      // But only enter text edit if it does NOT turn into a drag — otherwise a
      // quick select-then-drag would wrongly open the editor. So we always start
      // a move gesture and, at pointerup, enter edit only when nothing moved.
      const now = Date.now();
      const isDouble = lastDown.current.id === id && now - lastDown.current.t < 400;
      lastDown.current = { id, t: now };
      const ids = selectOnDown(deck, slideId, id, e.shiftKey);
      const move = createMoveGesture(ctx, toSlide(e.clientX, e.clientY), ids);
      // For a table, a double-click edits the specific cell under the pointer.
      const cellAttr = (e.target as HTMLElement).closest('[data-cell]')?.getAttribute('data-cell');
      const cell = el?.type === 'table' && cellAttr ? (cellAttr.split(',').map(Number) as [number, number]) : null;
      const canEdit = isDouble && !!el && (el.type === 'text' || el.type === 'shape' || (el.type === 'table' && !!cell));
      const startP = toSlide(e.clientX, e.clientY);
      let moved = false;
      gesture = {
        onMove(p) {
          if (Math.hypot(p.x - startP.x, p.y - startP.y) > 3 / scale) moved = true;
          move.onMove(p);
        },
        onEnd() {
          move.onEnd();
          if (canEdit && !moved) {
            deck.setSelection({ slideId, elementIds: [id] });
            editing.setEditingId(id, cell);
          }
        },
      };
    } else {
      if (!e.shiftKey) deck.setSelection({ slideId, elementIds: [] });
      gesture = createMarqueeGesture(ctx, toSlide(e.clientX, e.clientY), e.shiftKey, deck.getSelection().elementIds);
    }

    const onMove = (ev: PointerEvent) => gesture.onMove(toSlide(ev.clientX, ev.clientY));
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      gesture.onEnd();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    e.preventDefault();
  };

  return (
    <div
      ref={surfaceRef}
      onPointerDown={onPointerDown}
      onPointerMove={onHoverMove}
      onPointerLeave={() => connectors.setHover(null)}
      tabIndex={-1}
      style={{ position: 'relative', width: w * scale, height: h * scale, flex: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.16)', outline: 'none' }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: 'top left', width: w, height: h }}>
        <SlideView slideId={slideId} interactive />
        <GuidesOverlay scale={scale} />
        <RemotePresenceOverlay scale={scale} />
        <SelectionOverlay scale={scale} />
        <ConnectionPointsOverlay scale={scale} />
        {/* Badges last so they stay clickable on top of the selection handles. */}
        <CommentBadgesOverlay slideId={slideId} scale={scale} />
      </div>
    </div>
  );
}
