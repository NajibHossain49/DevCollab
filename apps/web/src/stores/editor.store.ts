import { create } from "zustand";

import type {
  AwarenessUser,
  ConnectionStatus,
  RemoteCursor,
  RoomChatMessage,
} from "@/lib/ws-messages";
import type { Execution, SupportedLanguage } from "@/types";

interface EditorState {
  // --- Connection ---
  connectionStatus: ConnectionStatus;
  isConnected: boolean;

  // --- Editor ---
  currentCode: string;
  language: SupportedLanguage;

  // --- Awareness ---
  activeUsers: AwarenessUser[];
  cursors: Record<string, RemoteCursor>;

  // --- Chat ---
  messages: RoomChatMessage[];

  // --- Execution ---
  isExecuting: boolean;
  executionOutput: string | null;
  executionError: string | null;
  executionHistory: Execution[];

  // --- AI ---
  aiSuggestion: string | null;

  // --- Actions ---
  setConnectionStatus: (status: ConnectionStatus) => void;
  setCurrentCode: (code: string) => void;
  setLanguage: (language: SupportedLanguage) => void;

  setActiveUsers: (users: AwarenessUser[]) => void;
  upsertCursor: (cursor: RemoteCursor) => void;
  removeCursor: (userId: string) => void;

  setMessages: (messages: RoomChatMessage[]) => void;
  addMessage: (message: RoomChatMessage) => void;

  setExecuting: (executing: boolean) => void;
  setExecutionResult: (result: {
    output: string | null;
    error: string | null;
  }) => void;
  addExecution: (execution: Execution) => void;
  setExecutionHistory: (history: Execution[]) => void;
  clearExecutionOutput: () => void;
  clearExecutionHistory: () => void;

  setAiSuggestion: (suggestion: string | null) => void;

  reset: () => void;
}

const INITIAL_STATE = {
  connectionStatus: "connecting" as ConnectionStatus,
  isConnected: false,
  currentCode: "",
  language: "javascript" as SupportedLanguage,
  activeUsers: [] as AwarenessUser[],
  cursors: {} as Record<string, RemoteCursor>,
  messages: [] as RoomChatMessage[],
  isExecuting: false,
  executionOutput: null as string | null,
  executionError: null as string | null,
  executionHistory: [] as Execution[],
  aiSuggestion: null as string | null,
};

export const useEditorStore = create<EditorState>((set) => ({
  ...INITIAL_STATE,

  setConnectionStatus: (status) =>
    set({ connectionStatus: status, isConnected: status === "connected" }),
  setCurrentCode: (code) => set({ currentCode: code }),
  setLanguage: (language) => set({ language }),

  setActiveUsers: (users) => set({ activeUsers: users }),
  upsertCursor: (cursor) =>
    set((state) => ({
      cursors: { ...state.cursors, [cursor.userId]: cursor },
    })),
  removeCursor: (userId) =>
    set((state) => {
      if (!(userId in state.cursors)) return state;
      const next = { ...state.cursors };
      delete next[userId];
      return { cursors: next };
    }),

  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) =>
      state.messages.some((m) => m.id === message.id)
        ? state
        : { messages: [...state.messages, message] },
    ),

  setExecuting: (executing) => set({ isExecuting: executing }),
  setExecutionResult: ({ output, error }) =>
    set({ executionOutput: output, executionError: error }),
  addExecution: (execution) =>
    set((state) => ({
      executionHistory: [execution, ...state.executionHistory].slice(0, 50),
    })),
  setExecutionHistory: (history) => set({ executionHistory: history }),
  clearExecutionOutput: () =>
    set({ executionOutput: null, executionError: null }),
  clearExecutionHistory: () => set({ executionHistory: [] }),

  setAiSuggestion: (suggestion) => set({ aiSuggestion: suggestion }),

  reset: () => set({ ...INITIAL_STATE }),
}));
