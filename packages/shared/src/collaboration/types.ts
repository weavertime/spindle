// Generic collaboration transport contract.
//
// The library is agnostic to wire format, transport, and encryption. A
// CollabProvider moves opaque byte payloads between peers on two channels:
//   - 'doc'       — durable document state (e.g. Yjs updates)
//   - 'awareness' — ephemeral presence (cursors, selections, user metadata)
//
// Consumers wrap this with their own crypto layer if they need E2EE; the
// library never inspects payloads.

export type CollabChannel = 'doc' | 'awareness';

export type CollabMessageHandler = (payload: Uint8Array, from?: string) => void;

/**
 * Transport connection status.
 *   - 'connecting' — opening the connection or retrying after a drop
 *   - 'connected'  — live, payloads flow
 *   - 'offline'    — no connection; edits apply locally and sync on reconnect
 */
export type CollabStatus = 'connecting' | 'connected' | 'offline';

export type CollabStatusHandler = (status: CollabStatus) => void;

export interface CollabProvider {
  /**
   * Join a collaboration room.
   *
   * Before the returned promise resolves, the provider MUST deliver every
   * previously-stored 'doc' payload for the room to the handlers registered
   * via `onMessage('doc')`. In other words, once `connect` resolves the caller
   * can trust that its local document already reflects whatever state the room
   * holds. This is what lets a binding decide, deterministically and without
   * any timing guesswork, whether it is the room's creator (the document is
   * still empty → seed it) or a joiner (state was replayed → seed nothing).
   * A transport backed by a relay satisfies this by having the relay replay
   * the room's opaque update log to the newcomer; the relay never inspects
   * the payloads, so this stays end-to-end-encryption friendly.
   */
  connect(roomId: string): Promise<void>;

  /** Leave the room and release all resources. Safe to call multiple times. */
  disconnect(): void;

  /** Broadcast a payload on a channel. No-op if not connected. */
  send(channel: CollabChannel, payload: Uint8Array): void;

  /**
   * Subscribe to inbound payloads on a channel.
   * Returns an unsubscribe function.
   */
  onMessage(channel: CollabChannel, handler: CollabMessageHandler): () => void;

  /**
   * Optional: current connection status. Transports without a meaningful
   * notion of connectivity (e.g. an in-process provider) may omit this.
   */
  getStatus?(): CollabStatus;

  /**
   * Optional: subscribe to connection-status changes. Returns an
   * unsubscribe function. Omitted by transports that don't report status.
   */
  onStatusChange?(handler: CollabStatusHandler): () => void;
}

/**
 * Identity metadata supplied by the consuming application. The library does
 * not authenticate users; this is purely display/awareness information.
 */
export interface CollabIdentity {
  userId: string;
  displayName: string;
  /** CSS color used for remote cursors and selection highlights. */
  color: string;
}
