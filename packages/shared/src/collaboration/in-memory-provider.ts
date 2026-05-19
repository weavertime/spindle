// In-memory CollabProvider for tests and local development.
//
// Backed by a module-level registry of rooms; every InMemoryProvider that
// connects to the same roomId shares a broadcast bus. Messages are delivered
// synchronously and never reach the network.

import type { CollabChannel, CollabMessageHandler, CollabProvider } from './types';

interface Room {
  subscribers: Map<CollabChannel, Set<{ id: string; handler: CollabMessageHandler }>>;
}

const rooms = new Map<string, Room>();

function getOrCreateRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = { subscribers: new Map() };
    rooms.set(roomId, room);
  }
  return room;
}

let providerCounter = 0;

export class InMemoryProvider implements CollabProvider {
  private readonly providerId: string;
  private roomId: string | null = null;
  private subscriptions = new Set<() => void>();

  constructor() {
    this.providerId = `mem_${++providerCounter}`;
  }

  async connect(roomId: string): Promise<void> {
    this.roomId = roomId;
    getOrCreateRoom(roomId);
  }

  disconnect(): void {
    for (const off of this.subscriptions) off();
    this.subscriptions.clear();
    this.roomId = null;
  }

  send(channel: CollabChannel, payload: Uint8Array): void {
    if (!this.roomId) return;
    const room = rooms.get(this.roomId);
    if (!room) return;
    const subs = room.subscribers.get(channel);
    if (!subs) return;
    for (const sub of subs) {
      if (sub.id === this.providerId) continue;
      sub.handler(payload, this.providerId);
    }
  }

  onMessage(channel: CollabChannel, handler: CollabMessageHandler): () => void {
    if (!this.roomId) {
      throw new Error('InMemoryProvider.onMessage called before connect()');
    }
    const room = getOrCreateRoom(this.roomId);
    let subs = room.subscribers.get(channel);
    if (!subs) {
      subs = new Set();
      room.subscribers.set(channel, subs);
    }
    const entry = { id: this.providerId, handler };
    subs.add(entry);

    const off = () => {
      subs!.delete(entry);
    };
    this.subscriptions.add(off);
    return off;
  }
}

/** Test helper: clear every in-memory room. */
export function __resetInMemoryRooms(): void {
  rooms.clear();
}
