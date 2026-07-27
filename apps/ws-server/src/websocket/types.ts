import { z } from "zod";

// ============================================
// CONSTANTS
// ============================================
export const CURSOR_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
] as const;

export const WS_HEARTBEAT_INTERVAL = 30_000;
export const WS_HEARTBEAT_TIMEOUT = 10_000;

export function pickColor(): string {
  const index = Math.floor(Math.random() * CURSOR_COLORS.length);
  return CURSOR_COLORS[index] ?? CURSOR_COLORS[0];
}

// ============================================
// SHARED SHAPES
// ============================================
const positionSchema = z.object({ line: z.number(), ch: z.number() });
const selectionSchema = z.object({ anchor: positionSchema, head: positionSchema });

export type Position = z.infer<typeof positionSchema>;
export type Selection = z.infer<typeof selectionSchema>;

export interface AwarenessState {
  userId: string;
  name: string;
  color: string;
  cursor?: Position;
  selection?: Selection;
  isTyping: boolean;
  lastSeen: Date;
}

export interface AwarenessUser {
  userId: string;
  name: string;
  color: string;
  cursor?: Position;
  isTyping: boolean;
  lastSeen: string;
}

// ============================================
// CLIENT -> SERVER MESSAGES (validated with zod)
// ============================================
export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("JOIN_ROOM"), payload: z.object({ roomId: z.string() }) }),
  z.object({ type: z.literal("LEAVE_ROOM"), payload: z.object({ roomId: z.string() }) }),
  z.object({
    type: z.literal("DOC_UPDATE"),
    payload: z.object({ roomId: z.string(), update: z.array(z.number()) }),
  }),
  z.object({
    type: z.literal("CURSOR_MOVE"),
    payload: z.object({
      roomId: z.string(),
      position: positionSchema,
      selection: selectionSchema.optional(),
    }),
  }),
  z.object({
    type: z.literal("USER_TYPING"),
    payload: z.object({ roomId: z.string(), isTyping: z.boolean() }),
  }),
  z.object({
    type: z.literal("CHAT_MESSAGE"),
    payload: z.object({ roomId: z.string(), content: z.string().min(1) }),
  }),
  z.object({ type: z.literal("REQUEST_DOC_SYNC"), payload: z.object({ roomId: z.string() }) }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ============================================
// SERVER -> CLIENT MESSAGES
// ============================================
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

// Outgoing messages broadcast to clients.
export type WebSocketMessage = ServerMessage;
