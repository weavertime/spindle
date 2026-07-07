// Keyboard shortcuts, attached to the editor's focused wrapper (not window) so
// they don't fire globally. When editing text or focused in an input, only
// Escape is handled here (the PM keymap owns the rest — Phase 3). Returns an
// onKeyDown handler for the editor root (which must be focusable, tabIndex 0).

import { useCallback } from 'react';
import type React from 'react';
import { useDeck } from './index';
import { copyElements, pasteElements } from './useClipboard';

const NUDGE = 1;
const NUDGE_LARGE = 10;

function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

export function useKeyboardShortcuts(): { onKeyDown: (e: React.KeyboardEvent) => void } {
  const deck = useDeck();

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const selectedIds = () => deck.getSelection().elementIds;

      if (isTextEntry(e.target)) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }

      switch (e.key) {
        case 'Escape':
          deck.setSelection({ slideId: deck.getActiveSlideId(), elementIds: [] });
          return;
        case 'Delete':
        case 'Backspace': {
          const ids = selectedIds();
          if (ids.length) {
            deck.deleteElements(ids);
            deck.setSelection({ slideId: deck.getActiveSlideId(), elementIds: [] });
            e.preventDefault();
          }
          return;
        }
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          const ids = selectedIds();
          if (!ids.length) return;
          const d = e.shiftKey ? NUDGE_LARGE : NUDGE;
          const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
          const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
          deck.moveElements(ids, dx, dy);
          e.preventDefault();
          return;
        }
        case 'Tab': {
          const slideId = deck.getActiveSlideId();
          const all = deck.getElementIdsForSlide(slideId);
          if (!all.length) return;
          const cur = selectedIds();
          const idx = cur.length ? all.indexOf(cur[cur.length - 1]) : -1;
          const next = all[(idx + (e.shiftKey ? -1 + all.length : 1)) % all.length];
          deck.setSelection({ slideId, elementIds: [next] });
          e.preventDefault();
          return;
        }
      }

      if (!mod) return;

      const key = e.key.toLowerCase();
      switch (key) {
        case 'z':
          if (e.shiftKey) deck.redo();
          else deck.undo();
          e.preventDefault();
          break;
        case 'y':
          deck.redo();
          e.preventDefault();
          break;
        case 'a': {
          const slideId = deck.getActiveSlideId();
          deck.setSelection({ slideId, elementIds: deck.getElementIdsForSlide(slideId) });
          e.preventDefault();
          break;
        }
        case 'd': {
          const ids = selectedIds();
          const copies = ids.map((id) => deck.duplicateElement(id)).filter(Boolean);
          if (copies.length) {
            deck.setSelection({ slideId: deck.getActiveSlideId(), elementIds: copies.map((c) => c!.id) });
          }
          e.preventDefault();
          break;
        }
        case 'c':
          copyElements(deck);
          e.preventDefault();
          break;
        case 'x':
          copyElements(deck);
          deck.deleteElements(selectedIds());
          deck.setSelection({ slideId: deck.getActiveSlideId(), elementIds: [] });
          e.preventDefault();
          break;
        case 'v':
          pasteElements(deck);
          e.preventDefault();
          break;
        case 'g':
          if (e.shiftKey) deck.ungroupElements(selectedIds());
          else deck.groupElements(selectedIds());
          e.preventDefault();
          break;
        case ']':
          if (e.shiftKey) deck.bringToFront(selectedIds());
          else deck.bringForward(selectedIds());
          e.preventDefault();
          break;
        case '[':
          if (e.shiftKey) deck.sendToBack(selectedIds());
          else deck.sendBackward(selectedIds());
          e.preventDefault();
          break;
      }
    },
    [deck]
  );

  return { onKeyDown };
}
