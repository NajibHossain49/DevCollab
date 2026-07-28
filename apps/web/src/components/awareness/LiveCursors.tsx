"use client";

import { useEffect, useReducer } from "react";

import { useEditorInstance } from "@/components/editor/editor-context";
import type { RemoteCursor } from "@/lib/ws-messages";
import { useEditorStore } from "@/stores/editor.store";

// Overlay that renders remote users' cursors on top of the editor. Positions
// are recomputed on scroll/layout/cursor changes using Monaco's coordinate API.
export function LiveCursors() {
  const { editor } = useEditorInstance();
  const cursors = useEditorStore((s) => s.cursors);
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!editor) return;
    const disposables = [
      editor.onDidScrollChange(() => rerender()),
      editor.onDidLayoutChange(() => rerender()),
      editor.onDidChangeCursorPosition(() => rerender()),
    ];
    return () => disposables.forEach((d) => d.dispose());
  }, [editor]);

  if (!editor) return null;

  const layout = editor.getLayoutInfo();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Object.values(cursors).map((cursor) => {
        const pos = editor.getScrolledVisiblePosition({
          lineNumber: cursor.position.line + 1,
          column: cursor.position.ch + 1,
        });
        if (!pos) return null;
        // Hide cursors scrolled out of the visible editor region.
        if (
          pos.top < 0 ||
          pos.top > layout.height ||
          pos.left < 0 ||
          pos.left > layout.width
        ) {
          return null;
        }

        return (
          <CursorFlag
            key={cursor.userId}
            cursor={cursor}
            top={pos.top}
            left={pos.left}
            height={pos.height}
          />
        );
      })}
    </div>
  );
}

interface CursorFlagProps {
  cursor: RemoteCursor;
  top: number;
  left: number;
  height: number;
}

function CursorFlag({ cursor, top, left, height }: CursorFlagProps) {
  return (
    <div
      className="absolute left-0 top-0 transition-transform duration-75 ease-linear"
      style={{ transform: `translate(${left}px, ${top}px)` }}
    >
      <div style={{ width: 2, height, backgroundColor: cursor.color }} />
      <div
        className="absolute left-0 top-0 -translate-y-full whitespace-nowrap rounded px-1 py-0.5 text-[10px] font-medium leading-none text-white shadow-sm"
        style={{ backgroundColor: cursor.color }}
      >
        {cursor.userName}
      </div>
    </div>
  );
}
