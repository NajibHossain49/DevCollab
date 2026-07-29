// Re-export everything shared between backend and frontend.
export * from "@devcollab/shared-types";

// ---------------------------------------------------------------------------
// Frontend-facing API contracts (mirror the ws-server responses; dates are
// serialized as ISO strings over JSON).
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorBody;
  meta?: PaginationMeta;
}

export type MemberRole = "OWNER" | "EDITOR" | "VIEWER";

export type ExecutionStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "ERROR"
  | "TIMEOUT";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  githubId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  language: string;
  isPublic: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  // Present only on detail responses (GET /api/rooms/:slug).
  owner?: User;
  members?: RoomMember[];
  // Aggregate count returned by some endpoints; absent on the bare list view.
  _count?: { members: number };
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  role: MemberRole;
  // The API returns `joinedAt`; `createdAt` is kept for backwards compatibility.
  joinedAt?: string;
  createdAt?: string;
  user?: User;
}

export interface Execution {
  id: string;
  roomId: string;
  userId: string;
  language: string;
  code: string;
  output: string | null;
  error: string | null;
  status: ExecutionStatus;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: User;
}

// ---------------------------------------------------------------------------
// Request payloads.
// ---------------------------------------------------------------------------

export interface CreateRoomInput {
  name: string;
  description?: string;
  language: string;
  isPublic?: boolean;
}

export type UpdateRoomInput = Partial<CreateRoomInput>;

export interface ExecuteCodeInput {
  roomId: string;
  code: string;
  language: string;
}

export interface CursorPosition {
  line: number;
  ch: number;
}

export interface AiCompleteInput {
  code: string;
  language: string;
  cursorPosition: CursorPosition;
}

export interface AiExplainInput {
  code: string;
  language: string;
}

// ---------------------------------------------------------------------------
// Frontend-only helper types.
// ---------------------------------------------------------------------------

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

// Languages supported by the code-execution backend (mapped to execution-API
// language slugs server-side). Used by the create-room form and language
// badges. TypeScript is transpiled server-side (types stripped, not checked).
export const SUPPORTED_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["value"];
