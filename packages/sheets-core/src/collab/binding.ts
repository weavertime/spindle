// Bridge a workbook's Y.Doc to the library's opaque CollabProvider transport.
//
// Same wire-level shape as docs:
//   'doc'        — y-protocols/sync messages (state vector exchange + updates)
//   'awareness'  — y-protocols/awareness encoded updates
//
// Outbound flow:
//   ydoc.on('update', origin=null)  → writeUpdate → provider.send('doc', …)
//   awareness.on('update')          → encodeAwarenessUpdate → provider.send('awareness', …)
//
// Inbound flow:
//   provider.onMessage('doc')        → readSyncMessage(…, origin=provider)
//                                     → ydoc.on('update', origin=provider)
//                                     → reload workbook from serialized Y.Doc
//   provider.onMessage('awareness')  → applyAwarenessUpdate
//
// v1 strategy for syncing remote changes back into WorkbookImpl: when a
// remote update lands, re-serialize the whole Y.Doc to WorkbookData and
// call workbook._reloadFromCollab(data). It's O(workbook size) per remote
// update but simple and correct. Granular Y.Map.observe per type is a
// future optimization for very large sheets.

import * as Y from 'yjs';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { CollabIdentity, CollabProvider } from '@weavertime/shared';

import { getWorkbookYTypes, hydrateYDocFromData, serializeYDocToData } from './y-schema';
import type { WorkbookData } from '../types';
import type { WorkbookImpl } from '../workbook';

export interface CollabHandle {
  ydoc: Y.Doc;
  awareness: Awareness;
  identity: CollabIdentity;
  /**
   * Y.UndoManager tracking all local writes on the workbook's Y types.
   * WorkbookImpl.undo/redo route through this when collab is attached,
   * so undo produces inverse Y operations that broadcast to peers
   * instead of the snapshot-based path that bypasses the mirror.
   */
  undoManager: Y.UndoManager;
  detach(): void;
}

export interface AttachCollabOptions {
  /**
   * Optional roomId override. Defaults to the workbook's id once the Y.Doc
   * is hydrated.
   */
  roomId?: string;
  /**
   * When set, the Y.Doc is mirrored to IndexedDB under this key. Edits
   * survive a page refresh / offline period: on the next attach the Y.Doc
   * is restored from IndexedDB BEFORE deciding whether to hydrate from the
   * workbook's data. Browser-only — leave unset for server-side rendering.
   */
  persistenceKey?: string;
}

/**
 * Hydrate a Y.Doc from the workbook's current data, attach it to the
 * provider, and return a live handle. The provider must NOT be connected
 * yet — attachCollabToWorkbook calls provider.connect(roomId) as the final
 * step so subscriptions are all in place before any inbound payload
 * arrives.
 */
export async function attachCollabToWorkbook(
  initialData: WorkbookData,
  workbook: WorkbookImpl,
  provider: CollabProvider,
  identity: CollabIdentity,
  options: AttachCollabOptions = {},
): Promise<CollabHandle> {
  const ydoc = new Y.Doc();

  // Optional IndexedDB persistence. Restore any prior local state FIRST,
  // then only hydrate from initialData if the doc came back empty —
  // otherwise we'd stack a duplicate copy on top of the restored one.
  let persistence: IndexeddbPersistence | undefined;
  if (options.persistenceKey) {
    persistence = new IndexeddbPersistence(options.persistenceKey, ydoc);
    await persistence.whenSynced;
  }

  if (getWorkbookYTypes(ydoc).sheetIds.length === 0) {
    hydrateYDocFromData(ydoc, initialData);
  }

  const awareness = new Awareness(ydoc);
  awareness.setLocalStateField('user', {
    userId: identity.userId,
    name: identity.displayName,
    color: identity.color,
  });

  // Track every local write on the workbook's top-level Y types so undo
  // works through Y operations (which broadcast) instead of the snapshot
  // path on WorkbookImpl (which bypasses the mirror). Descendants of these
  // types — per-sheet cells/rowOrder/etc. — are tracked transitively.
  const yTypes = getWorkbookYTypes(ydoc);
  const undoManager = new Y.UndoManager(
    [yTypes.meta, yTypes.stylePool, yTypes.formatPool, yTypes.sheetIds, yTypes.sheets],
    { trackedOrigins: new Set([null, undefined]), captureTimeout: 500 },
  );

  const roomId = options.roomId ?? initialData.id;

  // --- Outbound + remote-reload dispatcher ---------------------------------

  const onDocUpdate = (update: Uint8Array, origin: unknown): void => {
    // origin === provider     → remote bytes applied via syncProtocol
    // origin === undoManager  → our undo/redo applied an inverse op
    // origin === null/undef   → local mutation (mirror calls, etc.)
    const isRemote = origin === provider;
    const isOurUndo = origin === undoManager;

    if (!isRemote) {
      // Anything we generated locally (direct write or undo) needs to go
      // out on the wire so peers see it.
      const encoder = encoding.createEncoder();
      syncProtocol.writeUpdate(encoder, update);
      provider.send('doc', encoding.toUint8Array(encoder));
    }
    if (isRemote || isOurUndo) {
      // Y.Doc has new state that the workbook's internal Maps don't reflect
      // yet — remote came in via the network, or our undo just rewrote Y.
      // Reload via the dedicated entrypoint (suspends history + mirror).
      // activeSheetId is passed from the LOCAL workbook so a peer's sheet
      // switch never drags this user onto a different sheet.
      const newData = serializeYDocToData(
        ydoc,
        workbook.getSelection(),
        workbook.activeSheetId,
      );
      workbook._reloadFromCollab(newData);
    }
  };
  ydoc.on('update', onDocUpdate);

  const onAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ): void => {
    if (origin === provider) return;
    const changedClients = changes.added.concat(changes.updated, changes.removed);
    if (changedClients.length === 0) return;
    const payload = encodeAwarenessUpdate(awareness, changedClients);
    provider.send('awareness', payload);
  };
  awareness.on('update', onAwarenessUpdate);

  // --- Inbound -------------------------------------------------------------

  const unsubDoc = provider.onMessage('doc', (payload: Uint8Array) => {
    const decoder = decoding.createDecoder(payload);
    const reply = encoding.createEncoder();
    syncProtocol.readSyncMessage(decoder, reply, ydoc, provider);
    if (encoding.length(reply) > 0) {
      provider.send('doc', encoding.toUint8Array(reply));
    }
  });

  const unsubAwareness = provider.onMessage('awareness', (payload: Uint8Array) => {
    applyAwarenessUpdate(awareness, payload, provider);
  });

  // --- Connect + initial handshake ----------------------------------------

  await provider.connect(roomId);

  const step1Encoder = encoding.createEncoder();
  syncProtocol.writeSyncStep1(step1Encoder, ydoc);
  provider.send('doc', encoding.toUint8Array(step1Encoder));

  const awarenessInit = encodeAwarenessUpdate(awareness, [ydoc.clientID]);
  provider.send('awareness', awarenessInit);

  // --- Teardown -----------------------------------------------------------

  const detach = (): void => {
    removeAwarenessStates(awareness, [ydoc.clientID], 'detach');
    ydoc.off('update', onDocUpdate);
    awareness.off('update', onAwarenessUpdate);
    unsubDoc();
    unsubAwareness();
    undoManager.destroy();
    awareness.destroy();
    provider.disconnect();
    void persistence?.destroy();
    ydoc.destroy();
  };

  return { ydoc, awareness, identity, undoManager, detach };
}
