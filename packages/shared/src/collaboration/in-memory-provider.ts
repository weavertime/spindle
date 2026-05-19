// In-memory CollabProvider for tests and local development.
//
// Subscriptions are owned by the provider instance rather than the room,
// so onMessage may be called at any point in the lifecycle — including
// before connect(). This matches what real transports need: handlers must
// be registered before the initial sync handshake fires, otherwise the
// peer's first state-vector exchange lands with nobody listening.
//
// Rooms are a module-level registry mapping roomId → set of connected
// providers. send() iterates the room's peers and calls each peer's own
// handlers directly.

import type { CollabChannel, CollabMessageHandler, CollabProvider } from './types';

const rooms = new Map<string, Set<InMemoryProvider>>();

let providerCounter = 0;

export class InMemoryProvider implements CollabProvider {
  private readonly providerId: string;
  private roomId: string | null = null;
  private subscribers: Map<CollabChannel, Set<CollabMessageHandler>> = new Map();

  constructor() {
    this.providerId = `mem_${++providerCounter}`;
  }

  async connect(roomId: string): Promise<void> {
    if (this.roomId && this.roomId !== roomId) {
      // Leave the previous room first.
      rooms.get(this.roomId)?.delete(this);
    }
    this.roomId = roomId;
    let peers = rooms.get(roomId);
    if (!peers) {
      peers = new Set();
      rooms.set(roomId, peers);
    }
    peers.add(this);
  }

  disconnect(): void {
    if (this.roomId) {
      const peers = rooms.get(this.roomId);
      peers?.delete(this);
      if (peers && peers.size === 0) rooms.delete(this.roomId);
      this.roomId = null;
    }
    this.subscribers.clear();
  }

  send(channel: CollabChannel, payload: Uint8Array): void {
    if (!this.roomId) return;
    const peers = rooms.get(this.roomId);
    if (!peers) return;
    for (const peer of peers) {
      if (peer === this) continue;
      const handlers = peer.subscribers.get(channel);
      if (!handlers) continue;
      for (const handler of handlers) {
        handler(payload, this.providerId);
      }
    }
  }

  onMessage(channel: CollabChannel, handler: CollabMessageHandler): () => void {
    let set = this.subscribers.get(channel);
    if (!set) {
      set = new Set();
      this.subscribers.set(channel, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
    };
  }
}

/** Test helper: clear every in-memory room. */
export function __resetInMemoryRooms(): void {
  rooms.clear();
}
