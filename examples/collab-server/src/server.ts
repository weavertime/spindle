// Minimal WebSocket relay server for pagent-libs collaboration.
//
// Wire protocol (matches @weavertime/transport-websocket):
//   Connect:  ws://host:PORT/<roomId>
//   Each message: 1 byte channel tag (0 = doc, 1 = awareness)
//                  + opaque payload. The server doesn't interpret it —
//                  payloads are y-protocols/sync or y-protocols/awareness
//                  frames produced by the client-side Yjs binding.
//
// Behavior:
//   - The roomId is the URL path (everything after the first '/').
//   - On connect, the socket joins its room's peer set.
//   - On message, the server broadcasts the raw bytes to every other peer
//     in the same room. No persistence — late joiners catch up via
//     y-protocols/sync handshakes with whichever peer is online.
//
// This is intentionally minimal. Production deployments should add:
//   - auth on the upgrade request
//   - per-room state persistence so a room can be re-joined after going
//     idle (e.g., y-websocket's filesystem persistence, or any kv store)
//   - encryption at rest (the bytes here are app-level encrypted in our
//     model anyway, so the server is already zero-knowledge if the app
//     opts into E2EE).

import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';

const PORT = Number(process.env.PORT ?? 1234);

const rooms = new Map<string, Set<WebSocket>>();

function roomIdFromUrl(url: string | undefined): string {
  if (!url) return '';
  // Strip query string + leading slashes.
  const path = url.split('?')[0].replace(/^\/+/, '');
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

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

  let peers = rooms.get(roomId);
  if (!peers) {
    peers = new Set();
    rooms.set(roomId, peers);
  }
  peers.add(ws);

  // eslint-disable-next-line no-console
  console.log(
    `[collab-server] join room=${roomId} peers=${peers.size}`,
  );

  ws.on('message', (raw, isBinary) => {
    // Relay verbatim. ws.send accepts Buffer/ArrayBuffer/string; we keep
    // the original frame type so binary stays binary.
    for (const peer of peers!) {
      if (peer === ws) continue;
      if (peer.readyState === 1 /* OPEN */) {
        try {
          peer.send(raw, { binary: isBinary });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[collab-server] send failed:', err);
        }
      }
    }
  });

  ws.on('close', () => {
    peers!.delete(ws);
    // eslint-disable-next-line no-console
    console.log(
      `[collab-server] leave room=${roomId} peers=${peers!.size}`,
    );
    if (peers!.size === 0) rooms.delete(roomId);
  });

  ws.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.warn('[collab-server] socket error:', err.message);
  });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[collab-server] listening on ws://localhost:${PORT}/<roomId>`);
});
