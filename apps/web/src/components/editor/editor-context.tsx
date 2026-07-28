"use client";

import type { Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CodeEditor = MonacoEditor.IStandaloneCodeEditor;

interface EditorInstanceValue {
  editor: CodeEditor | null;
  monaco: Monaco | null;
  setInstances: (editor: CodeEditor, monaco: Monaco) => void;
}

const EditorInstanceContext = createContext<EditorInstanceValue | null>(null);

// Shares the live Monaco editor + namespace across sibling panels (live
// cursors overlay, AI assistant) that need to read positions or register
// providers once the editor has mounted.
export function EditorInstanceProvider({ children }: { children: ReactNode }) {
  const [instances, setInstancesState] = useState<{
    editor: CodeEditor | null;
    monaco: Monaco | null;
  }>({ editor: null, monaco: null });

  const setInstances = useCallback((editor: CodeEditor, monaco: Monaco) => {
    setInstancesState({ editor, monaco });
  }, []);

  const value = useMemo<EditorInstanceValue>(
    () => ({ editor: instances.editor, monaco: instances.monaco, setInstances }),
    [instances.editor, instances.monaco, setInstances],
  );

  return (
    <EditorInstanceContext.Provider value={value}>
      {children}
    </EditorInstanceContext.Provider>
  );
}

export function useEditorInstance(): EditorInstanceValue {
  const ctx = useContext(EditorInstanceContext);
  if (!ctx) {
    throw new Error(
      "useEditorInstance must be used within an EditorInstanceProvider",
    );
  }
  return ctx;
}
