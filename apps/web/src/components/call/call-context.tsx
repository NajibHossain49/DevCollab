"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { useYjs } from "@/components/editor/YjsProvider";
import { useAuth } from "@/hooks/useAuth";
import { useWebRTC, type UseWebRTCResult } from "@/hooks/useWebRTC";

export interface CallContextValue extends UseWebRTCResult {
  /** Whether the room WebSocket is ready to carry signaling. */
  canJoin: boolean;
  /** Whether the floating video panel is collapsed to a compact bar. */
  minimized: boolean;
  setMinimized: (value: boolean) => void;
}

const CallContext = createContext<CallContextValue | null>(null);

// Owns the room's WebRTC call state so both the header trigger and the floating
// video panel share a single peer-connection mesh. Signaling rides the existing
// collaboration socket (via useYjs), so Monaco/Yjs editing is untouched.
export function CallProvider({ children }: { children: ReactNode }) {
  const { provider, status } = useYjs();
  const { user } = useAuth();
  const [minimized, setMinimized] = useState(false);

  const self = user
    ? { id: user.id, name: user.name ?? "You", avatar: user.avatar ?? undefined }
    : null;

  const call = useWebRTC({ provider, self, enabled: Boolean(provider) });

  const value: CallContextValue = {
    ...call,
    canJoin: status === "connected" && Boolean(provider) && Boolean(self),
    minimized,
    setMinimized,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return ctx;
}
