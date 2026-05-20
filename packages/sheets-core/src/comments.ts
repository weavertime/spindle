// Comment threads for a sheet.
//
// A thread is anchored to a single cell by its STABLE rowId/colId, so it stays
// attached to the right cell across row/column inserts, deletes and sorts. If
// the anchored row or column is itself deleted the thread is "orphaned" — it is
// kept (so nothing is silently lost) but no longer resolves to a cell.
//
// The store owns the in-memory thread map and notifies a single listener after
// every mutation. WorkbookImpl wires that listener to (a) emit a `commentChange`
// event for the UI and (b) mirror the threads into the Y.Doc when collab is on.

import type { Comment, CommentThread } from '@pagent-libs/shared';
import { generateId } from './utils/id';

// Re-export the shared comment vocabulary so consumers of sheets-core get the
// full set of types without depending on @pagent-libs/shared directly.
export type { Comment, CommentThread, CommentStatus } from '@pagent-libs/shared';

/** Stable-ID pointer to the cell a thread is anchored to. */
export interface CellCommentAnchor {
  rowId: string;
  colId: string;
}

export type SheetCommentThread = CommentThread<CellCommentAnchor>;

/** Identity of whoever is creating a comment or resolving a thread. */
export interface CommentAuthor {
  id: string;
  name: string;
}

function now(): string {
  return new Date().toISOString();
}

export class CommentStore {
  private threads: Map<string, SheetCommentThread> = new Map();
  private changeListener: (() => void) | undefined;

  /** @internal Wired by WorkbookImpl to mirror + emit on every mutation. */
  __setChangeListener(listener: (() => void) | undefined): void {
    this.changeListener = listener;
  }

  private notifyChange(): void {
    this.changeListener?.();
  }

  // --- Queries -------------------------------------------------------------

  /** All threads, in insertion order. */
  getThreads(): SheetCommentThread[] {
    return [...this.threads.values()];
  }

  getThread(threadId: string): SheetCommentThread | undefined {
    return this.threads.get(threadId);
  }

  getThreadsForCell(rowId: string, colId: string): SheetCommentThread[] {
    return this.getThreads().filter(
      (t) => t.anchor.rowId === rowId && t.anchor.colId === colId,
    );
  }

  /** True when the cell has at least one open (unresolved) thread. */
  hasOpenThread(rowId: string, colId: string): boolean {
    for (const t of this.threads.values()) {
      if (t.anchor.rowId === rowId && t.anchor.colId === colId && t.status === 'open') {
        return true;
      }
    }
    return false;
  }

  // --- Mutations -----------------------------------------------------------

  /** Create a new thread anchored to a cell, seeded with its root comment. */
  addThread(anchor: CellCommentAnchor, body: string, author: CommentAuthor): SheetCommentThread {
    const timestamp = now();
    const thread: SheetCommentThread = {
      id: generateId(),
      anchor: { ...anchor },
      status: 'open',
      createdAt: timestamp,
      comments: [
        {
          id: generateId(),
          authorId: author.id,
          authorName: author.name,
          body,
          createdAt: timestamp,
        },
      ],
    };
    this.threads.set(thread.id, thread);
    this.notifyChange();
    return thread;
  }

  /** Append a reply to an existing thread. */
  addReply(threadId: string, body: string, author: CommentAuthor): Comment | undefined {
    const thread = this.threads.get(threadId);
    if (!thread) return undefined;
    const comment: Comment = {
      id: generateId(),
      authorId: author.id,
      authorName: author.name,
      body,
      createdAt: now(),
    };
    thread.comments.push(comment);
    this.notifyChange();
    return comment;
  }

  /** Edit the body of a single comment. */
  editComment(threadId: string, commentId: string, body: string): void {
    const thread = this.threads.get(threadId);
    if (!thread) return;
    const comment = thread.comments.find((c) => c.id === commentId);
    if (!comment) return;
    comment.body = body;
    comment.editedAt = now();
    this.notifyChange();
  }

  /** Remove a comment. Removing the last comment removes the whole thread. */
  deleteComment(threadId: string, commentId: string): void {
    const thread = this.threads.get(threadId);
    if (!thread) return;
    const idx = thread.comments.findIndex((c) => c.id === commentId);
    if (idx === -1) return;
    thread.comments.splice(idx, 1);
    if (thread.comments.length === 0) {
      this.threads.delete(threadId);
    }
    this.notifyChange();
  }

  /** Remove a thread and all its comments. */
  deleteThread(threadId: string): void {
    if (this.threads.delete(threadId)) {
      this.notifyChange();
    }
  }

  resolveThread(threadId: string, by: CommentAuthor): void {
    const thread = this.threads.get(threadId);
    if (!thread || thread.status === 'resolved') return;
    thread.status = 'resolved';
    thread.resolvedBy = by.id;
    thread.resolvedAt = now();
    this.notifyChange();
  }

  reopenThread(threadId: string): void {
    const thread = this.threads.get(threadId);
    if (!thread || thread.status === 'open') return;
    thread.status = 'open';
    delete thread.resolvedBy;
    delete thread.resolvedAt;
    this.notifyChange();
  }

  // --- Serialization -------------------------------------------------------

  /** Snapshot the threads as plain JSON (for getData / Y.Doc mirroring). */
  toJSON(): SheetCommentThread[] {
    return this.getThreads().map((t) => ({
      ...t,
      anchor: { ...t.anchor },
      comments: t.comments.map((c) => ({ ...c })),
    }));
  }

  /** Replace all threads from serialized data. Does NOT notify listeners. */
  loadJSON(threads: SheetCommentThread[] | undefined): void {
    this.threads.clear();
    if (!threads) return;
    for (const t of threads) {
      this.threads.set(t.id, {
        ...t,
        anchor: { ...t.anchor },
        comments: t.comments.map((c) => ({ ...c })),
      });
    }
  }
}
