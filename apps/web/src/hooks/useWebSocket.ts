"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as Y from "yjs";

import { CollabProvider, fetchWsToken } from "@/lib/collab-provider";
import type {
  ConnectionStatus,
  Position,
  Selection,
  ServerMessage,
} from "@/lib/ws-messages";
import { useEditorStore } from "@/stores/editor.store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/ws";

interface UseWebSocketOptions {
  roomId: string;
  doc: Y.Doc;
  enabled?: boolean;
}

interface UseWebSocketResult {
  status: ConnectionStatus;
  provider: CollabProvider | null;
  sendChat: (content: string) => void;
  sendCursor: (position: Position, selection?: Selection) => void;
  sendTyping: (isTyping: boolean) => void;
}

// Owns the CollabProvider for a room, mirrors its status locally, and fans
// incoming server messages into the editor store. Handles the full protocol
// message set (Section 6 of the SRS).
export function useWebSocket({
  roomId,
  doc,
  enabled = true,
}: UseWebSocketOptions): UseWebSocketResult {
  const providerRef = useRef<CollabProvider | null>(null);
  const [provider, setProvider] = useState<CollabProvider | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  const setConnectionStatus = useEditorStore((s) => s.setConnectionStatus);
  const setActiveUsers = useEditorStore((s) => s.setActiveUsers);
  const upsertCursor = useEditorStore((s) => s.upsertCursor);
  const removeCursor = useEditorStore((s) => s.removeCursor);
  const addMessage = useEditorStore((s) => s.addMessage);
  const reset = useEditorStore((s) => s.reset);

  useEffect(() => {
    if (!enabled || !roomId) return;

    const handleMessage = (message: ServerMessage): void => {
      switch (message.type) {
        case "CURSOR_UPDATE":
          upsertCursor({
            userId: message.payload.userId,
            userName: message.payload.userName,
            color: message.payload.color,
            position: message.payload.position,
            selection: message.payload.selection,
            updatedAt: Date.now(),
          });
          break;
        case "AWARENESS_UPDATE":
          setActiveUsers(message.payload.users);
          break;
        case "CHAT_MESSAGE_BROADCAST":
          addMessage(message.payload);
          break;
        case "USER_LEFT":
          removeCursor(message.payload.userId);
          break;
        case "USER_JOINED":
          // An AWARENESS_UPDATE with the full roster follows; nothing to do.
          break;
        case "ERROR":
          console.warn("[ws] server error", message.payload);
          break;
        default:
          break;
      }
    };

    const provider = new CollabProvider({
      url: WS_URL,
      roomId,
      doc,
      tokenProvider: fetchWsToken,
    });
    providerRef.current = provider;
    setProvider(provider);

    const offStatus = provider.on("status", (next) => {
      setStatus(next);
      setConnectionStatus(next);
    });
    const offMessage = provider.on("message", handleMessage);

    void provider.connect();

    return () => {
      offStatus();
      offMessage();
      provider.destroy();
      providerRef.current = null;
      setProvider(null);
      reset();
    };
  }, [
    roomId,
    doc,
    enabled,
    setConnectionStatus,
    setActiveUsers,
    upsertCursor,
    removeCursor,
    addMessage,
    reset,
  ]);

  const sendChat = useCallback((content: string) => {
    providerRef.current?.sendChat(content);
  }, []);

  const sendCursor = useCallback((position: Position, selection?: Selection) => {
    providerRef.current?.sendCursor(position, selection);
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    providerRef.current?.sendTyping(isTyping);
  }, []);

  return {
    status,
    provider,
    sendChat,
    sendCursor,
    sendTyping,
  };
}
