// WebSocketProvider: a CollabProvider over a WebSocket relay server.
//
// Reconnection: on close (other than an intentional disconnect()), the
// provider waits with exponential backoff and re-opens the socket.
// onMessage subscriptions are owned by the provider instance, so they
// survive disconnects and are simply called again when bytes arrive on
// the new socket.

import type {
  CollabChannel,
  CollabMessageHandler,
  CollabProvider,
  CollabStatus,
  CollabStatusHandler,
} from '@weavertime/shared';

const CHANNEL_DOC = 0;
const CHANNEL_AWARENESS = 1;

function channelToByte(channel: CollabChannel): number {
  return channel === 'doc' ? CHANNEL_DOC : CHANNEL_AWARENESS;
}

function byteToChannel(byte: number): CollabChannel | null {
  if (byte === CHANNEL_DOC) return 'doc';
  if (byte === CHANNEL_AWARENESS) return 'awareness';
  return null;
}

export interface WebSocketProviderOptions {
  /**
   * Base WebSocket URL (no trailing slash). The roomId passed to connect()
   * is appended as a path segment. Example: `ws://localhost:1234`.
   */
  url: string;
  /** Optional WebSocket constructor (for Node tests). Defaults to global. */
  WebSocketImpl?: typeof WebSocket;
  /** Min reconnect delay in ms. Default 250. */
  minReconnectDelayMs?: number;
  /** Max reconnect delay in ms. Default 10_000. */
  maxReconnectDelayMs?: number;
}

export class WebSocketProvider implements CollabProvider {
  private readonly url: string;
  private readonly Ctor: typeof WebSocket;
  private readonly minDelay: number;
  private readonly maxDelay: number;

  private socket: WebSocket | null = null;
  private roomId: string | null = null;
  /** True between intentional disconnect() and a fresh connect(). */
  private intentionallyClosed = false;
  /** Outbound messages queued while the socket is (re-)connecting. */
  private pendingOutbound: Uint8Array[] = [];
  /** Channel → handler set. Survives disconnects. */
  private subscribers: Map<CollabChannel, Set<CollabMessageHandler>> = new Map();
  /** Reconnect bookkeeping. */
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Promise resolver for the in-flight connect(). */
  private connectResolve: (() => void) | null = null;
  private connectReject: ((err: unknown) => void) | null = null;
  /** Connection status + subscribers. */
  private status: CollabStatus = 'offline';
  private statusHandlers: Set<CollabStatusHandler> = new Set();

  constructor(options: WebSocketProviderOptions) {
    this.url = options.url.replace(/\/+$/, '');
    this.Ctor =
      options.WebSocketImpl ??
      (typeof WebSocket !== 'undefined' ? WebSocket : (undefined as unknown as typeof WebSocket));
    if (!this.Ctor) {
      throw new Error(
        'WebSocketProvider: no global WebSocket available — pass options.WebSocketImpl',
      );
    }
    this.minDelay = options.minReconnectDelayMs ?? 250;
    this.maxDelay = options.maxReconnectDelayMs ?? 10_000;
  }

  connect(roomId: string): Promise<void> {
    if (this.roomId && this.roomId !== roomId) {
      // Already connected to a different room — disconnect first.
      this.disconnect();
    }
    this.roomId = roomId;
    this.intentionallyClosed = false;

    return new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.openSocket();
    });
  }

  disconnect(): void {
    this.intentionallyClosed = true;
    this.roomId = null;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
    this.pendingOutbound = [];
    this.setStatus('offline');
  }

  send(channel: CollabChannel, payload: Uint8Array): void {
    const framed = new Uint8Array(payload.length + 1);
    framed[0] = channelToByte(channel);
    framed.set(payload, 1);
    if (this.socket && this.socket.readyState === 1 /* OPEN */) {
      this.socket.send(framed);
    } else {
      // Buffer until the socket opens; flushed in onopen.
      this.pendingOutbound.push(framed);
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

  getStatus(): CollabStatus {
    return this.status;
  }

  onStatusChange(handler: CollabStatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  // --- Internals ----------------------------------------------------------

  private setStatus(status: CollabStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const h of this.statusHandlers) {
      try {
        h(status);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[WebSocketProvider] status handler threw:', err);
      }
    }
  }

  private openSocket(): void {
    if (!this.roomId) return;
    const url = `${this.url}/${encodeURIComponent(this.roomId)}`;
    const ws = new this.Ctor(url);
    ws.binaryType = 'arraybuffer';
    this.socket = ws;
    this.setStatus('connecting');

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus('connected');
      // Flush any messages queued while the socket was opening.
      for (const m of this.pendingOutbound) {
        try {
          ws.send(m);
        } catch {
          // If a single send fails, the socket will close and we'll reconnect
          // — drop the rest to avoid noisy errors.
          break;
        }
      }
      this.pendingOutbound = [];
      // Resolve the connect() promise once we're actually open.
      if (this.connectResolve) {
        const r = this.connectResolve;
        this.connectResolve = null;
        this.connectReject = null;
        r();
      }
    };

    ws.onmessage = (event) => {
      const data = event.data;
      let bytes: Uint8Array | null = null;
      if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
      else if (data instanceof Uint8Array) bytes = data;
      // Browsers occasionally hand back Blob if binaryType wasn't honored;
      // we set it to 'arraybuffer' above, so this is mostly defensive.
      if (!bytes || bytes.length < 1) return;
      const channel = byteToChannel(bytes[0]);
      if (!channel) return;
      const payload = bytes.slice(1);
      const handlers = this.subscribers.get(channel);
      if (!handlers) return;
      for (const h of handlers) {
        try {
          h(payload);
        } catch (err) {
          // Don't let a single handler error tear down the whole dispatch.
          // eslint-disable-next-line no-console
          console.error('[WebSocketProvider] handler threw:', err);
        }
      }
    };

    ws.onerror = () => {
      // Surface as a connect() rejection only the FIRST time; subsequent
      // attempts are just reconnects and shouldn't reject the original
      // promise (which the caller has long since resolved).
      // Browser WebSocket onerror doesn't include details — onclose follows
      // and handles the actual recovery.
    };

    ws.onclose = () => {
      this.socket = null;
      if (this.intentionallyClosed) {
        this.setStatus('offline');
        return;
      }
      if (this.connectReject) {
        // The very first open never succeeded.
        const rej = this.connectReject;
        this.connectResolve = null;
        this.connectReject = null;
        this.setStatus('offline');
        rej(new Error(`WebSocketProvider: failed to connect to ${url}`));
        return;
      }
      // Lost an established connection — show offline, then scheduleReconnect
      // flips us back to 'connecting' on its next openSocket().
      this.setStatus('offline');
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.intentionallyClosed) return;
    const delay = Math.min(
      this.maxDelay,
      this.minDelay * 2 ** this.reconnectAttempt,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }
}
