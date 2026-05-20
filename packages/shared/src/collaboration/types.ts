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
  /** Join a collaboration room. Resolves once the transport is ready. */
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
