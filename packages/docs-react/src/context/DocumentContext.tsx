import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { DocumentImpl } from '@pagent-libs/docs-core';
import type { CommentAuthor } from '@pagent-libs/docs-core';

interface DocumentContextValue {
  document: DocumentImpl;
  updateDocument: (updater: (doc: DocumentImpl) => void) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  /** Identity attributed to comments created in this session. */
  currentUser: CommentAuthor;
}

const DocumentContext = createContext<DocumentContextValue | undefined>(undefined);

const DEFAULT_USER: CommentAuthor = { id: 'local-user', name: 'You' };

export interface DocumentProviderProps {
  document: DocumentImpl;
  children: React.ReactNode;
  initialZoom?: number;
  /** Author for comments. Falls back to a generic local user when omitted. */
  currentUser?: CommentAuthor;
}

export function DocumentProvider({
  document: initialDocument,
  children,
  initialZoom = 100,
  currentUser,
}: DocumentProviderProps) {
  const [document] = useState<DocumentImpl>(initialDocument);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [zoom, setZoom] = useState(initialZoom);

  const resolvedUser = useMemo<CommentAuthor>(
    () => currentUser ?? DEFAULT_USER,
    [currentUser?.id, currentUser?.name],
  );

  // Subscribe to document events to trigger re-renders
  useEffect(() => {
    const handleDocumentChange = () => {
      setUpdateTrigger((prev) => prev + 1);
    };

    const handleBlockChange = () => {
      setUpdateTrigger((prev) => prev + 1);
    };

    const handleBlockAdd = () => {
      setUpdateTrigger((prev) => prev + 1);
    };

    const handleBlockDelete = () => {
      setUpdateTrigger((prev) => prev + 1);
    };

    const handleSelectionChange = () => {
      setUpdateTrigger((prev) => prev + 1);
    };

    const handlePageConfigChange = () => {
      setUpdateTrigger((prev) => prev + 1);
    };

    const handleHistoryChange = () => {
      setUpdateTrigger((prev) => prev + 1);
    };

    const unsubscribers = [
      document.on('documentChange', handleDocumentChange),
      document.on('blockChange', handleBlockChange),
      document.on('blockAdd', handleBlockAdd),
      document.on('blockDelete', handleBlockDelete),
      document.on('selectionChange', handleSelectionChange),
      document.on('pageConfigChange', handlePageConfigChange),
      document.on('historyChange', handleHistoryChange),
      document.on('commentChange', handleDocumentChange),
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [document]);

  const updateDocument = useCallback((updater: (doc: DocumentImpl) => void) => {
    updater(document);
    setUpdateTrigger((prev) => prev + 1);
  }, [document]);

  const handleSetZoom = useCallback((newZoom: number) => {
    setZoom(Math.max(25, Math.min(400, newZoom)));
  }, []);

  const value = useMemo(
    () => ({
      document,
      updateDocument,
      zoom,
      setZoom: handleSetZoom,
      currentUser: resolvedUser,
    }),
    [document, updateDocument, zoom, handleSetZoom, updateTrigger, resolvedUser]
  );

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
}

export function useDocument(): DocumentContextValue {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocument must be used within DocumentProvider');
  }
  return context;
}

/**
 * Hook to get the current selection
 */
export function useSelection() {
  const { document } = useDocument();
  return document.getSelection();
}

/**
 * Hook to get document sections
 */
export function useSections() {
  const { document } = useDocument();
  return document.getSections();
}

/**
 * Hook to get undo/redo state
 */
export function useHistory() {
  const { document } = useDocument();
  return {
    canUndo: document.canUndo(),
    canRedo: document.canRedo(),
    undo: () => document.undo(),
    redo: () => document.redo(),
  };
}

