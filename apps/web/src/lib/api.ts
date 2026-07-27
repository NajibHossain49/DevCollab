import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
} from "axios";

import type {
  AiExplainInput,
  ApiErrorBody,
  ApiResponse,
  CreateRoomInput,
  Execution,
  ExecuteCodeInput,
  MemberRole,
  PaginationMeta,
  PaginationParams,
  Room,
  RoomMember,
  UpdateRoomInput,
  User,
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ---------------------------------------------------------------------------
// Auth token injection. The token is set from the session layer (see
// AuthProvider) rather than read directly here, keeping this module
// framework-agnostic.
// ---------------------------------------------------------------------------
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

// Normalized error thrown by every API call so callers get a consistent shape.
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor: attach the bearer token when available.
apiClient.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.set("Authorization", `Bearer ${authToken}`);
  }
  return config;
});

// Response interceptor: redirect on 401 and normalize errors.
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<unknown>>) => {
    const status = error.response?.status ?? 0;

    if (status === 401 && typeof window !== "undefined") {
      // Session expired / missing — send the user to sign in.
      window.location.href = "/login";
    }

    const body = error.response?.data?.error;
    const normalized: ApiErrorBody = body ?? {
      code: status === 0 ? "NETWORK_ERROR" : "REQUEST_FAILED",
      message: error.message || "Request failed",
    };

    return Promise.reject(
      new ApiError(normalized.code, normalized.message, status, normalized.details),
    );
  },
);

// Unwraps the standard { success, data, meta } envelope.
async function request<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const response = await apiClient.request<ApiResponse<T>>(config);
  return response.data;
}

interface Paginated<T> {
  items: T[];
  meta: PaginationMeta | undefined;
}

// ---------------------------------------------------------------------------
// Typed endpoint methods (mirror ws-server routes).
// ---------------------------------------------------------------------------

export const authApi = {
  signin: (provider: "github" = "github"): Promise<ApiResponse<{ url: string }>> =>
    request({ method: "POST", url: "/api/auth/signin", data: { provider } }),

  callbackGithub: (
    code: string,
    state: string,
  ): Promise<ApiResponse<{ user: User; token: string }>> =>
    request({ method: "POST", url: "/api/auth/callback/github", params: { code, state } }),

  signout: (): Promise<ApiResponse<null>> =>
    request({ method: "POST", url: "/api/auth/signout" }),

  session: (): Promise<ApiResponse<{ user: User | null }>> =>
    request({ method: "GET", url: "/api/auth/session" }),
};

export const roomsApi = {
  list: async (params: PaginationParams = {}): Promise<Paginated<Room>> => {
    const res = await request<{ rooms: Room[] }>({
      method: "GET",
      url: "/api/rooms",
      params,
    });
    return { items: res.data?.rooms ?? [], meta: res.meta };
  },

  get: (slug: string): Promise<ApiResponse<{ room: Room }>> =>
    request({ method: "GET", url: `/api/rooms/${slug}` }),

  create: (data: CreateRoomInput): Promise<ApiResponse<{ room: Room }>> =>
    request({ method: "POST", url: "/api/rooms", data }),

  update: (slug: string, data: UpdateRoomInput): Promise<ApiResponse<{ room: Room }>> =>
    request({ method: "PUT", url: `/api/rooms/${slug}`, data }),

  remove: (slug: string): Promise<ApiResponse<null>> =>
    request({ method: "DELETE", url: `/api/rooms/${slug}` }),

  join: (slug: string): Promise<ApiResponse<{ membership: RoomMember }>> =>
    request({ method: "POST", url: `/api/rooms/${slug}/join` }),

  leave: (slug: string): Promise<ApiResponse<null>> =>
    request({ method: "POST", url: `/api/rooms/${slug}/leave` }),

  updateMemberRole: (
    slug: string,
    userId: string,
    role: MemberRole,
  ): Promise<ApiResponse<{ membership: RoomMember }>> =>
    request({ method: "POST", url: `/api/rooms/${slug}/members/${userId}/role`, data: { role } }),

  removeMember: (slug: string, userId: string): Promise<ApiResponse<null>> =>
    request({ method: "DELETE", url: `/api/rooms/${slug}/members/${userId}` }),
};

export const executeApi = {
  run: (data: ExecuteCodeInput): Promise<ApiResponse<{ execution: Execution }>> =>
    request({ method: "POST", url: "/api/execute", data }),

  history: async (
    roomId: string,
    params: PaginationParams = {},
  ): Promise<Paginated<Execution>> => {
    const res = await request<{ executions: Execution[] }>({
      method: "GET",
      url: `/api/execute/history/${roomId}`,
      params,
    });
    return { items: res.data?.executions ?? [], meta: res.meta };
  },
};

export const aiApi = {
  explain: (data: AiExplainInput): Promise<ApiResponse<{ explanation: string }>> =>
    request({ method: "POST", url: "/api/ai/explain", data }),

  // Streaming completion (SSE). Returns the raw Response so callers can read
  // the token stream; token is attached manually since this bypasses axios.
  completeStream: (
    body: { code: string; language: string; cursorPosition: { line: number; ch: number } },
    signal?: AbortSignal,
  ): Promise<Response> =>
    fetch(`${API_BASE_URL}/api/ai/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(body),
      credentials: "include",
      signal,
    }),
};

export const api = {
  auth: authApi,
  rooms: roomsApi,
  execute: executeApi,
  ai: aiApi,
};
