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
import type { CollabIdentity, CollabProvider } from '@pagent-libs/shared';

import { hydrateYDocFromData, serializeYDocToData } from './y-schema';
import type { WorkbookData } from '../types';
import type { WorkbookImpl } from '../workbook';

export interface CollabHandle {
  ydoc: Y.Doc;
  awareness: Awareness;
  identity: CollabIdentity;
  detach(): void;
}

export interface AttachCollabOptions {
  /**
   * Optional roomId override. Defaults to the workbook's id once the Y.Doc
   * is hydrated.
   */
  roomId?: string;
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
  hydrateYDocFromData(ydoc, initialData);

  const awareness = new Awareness(ydoc);
  awareness.setLocalStateField('user', {
    userId: identity.userId,
    name: identity.displayName,
    color: identity.color,
  });

  const roomId = options.roomId ?? initialData.id;

  // --- Outbound + remote-reload dispatcher ---------------------------------

  const onDocUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === provider) {
      // Remote bytes were just applied to Y.Doc. Reload the workbook so the
      // engine + UI catch up. Skip the "no mutating while collab attached"
      // guard by routing through the dedicated _reloadFromCollab entrypoint.
      const newData = serializeYDocToData(ydoc, workbook.getSelection());
      workbook._reloadFromCollab(newData);
      return;
    }
    // Local mutation — broadcast it as a sync update.
    const encoder = encoding.createEncoder();
    syncProtocol.writeUpdate(encoder, update);
    provider.send('doc', encoding.toUint8Array(encoder));
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
    awareness.destroy();
    provider.disconnect();
    ydoc.destroy();
  };

  return { ydoc, awareness, identity, detach };
}
