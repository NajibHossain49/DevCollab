"use client";

import { Fragment, type ReactNode } from "react";

// Renders an AI explanation as a clean, documentation-style layout instead of
// raw Markdown. The model may still emit Markdown symbols (**, ##, `code`,
// fenced blocks, numbered/dashed lists); this renderer interprets them into
// styled elements so none of the raw syntax is ever shown to the user.

// Parses inline spans within a line: `code` → highlighted code, **text** →
// emphasized keyword. Everything else is plain text.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let token = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Fragment key={`${keyPrefix}-t-${token}`}>
          {text.slice(lastIndex, match.index)}
        </Fragment>,
      );
    }

    const raw = match[0];
    if (raw.startsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${token}`}
          className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[0.8125rem] text-primary"
        >
          {raw.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(
        <strong
          key={`${keyPrefix}-b-${token}`}
          className="font-semibold text-foreground"
        >
          {raw.slice(2, -2)}
        </strong>,
      );
    }

    lastIndex = pattern.lastIndex;
    token += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <Fragment key={`${keyPrefix}-t-${token}`}>
        {text.slice(lastIndex)}
      </Fragment>,
    );
  }

  return nodes;
}

// Removes leading list markers / heading hashes so heading text stays clean.
function stripHeadingMarkers(text: string): string {
  return text.replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").trim();
}

export function ExplanationView({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  let paragraph: string[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushParagraph = (): void => {
    const content = paragraph.join(" ").trim();
    paragraph = [];
    if (!content) return;
    blocks.push(
      <p
        key={`blk-${key++}`}
        className="text-sm leading-relaxed text-foreground/90"
      >
        {renderInline(content, `p-${key}`)}
      </p>,
    );
  };

  const flushList = (): void => {
    const items = listItems;
    listItems = [];
    if (items.length === 0) return;
    blocks.push(
      <ul key={`blk-${key++}`} className="space-y-1.5">
        {items.map((item, idx) => (
          <li
            key={`li-${key}-${idx}`}
            className="flex gap-2 text-sm leading-relaxed text-foreground/90"
          >
            <span className="mt-[0.15rem] select-none text-primary">•</span>
            <span className="min-w-0 flex-1">
              {renderInline(item, `li-${key}-${idx}`)}
            </span>
          </li>
        ))}
      </ul>,
    );
  };

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = (lines[i] ?? "").trim();

    // Fenced code block → render as a plain code box (no visible backticks).
    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushList();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i += 1;
      }
      const code = codeLines.join("\n").replace(/\n+$/, "");
      if (code) {
        blocks.push(
          <pre
            key={`blk-${key++}`}
            className="overflow-x-auto rounded-md border border-border bg-muted/60 p-3 font-mono text-xs leading-relaxed"
          >
            {code}
          </pre>,
        );
      }
      continue;
    }

    // Blank line ends the current paragraph / list.
    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }

    // Heading: "# ..." through "###### ..." or a line that is entirely bold.
    const isHashHeading = /^#{1,6}\s+/.test(trimmed);
    const isBoldHeading = /^\*\*[^*]+\*\*:?$/.test(trimmed);
    if (isHashHeading || isBoldHeading) {
      flushParagraph();
      flushList();
      blocks.push(
        <h4
          key={`blk-${key++}`}
          className="pt-1 text-[0.9375rem] font-semibold tracking-tight text-foreground"
        >
          {stripHeadingMarkers(trimmed)}
        </h4>,
      );
      continue;
    }

    // List item: -, *, • or "1." / "1)" style.
    const bullet = trimmed.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      listItems.push(bullet[1] ?? "");
      continue;
    }

    // Otherwise it's part of a paragraph.
    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return <div className="space-y-3">{blocks}</div>;
}
