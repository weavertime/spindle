// RemotePresenceOverlay — shows where remote collaborators are editing. Each
// peer publishes `editing: { slideId, elementId }` in awareness (see
// RichTextEditor); this draws a colored outline + name tag around that element.
// In-text remote carets are a follow-up (per-element fragments make
// y-prosemirror's yCursorPlugin unsafe), so presence is element-level for v1.

import React, { useEffect, useReducer } from 'react';
import { useDeck, useActiveSlideId } from '../hooks';

interface PresenceUser {
  name?: string;
  color?: string;
}
interface PresenceState {
  user?: PresenceUser;
  editing?: { slideId: string; elementId: string } | null;
}

export function RemotePresenceOverlay({ scale }: { scale: number }): React.ReactElement | null {
  const deck = useDeck();
  const slideId = useActiveSlideId();
  const [, force] = useReducer((n) => n + 1, 0);
  const handle = deck.getCollabHandle();

  useEffect(() => {
    if (!handle) return;
    const onChange = () => force();
    handle.awareness.on('change', onChange);
    const offEl = deck.on('elementChange', force as () => void);
    return () => {
      handle.awareness.off('change', onChange);
      offEl();
    };
  }, [handle, deck]);

  if (!handle) return null;

  const border = 2 / scale;
  const tags: React.ReactElement[] = [];

  for (const [clientId, raw] of handle.awareness.getStates() as Map<number, PresenceState>) {
    if (clientId === handle.awareness.clientID) continue;
    const editing = raw.editing;
    if (!editing || editing.slideId !== slideId) continue;
    const el = deck.getElement(editing.elementId);
    if (!el) continue;
    const color = raw.user?.color ?? '#8c54ff';
    tags.push(
      <div
        key={clientId}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: el.w,
          height: el.h,
          transform: `translate(${el.x}px, ${el.y}px) rotate(${el.rotation}deg)`,
          transformOrigin: 'center center',
          border: `${border}px solid ${color}`,
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: -18 / scale,
            left: -border,
            background: color,
            color: '#fff',
            fontSize: 11 / scale,
            lineHeight: `${16 / scale}px`,
            padding: `0 ${5 / scale}px`,
            borderRadius: 3 / scale,
            whiteSpace: 'nowrap',
          }}
        >
          {raw.user?.name ?? 'Guest'}
        </span>
      </div>
    );
  }

  if (tags.length === 0) return null;
  return <div style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>{tags}</div>;
}
