// Bridge a Y.Doc to the library's opaque CollabProvider transport.
//
// Wire protocol per channel:
//   'doc'        — y-protocols/sync messages (state vector exchange + updates).
//                  Both the initial sync handshake and incremental edits travel
//                  here; readSyncMessage decides what to do with each payload.
//   'awareness'  — y-protocols/awareness encoded updates. Ephemeral; not stored.
//
// Outbound flow:
//   ydoc.on('update')          → writeUpdate → provider.send('doc', bytes)
//   awareness.on('update')     → encodeAwarenessUpdate → provider.send('awareness', bytes)
//
// Inbound flow:
//   provider.onMessage('doc')        → readSyncMessage → maybe-reply on 'doc'
//   provider.onMessage('awareness')  → applyAwarenessUpdate
//
// On connect, we proactively send a SyncStep1 so any existing peer responds
// with the updates we're missing — that's how a late joiner converges.

import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type { CollabIdentity, CollabProvider } from '@pagent-libs/shared';

import { getYDocFields, hydrateYDocFromData } from './y-schema';
import type { DocumentData } from '../types';

/**
 * Live handle returned by attachCollab. The React layer reads `xmlFragment`
 * for ySyncPlugin and `awareness` for yCursorPlugin. `detach()` releases
 * every handler and tears the Y.Doc down.
 */
export interface CollabHandle {
  ydoc: Y.Doc;
  xmlFragment: Y.XmlFragment;
  awareness: Awareness;
  identity: CollabIdentity;
  detach(): void;
}

export interface AttachCollabOptions {
  /**
   * Optional roomId override. Defaults to the document's meta.id once the
   * Y.Doc is hydrated. Consumers can pass a different room name to share
   * sessions under a stable URL even if the document id changes.
   */
  roomId?: string;
}

/**
 * Hydrate a Y.Doc from the given DocumentData, attach it to the provider,
 * and return a live handle. Caller must call detach() when done.
 *
 * The provider is expected to NOT be connected yet — attachCollab calls
 * provider.connect(roomId) as the final step so subscriptions are all in
 * place before any inbound payload can arrive.
 */
export async function attachCollabToYDoc(
  initialData: DocumentData,
  provider: CollabProvider,
  identity: CollabIdentity,
  options: AttachCollabOptions = {},
): Promise<CollabHandle> {
  const ydoc = new Y.Doc();

  // Hydrate Y types from the initial DocumentData snapshot.
  hydrateYDocFromData(ydoc, initialData);

  const { content: xmlFragment } = getYDocFields(ydoc);

  // Awareness carries cursor / presence state. Identity goes on local state.
  const awareness = new Awareness(ydoc);
  awareness.setLocalStateField('user', {
    userId: identity.userId,
    name: identity.displayName,
    color: identity.color,
  });

  const roomId = options.roomId ?? initialData.id;

  // --- Outbound: local edits → wire ----------------------------------------

  const onDocUpdate = (update: Uint8Array, origin: unknown): void => {
    // Don't echo updates that came from this very provider — readSyncMessage
    // tags applies with `provider` as origin, so this filter prevents loops.
    if (origin === provider) return;
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

  // --- Inbound: wire → local Y types ----------------------------------------

  const unsubDoc = provider.onMessage('doc', (payload: Uint8Array) => {
    const decoder = decoding.createDecoder(payload);
    const reply = encoding.createEncoder();
    // readSyncMessage handles all three message types (SyncStep1, SyncStep2,
    // Update). When it writes into `reply`, we send that back to whoever sent
    // us this message — that's how the SyncStep1/SyncStep2 handshake closes.
    syncProtocol.readSyncMessage(decoder, reply, ydoc, provider);
    if (encoding.length(reply) > 0) {
      provider.send('doc', encoding.toUint8Array(reply));
    }
  });

  const unsubAwareness = provider.onMessage('awareness', (payload: Uint8Array) => {
    applyAwarenessUpdate(awareness, payload, provider);
  });

  // --- Connect + initial sync ------------------------------------------------

  await provider.connect(roomId);

  // Send SyncStep1 so any already-connected peer responds with what we're
  // missing. Without this, a late joiner with an empty Y.Doc would never
  // learn what others have written.
  const step1Encoder = encoding.createEncoder();
  syncProtocol.writeSyncStep1(step1Encoder, ydoc);
  provider.send('doc', encoding.toUint8Array(step1Encoder));

  // Broadcast our awareness state so existing peers see us immediately.
  const awarenessInit = encodeAwarenessUpdate(awareness, [ydoc.clientID]);
  provider.send('awareness', awarenessInit);

  // --- Teardown -------------------------------------------------------------

  const detach = (): void => {
    // Tell peers we're leaving so their cursor overlays clean up.
    removeAwarenessStates(awareness, [ydoc.clientID], 'detach');
    ydoc.off('update', onDocUpdate);
    awareness.off('update', onAwarenessUpdate);
    unsubDoc();
    unsubAwareness();
    awareness.destroy();
    provider.disconnect();
    ydoc.destroy();
  };

  return {
    ydoc,
    xmlFragment,
    awareness,
    identity,
    detach,
  };
}
