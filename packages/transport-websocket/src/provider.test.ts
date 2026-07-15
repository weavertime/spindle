import { AddressInfo } from 'node:net';
import { createServer, Server } from 'node:http';
import { WebSocketServer, WebSocket as NodeWebSocket, type RawData } from 'ws';
import { WebSocketProvider } from './provider';

const CHANNEL_DOC = 0;
const CHANNEL_SYNC = 2;

// A faithful, minimal reference relay: per-room doc log, replay + sync frame on
// join, broadcast on message. Mirrors examples/collab-server so the test
// exercises the real WebSocketProvider against the real wire protocol.
interface TestServer {
  url: string;
  connections: NodeWebSocket[];
  close(): Promise<void>;
}

function toBuffer(raw: RawData): Buffer {
  if (Buffer.isBuffer(raw)) return raw;
  if (Array.isArray(raw)) return Buffer.concat(raw);
  return Buffer.from(raw as ArrayBuffer);
}

async function startServer(): Promise<TestServer> {
  const rooms = new Map<string, { peers: Set<NodeWebSocket>; docLog: Buffer[] }>();
  const connections: NodeWebSocket[] = [];
  const http: Server = createServer();
  const wss = new WebSocketServer({ server: http });

  wss.on('connection', (ws, req) => {
    connections.push(ws);
    const roomId = (req.url ?? '').replace(/^\/+/, '') || 'default';
    let room = rooms.get(roomId);
    if (!room) {
      room = { peers: new Set(), docLog: [] };
      rooms.set(roomId, room);
    }
    room.peers.add(ws);
    for (const frame of room.docLog) if (ws.readyState === ws.OPEN) ws.send(frame, { binary: true });
    if (ws.readyState === ws.OPEN) ws.send(Buffer.from([CHANNEL_SYNC]), { binary: true });

    ws.on('message', (raw, isBinary) => {
      const frame = toBuffer(raw);
      if (frame.length < 1) return;
      if (frame[0] === CHANNEL_DOC) room!.docLog.push(Buffer.from(frame));
      for (const peer of room!.peers) {
        if (peer === ws || peer.readyState !== peer.OPEN) continue;
        peer.send(raw, { binary: isBinary });
      }
    });
    ws.on('close', () => {
      room!.peers.delete(ws);
      if (room!.peers.size === 0) rooms.delete(roomId);
    });
    ws.on('error', () => {/* ignore in tests */});
  });

  await new Promise<void>((resolve) => http.listen(0, resolve));
  const port = (http.address() as AddressInfo).port;
  return {
    url: `ws://localhost:${port}`,
    connections,
    close: () =>
      new Promise<void>((resolve) => {
        wss.close(() => http.close(() => resolve()));
      }),
  };
}

const WS = NodeWebSocket as unknown as typeof WebSocket;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor: timed out');
    await delay(10);
  }
}

describe('WebSocketProvider against a replaying relay', () => {
  it("delivers the room's existing doc state before connect() resolves", async () => {
    const server = await startServer();
    const a = new WebSocketProvider({ url: server.url, WebSocketImpl: WS });
    await a.connect('room');
    a.send('doc', new Uint8Array([9, 8, 7]));
    await delay(30); // let the server log it

    const b = new WebSocketProvider({ url: server.url, WebSocketImpl: WS });
    let replayed: number[] | null = null;
    b.onMessage('doc', (payload) => {
      replayed = Array.from(payload);
    });
    await b.connect('room');

    // The assertion runs immediately after connect() resolves: the replayed doc
    // frame must already have been delivered. This is the contract a binding
    // relies on to decide it is a joiner and must not re-seed.
    expect(replayed).toEqual([9, 8, 7]);

    a.disconnect();
    b.disconnect();
    await server.close();
  });

  it('resolves connect() promptly for an empty room (creator path)', async () => {
    const server = await startServer();
    const a = new WebSocketProvider({ url: server.url, WebSocketImpl: WS });
    let got = false;
    a.onMessage('doc', () => {
      got = true;
    });
    await a.connect('room');
    // Nothing to replay → connect resolves on the sync frame with no doc bytes.
    expect(got).toBe(false);
    a.disconnect();
    await server.close();
  });

  it('re-syncs a reconnecting peer via replay (offline edits are not lost)', async () => {
    const server = await startServer();
    const a = new WebSocketProvider({ url: server.url, WebSocketImpl: WS, minReconnectDelayMs: 30 });
    await a.connect('room');
    a.send('doc', new Uint8Array([1]));
    await delay(30);

    const b = new WebSocketProvider({ url: server.url, WebSocketImpl: WS, minReconnectDelayMs: 30 });
    const received: number[] = [];
    b.onMessage('doc', (p) => received.push(p[0]));
    await b.connect('room');
    expect(received).toContain(1);

    // Drop B's server-side socket to simulate a network blip; A edits while B is
    // away. On reconnect the server replays the log, so B sees the missed edit.
    server.connections[1].close();
    a.send('doc', new Uint8Array([2]));
    await waitFor(() => received.includes(2));
    expect(received).toContain(2);

    a.disconnect();
    b.disconnect();
    await server.close();
  });
});
