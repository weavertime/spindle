// InteractiveSlide — the editable stage surface. Owns the scaled slide box,
// delegates pointerdown to the right gesture (resize/rotate handle, element
// move, or empty-space marquee), and installs window listeners for the drag.
// All per-move work happens in the gesture controller (direct-to-DOM); React
// only re-renders on the commit at pointerup.

import React, { useRef } from 'react';
import type { DeckImpl, ResizeHandle } from '@weavertime/spindle-slides-core';
import { useDeck } from '../hooks';
import { useDeckContext } from '../context/DeckContext';
import { SlideView } from './SlideView';
import { GuidesOverlay } from './GuidesOverlay';
import { SelectionOverlay } from './SelectionOverlay';
import { RemotePresenceOverlay } from './RemotePresenceOverlay';
import { CommentBadgesOverlay } from './CommentBadgesOverlay';
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

export function InteractiveSlide({ slideId, scale }: { slideId: string; scale: number }): React.ReactElement {
  const deck = useDeck();
  const { nodes, transient, editing } = useDeckContext();
  const { w, h } = deck.getSlideSize();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const lastDown = useRef<{ id: string; t: number }>({ id: '', t: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const surface = surfaceRef.current;
    if (!surface) return;
    // Any pointerdown that reaches the surface is outside the live editor (the
    // editor stops propagation on its own pointerdowns), so this is a genuine
    // "click away" → leave edit mode. The editor's blur commits the text.
    if (editing.getEditingId()) editing.setEditingId(null);
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
    const rotateEl = target.closest('[data-rotate]');
    const handleEl = target.closest('[data-handle]') as HTMLElement | null;
    const elEl = target.closest('[data-element-id]') as HTMLElement | null;

    let gesture: Gesture;
    if (rotateEl) {
      gesture = createRotateGesture(ctx, deck.getSelection().elementIds, { shiftKey: e.shiftKey });
    } else if (handleEl?.dataset.handle) {
      gesture = createResizeGesture(ctx, handleEl.dataset.handle as ResizeHandle, deck.getSelection().elementIds, {
        shiftKey: e.shiftKey,
      });
    } else if (elEl?.dataset.elementId) {
      const id = elEl.dataset.elementId;
      const el = deck.getElement(id);
      // A second pointerdown on the same element within 400ms is a double-click
      // → enter text edit instead of starting a move. Timing-based (not a
      // separate onDoubleClick) because the pointerdown preventDefault below
      // swallows the native dblclick, and pointerdown `detail` is unreliable.
      const now = Date.now();
      const isDouble = lastDown.current.id === id && now - lastDown.current.t < 400;
      lastDown.current = { id, t: now };
      if (isDouble && el && (el.type === 'text' || el.type === 'shape')) {
        deck.setSelection({ slideId, elementIds: [id] });
        editing.setEditingId(id);
        e.preventDefault();
        return;
      }
      const ids = selectOnDown(deck, slideId, id, e.shiftKey);
      gesture = createMoveGesture(ctx, toSlide(e.clientX, e.clientY), ids);
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
      style={{ position: 'relative', width: w * scale, height: h * scale, flex: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.16)' }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: 'top left', width: w, height: h }}>
        <SlideView slideId={slideId} interactive />
        <GuidesOverlay scale={scale} />
        <CommentBadgesOverlay slideId={slideId} scale={scale} />
        <RemotePresenceOverlay scale={scale} />
        <SelectionOverlay scale={scale} />
      </div>
    </div>
  );
}
