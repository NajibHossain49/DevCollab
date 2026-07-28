// TypeScript contract for the DevCollab WebSocket protocol (mirrors
// apps/ws-server/src/websocket/types.ts). The server validates messages with
// Zod; here we only need the static types for the client.

export interface Position {
  line: number; // 0-based line index
  ch: number; // 0-based column index
}

export interface Selection {
  anchor: Position;
  head: Position;
}

export interface AwarenessUser {
  userId: string;
  name: string;
  color: string;
  cursor?: Position;
  isTyping: boolean;
  lastSeen: string;
}

// ---------------------------------------------------------------------------
// Client -> Server
// ---------------------------------------------------------------------------
export type ClientMessage =
  | { type: "JOIN_ROOM"; payload: { roomId: string } }
  | { type: "LEAVE_ROOM"; payload: { roomId: string } }
  | { type: "DOC_UPDATE"; payload: { roomId: string; update: number[] } }
  | {
      type: "CURSOR_MOVE";
      payload: { roomId: string; position: Position; selection?: Selection };
    }
  | { type: "USER_TYPING"; payload: { roomId: string; isTyping: boolean } }
  | { type: "CHAT_MESSAGE"; payload: { roomId: string; content: string } }
  | { type: "REQUEST_DOC_SYNC"; payload: { roomId: string } };

// ---------------------------------------------------------------------------
// Server -> Client
// ---------------------------------------------------------------------------
export interface UserJoinedMessage {
  type: "USER_JOINED";
  payload: {
    user: { id: string; name: string; avatar?: string; color: string };
    timestamp: string;
  };
}

export interface UserLeftMessage {
  type: "USER_LEFT";
  payload: { userId: string; timestamp: string };
}

export interface DocSyncMessage {
  type: "DOC_SYNC";
  payload: { roomId: string; update: number[] };
}

export interface CursorUpdateMessage {
  type: "CURSOR_UPDATE";
  payload: {
    userId: string;
    userName: string;
    color: string;
    position: Position;
    selection?: Selection;
  };
}

export interface AwarenessUpdateMessage {
  type: "AWARENESS_UPDATE";
  payload: { roomId: string; users: AwarenessUser[] };
}

export interface ChatMessageBroadcast {
  type: "CHAT_MESSAGE_BROADCAST";
  payload: {
    id: string;
    userId: string;
    userName: string;
    avatar?: string;
    content: string;
    createdAt: string;
  };
}

export interface ErrorMessage {
  type: "ERROR";
  payload: { code: string; message: string };
}

export type ServerMessage =
  | UserJoinedMessage
  | UserLeftMessage
  | DocSyncMessage
  | CursorUpdateMessage
  | AwarenessUpdateMessage
  | ChatMessageBroadcast
  | ErrorMessage;

// A remote peer's cursor as tracked on the client (derived from CURSOR_UPDATE).
export interface RemoteCursor {
  userId: string;
  userName: string;
  color: string;
  position: Position;
  selection?: Selection;
  updatedAt: number;
}

// A chat message as held in client state (mirrors CHAT_MESSAGE_BROADCAST).
export interface RoomChatMessage {
  id: string;
  userId: string;
  userName: string;
  avatar?: string;
  content: string;
  createdAt: string;
}

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";
