// History/Undo-Redo management

import type { DocumentSnapshot, HistoryEntry, Section, TextSelection } from './types';

export interface HistoryConfig {
  maxEntries?: number;
  debounceMs?: number;
}

const DEFAULT_CONFIG: HistoryConfig = {
  maxEntries: 100,
  debounceMs: 300,
};

export class DocumentHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private config: HistoryConfig;
  private lastRecordTime = 0;

  constructor(config: Partial<HistoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a snapshot of the current document state
   */
  private createSnapshot(sections: Section[], selection?: TextSelection): DocumentSnapshot {
    // Deep clone sections to avoid mutation issues
    return {
      sections: JSON.parse(JSON.stringify(sections)),
      selection: selection ? { ...selection } : undefined,
    };
  }

  /**
   * Record a new history entry
   */
  record(sections: Section[], selection?: TextSelection, description?: string): void {
    const now = Date.now();
    
    // Debounce rapid changes — but NOT right after an undo (redo pending): that
    // edit is a fresh branch, so it must create a new entry and clear the redo
    // stack (below), not fold into the pre-undo entry and leave redo stale.
    if (now - this.lastRecordTime < (this.config.debounceMs || 0) && this.redoStack.length === 0) {
      // Update the last entry instead of creating a new one
      if (this.undoStack.length > 0) {
        const lastEntry = this.undoStack[this.undoStack.length - 1];
        lastEntry.snapshot = this.createSnapshot(sections, selection);
        lastEntry.timestamp = now;
        if (description) {
          lastEntry.description = description;
        }
        return;
      }
    }
    
    this.lastRecordTime = now;
    
    const entry: HistoryEntry = {
      timestamp: now,
      snapshot: this.createSnapshot(sections, selection),
      description,
    };
    
    this.undoStack.push(entry);
    
    // Clear redo stack when new changes are made
    this.redoStack = [];
    
    // Trim history if it exceeds max entries
    if (this.undoStack.length > (this.config.maxEntries || 100)) {
      this.undoStack.shift();
    }
  }

  /**
   * Undo the last change
   */
  undo(currentSections: Section[], currentSelection?: TextSelection): DocumentSnapshot | null {
    if (this.undoStack.length === 0) {
      return null;
    }
    
    // Save current state to redo stack
    this.redoStack.push({
      timestamp: Date.now(),
      snapshot: this.createSnapshot(currentSections, currentSelection),
    });
    
    // Pop from undo stack
    const entry = this.undoStack.pop();
    return entry?.snapshot || null;
  }

  /**
   * Redo the last undone change
   */
  redo(currentSections: Section[], currentSelection?: TextSelection): DocumentSnapshot | null {
    if (this.redoStack.length === 0) {
      return null;
    }
    
    // Save current state to undo stack
    this.undoStack.push({
      timestamp: Date.now(),
      snapshot: this.createSnapshot(currentSections, currentSelection),
    });
    
    // Pop from redo stack
    const entry = this.redoStack.pop();
    return entry?.snapshot || null;
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
    this.lastRecordTime = 0;
  }

  getUndoStackSize(): number {
    return this.undoStack.length;
  }

  getRedoStackSize(): number {
    return this.redoStack.length;
  }
}

