// In-memory CollabProvider for tests and local development.
//
// This is an authoritative relay, not a bare message bus: each room keeps an
// ordered log of every 'doc' payload sent to it. When a peer joins, the room
// replays that log to the newcomer *before connect() resolves*, so the joiner
// converges on the room's existing state without re-seeding it. That is what
// prevents the classic "every peer hydrates initialData → duplicated content"
// bug, and it mirrors what a persisting relay (e.g. the WebSocket transport's
// server) does with the same opaque bytes.
//
// 'awareness' is ephemeral presence and is never logged or replayed — only
// fanned out to currently-connected peers.
//
// Subscriptions are owned by the provider instance rather than the room, so
// onMessage may be called at any point in the lifecycle — including before
// connect(). Handlers must be registered before connect() so the replay lands.

import type { CollabChannel, CollabMessageHandler, CollabProvider } from './types';

interface Room {
  peers: Set<InMemoryProvider>;
  /** Ordered log of every 'doc' payload, replayed to each newcomer on join. */
  docLog: Uint8Array[];
}

const rooms = new Map<string, Room>();

let providerCounter = 0;

function getRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = { peers: new Set(), docLog: [] };
    rooms.set(roomId, room);
  }
  return room;
}

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
      rooms.get(this.roomId)?.peers.delete(this);
    }
    this.roomId = roomId;
    const room = getRoom(roomId);
    room.peers.add(this);

    // Replay the room's existing doc state to this peer before resolving, so
    // the caller's document reflects the room the moment connect() returns.
    const handlers = this.subscribers.get('doc');
    if (handlers && handlers.size > 0) {
      for (const payload of room.docLog) {
        for (const handler of handlers) handler(payload, 'replay');
      }
    }
  }

  disconnect(): void {
    if (this.roomId) {
      const room = rooms.get(this.roomId);
      room?.peers.delete(this);
      // Drop the room (and its log) once nobody is left. A durable relay would
      // persist it; the in-memory transport intentionally does not.
      if (room && room.peers.size === 0) rooms.delete(this.roomId);
      this.roomId = null;
    }
    this.subscribers.clear();
  }

  send(channel: CollabChannel, payload: Uint8Array): void {
    if (!this.roomId) return;
    const room = rooms.get(this.roomId);
    if (!room) return;
    // Persist doc payloads so late joiners can be brought up to date; awareness
    // is ephemeral and only fanned out to live peers.
    if (channel === 'doc') room.docLog.push(payload);
    for (const peer of room.peers) {
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
