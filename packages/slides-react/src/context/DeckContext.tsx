// DeckProvider — supplies the engine + its ElementStore to the component tree.
// The engine is passed in as a prop (the app owns its lifecycle, exactly like
// WorkbookProvider in sheets-react), so the same deck can be shared across
// panes or driven by collab.

import React, { createContext, useContext, useEffect, useMemo } from 'react';
import type { DeckImpl } from '@weavertime/spindle-slides-core';
import { ElementStore } from './element-store';
import { NodeRegistry } from '../interactions/node-registry';
import { TransientStore } from '../interactions/transient-store';

export interface DeckContextValue {
  deck: DeckImpl;
  store: ElementStore;
  /** element-id → wrapper DOM node, for direct-to-DOM gesture writes. */
  nodes: NodeRegistry;
  /** Per-gesture transient state (guides, marquee) consumed by overlays. */
  transient: TransientStore;
}

const DeckContext = createContext<DeckContextValue | null>(null);

export interface DeckProviderProps {
  deck: DeckImpl;
  children: React.ReactNode;
}

export function DeckProvider({ deck, children }: DeckProviderProps): React.ReactElement {
  const store = useMemo(() => new ElementStore(deck), [deck]);
  const nodes = useMemo(() => new NodeRegistry(), [deck]);
  const transient = useMemo(() => new TransientStore(), [deck]);
  useEffect(() => () => store.dispose(), [store]);

  const value = useMemo<DeckContextValue>(
    () => ({ deck, store, nodes, transient }),
    [deck, store, nodes, transient]
  );
  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDeckContext(): DeckContextValue {
  const ctx = useContext(DeckContext);
  if (!ctx) throw new Error('useDeckContext must be used within a <DeckProvider>');
  return ctx;
}
