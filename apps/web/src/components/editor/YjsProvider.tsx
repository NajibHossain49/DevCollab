"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as Y from "yjs";

import { useWebSocket } from "@/hooks/useWebSocket";
import type {
  ConnectionStatus,
  Position,
  Selection,
} from "@/lib/ws-messages";

interface YjsContextValue {
  doc: Y.Doc;
  /** Shared code text; both peers bind to the "code" Y.Text (server uses it). */
  yText: Y.Text;
  status: ConnectionStatus;
  sendChat: (content: string) => void;
  sendCursor: (position: Position, selection?: Selection) => void;
  sendTyping: (isTyping: boolean) => void;
}

const YjsContext = createContext<YjsContextValue | null>(null);

// Owns the Y.Doc for a room and the live WebSocket connection, exposing the
// shared document and messaging helpers to the editor and awareness panels.
export function YjsProvider({
  roomId,
  children,
}: {
  roomId: string;
  children: ReactNode;
}) {
  const [doc] = useState(() => new Y.Doc());

  const { status, sendChat, sendCursor, sendTyping } = useWebSocket({
    roomId,
    doc,
    enabled: Boolean(roomId),
  });

  const value = useMemo<YjsContextValue>(
    () => ({
      doc,
      yText: doc.getText("code"),
      status,
      sendChat,
      sendCursor,
      sendTyping,
    }),
    [doc, status, sendChat, sendCursor, sendTyping],
  );

  return <YjsContext.Provider value={value}>{children}</YjsContext.Provider>;
}

export function useYjs(): YjsContextValue {
  const ctx = useContext(YjsContext);
  if (!ctx) {
    throw new Error("useYjs must be used within a YjsProvider");
  }
  return ctx;
}
