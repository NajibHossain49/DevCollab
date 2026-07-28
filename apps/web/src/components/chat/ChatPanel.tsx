"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useYjs } from "@/components/editor/YjsProvider";
import { Avatar, initialsFromName } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { formatRelativeTime } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor.store";

export function ChatPanel() {
  const { user } = useAuth();
  const { sendChat } = useYjs();
  const messages = useEditorStore((s) => s.messages);

  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = (event: React.FormEvent): void => {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    sendChat(content);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((message) => {
            const isOwn = message.userId === user?.id;
            return (
              <div key={message.id} className="flex items-start gap-2">
                <Avatar
                  src={message.avatar}
                  alt={message.userName}
                  fallback={initialsFromName(message.userName)}
                  className="size-7"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-xs font-medium">
                      {isOwn ? "You" : message.userName}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatRelativeTime(message.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
                    {message.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message the room…"
          aria-label="Chat message"
        />
        <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send">
          <Send />
        </Button>
      </form>
    </div>
  );
}
