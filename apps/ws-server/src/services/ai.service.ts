import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/errors.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "llama-3.1-8b-instant";
const MAX_TOKENS = 150;
const TEMPERATURE = 0.2;

interface CursorPosition {
  line: number;
  ch: number;
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

// Reads a fetch response body line-by-line (handles NDJSON and SSE payloads).
async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      buffer += decoder.decode(result.value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        yield line;
        newlineIndex = buffer.indexOf("\n");
      }
    }
    if (buffer.length > 0) {
      yield buffer;
    }
  } finally {
    reader.releaseLock();
  }
}

function buildCompletionMessages(code: string, language: string): ChatMessage[] {
  return [
    { role: "system", content: "You are a code completion assistant. Complete the code concisely." },
    { role: "user", content: `Complete this ${language} code:\n\n${code}` },
  ];
}

function buildExplainMessages(code: string, language: string): ChatMessage[] {
  return [
    { role: "system", content: "You are a helpful assistant that explains code clearly and concisely." },
    { role: "user", content: `Explain this ${language} code:\n\n${code}` },
  ];
}

async function* streamGroq(messages: ChatMessage[]): AsyncGenerator<string> {
  if (!env.GROQ_API_KEY) {
    throw new AppError("AI_UNAVAILABLE", "No AI provider available (Groq API key not configured)", 503);
  }

  const response = await fetch(`${GROQ_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      stream: true,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    }),
  });

  if (!response.ok || !response.body) {
    throw new AppError("AI_UNAVAILABLE", `Groq request failed (${response.status})`, 502);
  }

  for await (const line of readLines(response.body)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
      continue;
    }
    const data = trimmed.slice("data:".length).trim();
    if (data === "[DONE]") {
      break;
    }
    const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
    const content = parsed.choices?.[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

// Streams a code completion via Groq.
export async function* getCompletion(
  code: string,
  language: string,
  _cursorPosition: CursorPosition,
): AsyncGenerator<string> {
  yield* streamGroq(buildCompletionMessages(code, language));
  logger.info({ language }, "AI completion served via Groq");
}

async function groqChatOnce(messages: ChatMessage[]): Promise<string> {
  if (!env.GROQ_API_KEY) {
    throw new AppError("AI_UNAVAILABLE", "No AI provider available (Groq API key not configured)", 503);
  }

  const response = await fetch(`${GROQ_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: TEMPERATURE }),
  });

  if (!response.ok) {
    throw new AppError("AI_UNAVAILABLE", `Groq request failed (${response.status})`, 502);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

// Returns a one-shot explanation via Groq.
export async function explainCode(code: string, language: string): Promise<string> {
  const explanation = await groqChatOnce(buildExplainMessages(code, language));
  logger.info({ language }, "AI explanation served via Groq");
  return explanation;
}
