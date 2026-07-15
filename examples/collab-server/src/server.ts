// Reference WebSocket relay server for Spindle collaboration.
//
// Wire protocol (matches @weavertime/spindle-transport-websocket):
//   Connect:  ws://host:PORT/<roomId>
//   Each frame: 1 byte channel tag + opaque payload.
//     tag 0 = doc        (durable — logged and replayed to newcomers)
//     tag 1 = awareness   (ephemeral — fanned out only)
//     tag 2 = sync        (server → client control: "replay complete")
//   The server reads only the 1-byte tag; the payload stays opaque, so this
//   remains zero-knowledge / E2EE-friendly.
//
// Why a log + replay (not a bare relay): seeding a CRDT is a write, and if
// every peer seeds independently the document duplicates. This server is the
// room's authority — on connect it replays the room's doc log to the newcomer
// and then sends a `sync` frame, so the client knows whether the room already
// had state (join, don't seed) or was empty (creator, seed). The same replay
// runs on reconnect, so a peer that dropped re-converges for free.
//
// This reference keeps the log in memory and drops a room once it is idle.
// A production deployment should swap the in-memory `rooms` map for durable,
// content-agnostic storage (any KV/blob store) and add auth on the upgrade —
// the protocol above is unchanged.

import { createServer, type Server } from 'node:http';
import { WebSocketServer, type WebSocket, type RawData } from 'ws';

const CHANNEL_DOC = 0;
const CHANNEL_SYNC = 2;

interface Room {
  peers: Set<WebSocket>;
  /** Ordered log of every doc frame, replayed verbatim to each newcomer. */
  docLog: Buffer[];
}

function roomIdFromUrl(url: string | undefined): string {
  if (!url) return '';
  const path = url.split('?')[0].replace(/^\/+/, '');
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function toBuffer(raw: RawData): Buffer {
  if (Buffer.isBuffer(raw)) return raw;
  if (Array.isArray(raw)) return Buffer.concat(raw);
  return Buffer.from(raw as ArrayBuffer);
}

export interface CollabServerOptions {
  /** Port to listen on. Defaults to $PORT or 1234. Pass 0 for an ephemeral port. */
  port?: number;
  /** Called once the server is listening (receives the resolved port). */
  onListening?: (port: number) => void;
}

/**
 * Create and start a relay server. Returns the underlying http.Server so a
 * caller (or a test) can read `.address()` and `.close()` it.
 */
export function createCollabServer(options: CollabServerOptions = {}): Server {
  const rooms = new Map<string, Room>();

  const httpServer = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('spindle-collab-server: connect via WebSocket at /<roomId>\n');
  });

  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws, req) => {
    const roomId = roomIdFromUrl(req.url);
    if (!roomId) {
      ws.close(1008, 'roomId required (use ws://host/<roomId>)');
      return;
    }

    let room = rooms.get(roomId);
    if (!room) {
      room = { peers: new Set(), docLog: [] };
      rooms.set(roomId, room);
    }
    room.peers.add(ws);

    // Replay the room's existing doc state, then signal that the newcomer is
    // synced. connect() on the client resolves on this frame.
    for (const frame of room.docLog) {
      if (ws.readyState === ws.OPEN) ws.send(frame, { binary: true });
    }
    if (ws.readyState === ws.OPEN) ws.send(Buffer.from([CHANNEL_SYNC]), { binary: true });

    ws.on('message', (raw, isBinary) => {
      const frame = toBuffer(raw);
      if (frame.length < 1) return;
      // Log doc frames (durable); awareness is fanned out but never stored.
      if (frame[0] === CHANNEL_DOC) room!.docLog.push(Buffer.from(frame));
      for (const peer of room!.peers) {
        if (peer === ws || peer.readyState !== peer.OPEN) continue;
        try {
          peer.send(raw, { binary: isBinary });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[collab-server] send failed:', err);
        }
      }
    });

    ws.on('close', () => {
      room!.peers.delete(ws);
      // In-memory reference: forget the room (and its log) once empty. A
      // durable deployment would keep it so a room survives going idle.
      if (room!.peers.size === 0) rooms.delete(roomId);
    });

    ws.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.warn('[collab-server] socket error:', err.message);
    });
  });

  const port = options.port ?? Number(process.env.PORT ?? 1234);
  httpServer.listen(port, () => {
    const resolved = (httpServer.address() as { port: number } | null)?.port ?? port;
    options.onListening?.(resolved);
    // eslint-disable-next-line no-console
    console.log(`[collab-server] listening on ws://localhost:${resolved}/<roomId>`);
  });

  return httpServer;
}

// Start when run directly (npm start / tsx src/server.ts).
createCollabServer();
