import * as Y from "yjs";

import type {
  ClientMessage,
  ConnectionStatus,
  Position,
  Selection,
  ServerMessage,
} from "./ws-messages";

interface CollabProviderOptions {
  /** Base WebSocket URL, e.g. ws://localhost:3001/ws */
  url: string;
  roomId: string;
  doc: Y.Doc;
  /** Async source of a fresh JWT for each (re)connection. */
  tokenProvider: () => Promise<string>;
}

interface EventMap {
  status: ConnectionStatus;
  synced: void;
  message: ServerMessage;
}

type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void;

const BASE_RECONNECT_DELAY = 1_000;
const MAX_RECONNECT_DELAY = 30_000;

/**
 * Binds a Yjs document to the DevCollab WebSocket server using its custom JSON
 * protocol (JOIN_ROOM -> DOC_SYNC, local edits -> DOC_UPDATE, relayed back as
 * DOC_SYNC). This intentionally does NOT use the standard y-websocket binary
 * protocol, which the server does not speak.
 *
 * Reconnection uses exponential backoff with jitter. Awareness (cursors, chat)
 * flows through the same socket via the convenience senders below; consumers
 * subscribe via `on("message", ...)`.
 */
export class CollabProvider {
  readonly doc: Y.Doc;
  private readonly _url: string;
  private readonly _roomId: string;
  private readonly _tokenProvider: () => Promise<string>;

  private _ws: WebSocket | null = null;
  private _status: ConnectionStatus = "connecting";
  private _synced = false;
  private _destroyed = false;
  private _shouldReconnect = true;
  private _reconnectAttempts = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly _listeners = new Map<
    keyof EventMap,
    Set<(payload: unknown) => void>
  >();

  constructor(options: CollabProviderOptions) {
    this._url = options.url;
    this._roomId = options.roomId;
    this._tokenProvider = options.tokenProvider;
    this.doc = options.doc;
    this.doc.on("update", this._onDocUpdate);
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  // -------------------------------------------------------------------------
  // Event emitter
  // -------------------------------------------------------------------------
  on<K extends keyof EventMap>(event: K, listener: Listener<K>): () => void {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    const wrapped = listener as (payload: unknown) => void;
    set.add(wrapped);
    return () => {
      set?.delete(wrapped);
    };
  }

  private _emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this._listeners.get(event)?.forEach((listener) => {
      listener(payload);
    });
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------
  async connect(): Promise<void> {
    if (this._destroyed) return;
    this._setStatus(this._reconnectAttempts === 0 ? "connecting" : "reconnecting");

    let token: string;
    try {
      token = await this._tokenProvider();
    } catch {
      this._scheduleReconnect();
      return;
    }
    if (this._destroyed) return;

    const url = `${this._url}?token=${encodeURIComponent(token)}&roomId=${encodeURIComponent(this._roomId)}`;
    const ws = new WebSocket(url);
    this._ws = ws;

    ws.onopen = () => {
      this._reconnectAttempts = 0;
      this._setStatus("connected");
      this._send({ type: "JOIN_ROOM", payload: { roomId: this._roomId } });
      // Push our local state so the server converges with any offline edits.
      const state = Y.encodeStateAsUpdate(this.doc);
      this._send({
        type: "DOC_UPDATE",
        payload: { roomId: this._roomId, update: Array.from(state) },
      });
    };

    ws.onmessage = (event: MessageEvent) => {
      this._handleRaw(typeof event.data === "string" ? event.data : "");
    };

    ws.onclose = () => {
      this._ws = null;
      if (this._shouldReconnect && !this._destroyed) {
        this._scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // The close event follows and drives reconnection.
    };
  }

  private _handleRaw(raw: string): void {
    if (!raw) return;
    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }

    if (message.type === "DOC_SYNC") {
      const update = Uint8Array.from(message.payload.update);
      // origin = this so our own update handler does not echo it back.
      Y.applyUpdate(this.doc, update, this);
      if (!this._synced) {
        this._synced = true;
        this._emit("synced", undefined);
      }
      return;
    }

    this._emit("message", message);
  }

  private _onDocUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === this) return; // Applied from a remote DOC_SYNC; don't loop.
    this._send({
      type: "DOC_UPDATE",
      payload: { roomId: this._roomId, update: Array.from(update) },
    });
  };

  private _scheduleReconnect(): void {
    if (this._destroyed || !this._shouldReconnect) return;
    this._setStatus("reconnecting");

    const delay = Math.min(
      MAX_RECONNECT_DELAY,
      BASE_RECONNECT_DELAY * 2 ** this._reconnectAttempts,
    );
    const jitter = Math.random() * 300;
    this._reconnectAttempts += 1;

    this._reconnectTimer = setTimeout(() => {
      void this.connect();
    }, delay + jitter);
  }

  private _setStatus(status: ConnectionStatus): void {
    if (this._status === status) return;
    this._status = status;
    this._emit("status", status);
  }

  private _send(message: ClientMessage): void {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(message));
    }
  }

  // -------------------------------------------------------------------------
  // Convenience senders
  // -------------------------------------------------------------------------
  sendCursor(position: Position, selection?: Selection): void {
    this._send({
      type: "CURSOR_MOVE",
      payload: { roomId: this._roomId, position, selection },
    });
  }

  sendTyping(isTyping: boolean): void {
    this._send({
      type: "USER_TYPING",
      payload: { roomId: this._roomId, isTyping },
    });
  }

  sendChat(content: string): void {
    this._send({ type: "CHAT_MESSAGE", payload: { roomId: this._roomId, content } });
  }

  destroy(): void {
    this._destroyed = true;
    this._shouldReconnect = false;

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    this.doc.off("update", this._onDocUpdate);

    if (this._ws) {
      if (this._ws.readyState === WebSocket.OPEN) {
        this._send({ type: "LEAVE_ROOM", payload: { roomId: this._roomId } });
      }
      this._ws.onopen = null;
      this._ws.onmessage = null;
      this._ws.onclose = null;
      this._ws.onerror = null;
      this._ws.close();
      this._ws = null;
    }

    this._listeners.clear();
  }
}

// Fetches a fresh WebSocket JWT from the Next.js API route.
export async function fetchWsToken(): Promise<string> {
  const response = await fetch("/api/ws-token", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch WS token: ${response.status}`);
  }
  const body = (await response.json()) as {
    data?: { token?: string };
  };
  const token = body.data?.token;
  if (!token) {
    throw new Error("WS token missing from response");
  }
  return token;
}
