// Local snapshot undo/redo — used only when the deck is NOT attached to
// collab. Under collab, undo routes to a Y.UndoManager (Phase 5) and this
// stack is bypassed entirely, so the two never fight.
//
// Records are immutable, so a snapshot only needs to shallow-clone the maps
// (the element/slide objects are never mutated in place — mutators replace
// them).

import type { Slide, DeckSelection } from './types';
import type { SlideElement } from './scene/types';
import type { ThemeData, LayoutData } from './theme/types';

export interface DeckSnapshot {
  title: string;
  slideSize: { w: number; h: number };
  theme: ThemeData;
  layouts: LayoutData[];
  slides: Map<string, Slide>;
  elements: Map<string, SlideElement>;
  selection: DeckSelection;
  activeSlideId: string;
}

export class DeckHistory {
  private undoStack: DeckSnapshot[] = [];
  private redoStack: DeckSnapshot[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  /** Record a snapshot as the new undo point; clears the redo stack. */
  record(snapshot: DeckSnapshot): void {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxSize) this.undoStack.shift();
    this.redoStack = [];
  }

  /** Pop the last undo point, pushing `current` onto the redo stack. */
  undo(current: DeckSnapshot): DeckSnapshot | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push(current);
    return prev;
  }

  /** Pop the last redo point, pushing `current` onto the undo stack. */
  redo(current: DeckSnapshot): DeckSnapshot | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(current);
    return next;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
