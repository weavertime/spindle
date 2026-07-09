// CommentBadgesOverlay — a small badge on each element that has comment
// threads, so commented elements are discoverable on the canvas. Re-renders on
// commentChange and element changes; purely indicative (pointer-events off).

import React, { useEffect, useReducer } from 'react';
import { MessageSquare } from 'lucide-react';
import { useDeck, useSlideElementIds } from '../hooks';
import { useDeckContext } from '../context/DeckContext';

export function CommentBadgesOverlay({ slideId, scale }: { slideId: string; scale: number }): React.ReactElement | null {
  const deck = useDeck();
  const { ui } = useDeckContext();
  const elementIds = useSlideElementIds(slideId);
  const [, force] = useReducer((n) => n + 1, 0);

  useEffect(() => {
    const offs = [deck.on('commentChange', force as () => void), deck.on('elementChange', force as () => void)];
    return () => offs.forEach((o) => o());
  }, [deck]);

  const store = deck.getComments();
  const size = 20 / scale;

  const badges = elementIds
    .map((id) => {
      const threads = store.getThreadsForElement(id);
      if (threads.length === 0) return null;
      const el = deck.getElement(id);
      if (!el) return null;
      const open = threads.some((t) => t.status === 'open');
      return (
        <div
          key={id}
          title="Open comments"
          onPointerDown={(e) => {
            e.stopPropagation();
            deck.setSelection({ slideId, elementIds: [id] });
            ui.setCommentsOpen(true);
          }}
          style={{
            position: 'absolute',
            left: el.x + el.w - size / 2,
            top: el.y - size / 2,
            width: size,
            height: size,
            borderRadius: '50% 50% 50% 0',
            background: open ? '#f5a623' : '#c4cad3',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            pointerEvents: 'auto',
            cursor: 'pointer',
          }}
        >
          <MessageSquare size={size * 0.55} />
        </div>
      );
    })
    .filter(Boolean);

  if (badges.length === 0) return null;
  return <div style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>{badges}</div>;
}
