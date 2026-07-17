import { DocumentHistory } from './history';
import { createSection } from './document';
import { createParagraphFromText } from './blocks/paragraph';
import type { Section } from './types';

// debounceMs: 0 so each record() is its own entry (the default 300ms debounce
// would merge rapid records and make the stacks non-deterministic in a test).
const history = () => new DocumentHistory({ debounceMs: 0 });
const sectionsWith = (text: string): Section[] => [createSection(undefined, [createParagraphFromText(text)])];

describe('DocumentHistory', () => {
  it('records onto the undo stack and moves entries across undo/redo', () => {
    const h = history();
    expect(h.canUndo()).toBe(false);
    h.record(sectionsWith('A'));
    h.record(sectionsWith('B'));
    expect(h.getUndoStackSize()).toBe(2);
    expect(h.canUndo()).toBe(true);

    expect(h.undo(sectionsWith('current'))).not.toBeNull();
    expect(h.getUndoStackSize()).toBe(1);
    expect(h.getRedoStackSize()).toBe(1);
    expect(h.canRedo()).toBe(true);

    expect(h.redo(sectionsWith('current2'))).not.toBeNull();
    expect(h.getRedoStackSize()).toBe(0);
  });

  it('returns null when there is nothing to undo or redo', () => {
    const h = history();
    expect(h.undo(sectionsWith('x'))).toBeNull();
    expect(h.redo(sectionsWith('x'))).toBeNull();
  });

  it('clears the redo stack when a new change is recorded', () => {
    const h = history();
    h.record(sectionsWith('A'));
    h.undo(sectionsWith('B'));
    expect(h.canRedo()).toBe(true);
    h.record(sectionsWith('C'));
    expect(h.canRedo()).toBe(false);
  });

  it('an edit within the debounce window after an undo clears redo (not folds)', () => {
    // The default 300ms debounce would previously return early before clearing
    // redo, leaving a stale redo entry and clobbering the pre-undo undo entry.
    const h = new DocumentHistory({ debounceMs: 300 });
    h.record(sectionsWith('A'));
    h.record(sectionsWith('B')); // folds into A under debounce → one entry
    h.undo(sectionsWith('cur'));
    expect(h.canRedo()).toBe(true);
    h.record(sectionsWith('C')); // fresh branch within the debounce window
    expect(h.canRedo()).toBe(false); // redo cleared
    expect(h.canUndo()).toBe(true); // the new edit is its own entry
  });

  it('deep-clones snapshots so post-record mutation does not leak in', () => {
    const h = history();
    const sections = sectionsWith('original');
    h.record(sections);
    // Mutate the live sections after recording.
    sections[0].blocks = [];
    const snap = h.undo(sectionsWith('x'));
    expect(JSON.stringify(snap!.sections)).toContain('original');
  });

  it('trims the undo stack at maxEntries', () => {
    const h = new DocumentHistory({ debounceMs: 0, maxEntries: 3 });
    for (let i = 0; i < 5; i++) h.record(sectionsWith(`s${i}`));
    expect(h.getUndoStackSize()).toBe(3);
  });

  it('clear empties both stacks', () => {
    const h = history();
    h.record(sectionsWith('A'));
    h.undo(sectionsWith('B'));
    h.clear();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
  });
});
