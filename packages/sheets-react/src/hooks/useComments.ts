import { useCallback, useEffect, useState } from 'react';
import type { SheetCommentThread } from '@pagent-libs/sheets-core';
import { useWorkbook } from '../context/WorkbookContext';

export interface UseCommentsResult {
  /** Every thread on the active sheet. */
  threads: SheetCommentThread[];
  /** Threads anchored to a given cell (by current row/col index). */
  getThreadsForCell: (row: number, col: number) => SheetCommentThread[];
  addThreadAtCell: (row: number, col: number, body: string) => void;
  addReply: (threadId: string, body: string) => void;
  editComment: (threadId: string, commentId: string, body: string) => void;
  deleteComment: (threadId: string, commentId: string) => void;
  deleteThread: (threadId: string) => void;
  resolveThread: (threadId: string) => void;
  reopenThread: (threadId: string) => void;
}

/**
 * Subscribe to the active sheet's comment threads. Re-renders on local
 * comment mutations (`commentChange`) and on remote reloads (`sheetChange`,
 * which swaps in a fresh SheetImpl).
 */
export function useComments(): UseCommentsResult {
  const { workbook, currentUser } = useWorkbook();
  const [, setVersion] = useState(0);

  useEffect(() => {
    const bump = (): void => setVersion((v) => v + 1);
    const offComment = workbook.on('commentChange', bump);
    const offSheet = workbook.on('sheetChange', bump);
    return () => {
      offComment();
      offSheet();
    };
  }, [workbook]);

  // Re-fetched every render — a remote reload replaces the SheetImpl/store.
  const sheet = workbook.getSheet();
  const store = sheet.comments;

  const getThreadsForCell = useCallback(
    (row: number, col: number): SheetCommentThread[] => {
      const rowId = sheet.getRowId(row);
      const colId = sheet.getColId(col);
      if (!rowId || !colId) return [];
      return store.getThreadsForCell(rowId, colId);
    },
    [sheet, store],
  );

  const addThreadAtCell = useCallback(
    (row: number, col: number, body: string): void => {
      const rowId = sheet.ensureRowId(row);
      const colId = sheet.ensureColId(col);
      store.addThread({ rowId, colId }, body, currentUser);
    },
    [sheet, store, currentUser],
  );

  const addReply = useCallback(
    (threadId: string, body: string): void => {
      store.addReply(threadId, body, currentUser);
    },
    [store, currentUser],
  );

  const editComment = useCallback(
    (threadId: string, commentId: string, body: string): void => {
      store.editComment(threadId, commentId, body);
    },
    [store],
  );

  const deleteComment = useCallback(
    (threadId: string, commentId: string): void => {
      store.deleteComment(threadId, commentId);
    },
    [store],
  );

  const deleteThread = useCallback(
    (threadId: string): void => {
      store.deleteThread(threadId);
    },
    [store],
  );

  const resolveThread = useCallback(
    (threadId: string): void => {
      store.resolveThread(threadId, currentUser);
    },
    [store, currentUser],
  );

  const reopenThread = useCallback(
    (threadId: string): void => {
      store.reopenThread(threadId);
    },
    [store],
  );

  return {
    threads: store.getThreads(),
    getThreadsForCell,
    addThreadAtCell,
    addReply,
    editComment,
    deleteComment,
    deleteThread,
    resolveThread,
    reopenThread,
  };
}
