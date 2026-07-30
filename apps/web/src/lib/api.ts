import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
} from "axios";

import type {
  AiExplainInput,
  ApiErrorBody,
  ApiResponse,
  CreateOrgInput,
  CreateRoomInput,
  Execution,
  ExecuteCodeInput,
  InviteMemberInput,
  InviteResult,
  MemberRole,
  Organization,
  OrganizationMember,
  OrgAnalytics,
  OrgRole,
  PaginationMeta,
  PaginationParams,
  Room,
  RoomMember,
  UpdateOrgInput,
  UpdateRoomInput,
  User,
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ---------------------------------------------------------------------------
// Auth token management. The API server (ws-server) authenticates every
// request with an HS256 JWT signed by the web app's /api/ws-token route using
// the same secret as the ws-server's NEXTAUTH_SECRET. We fetch that token
// lazily, cache it until shortly before it expires, and refresh on demand.
// This is the SAME token the WebSocket collab provider uses, keeping REST and
// WebSocket auth consistent. (Previously the raw GitHub OAuth access token was
// sent, which the ws-server could not verify — causing 401s on every call.)
// ---------------------------------------------------------------------------
interface CachedToken {
  token: string;
  /** Expiry in unix seconds, decoded from the JWT. */
  exp: number;
}

let cachedToken: CachedToken | null = null;
let inFlight: Promise<string | null> | null = null;

function decodeJwtExp(token: string): number {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return 0;
    }
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };
    return typeof json.exp === "number" ? json.exp : 0;
  } catch {
    return 0;
  }
}

// Drops the cached token so the next request mints a fresh one. Call on
// sign-out or when the active account changes.
export function clearAuthToken(): void {
  cachedToken = null;
  inFlight = null;
}

async function requestWsToken(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    // Same-origin request to the Next.js route (NOT the API base URL): it reads
    // the Auth.js session cookie and mints a JWT the API server can verify.
    const res = await fetch("/api/ws-token", {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as { data?: { token?: string } };
    const token = json.data?.token;
    if (typeof token !== "string") {
      return null;
    }
    cachedToken = { token, exp: decodeJwtExp(token) };
    return token;
  } catch {
    return null;
  }
}

async function getAuthToken(): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 30 > now) {
    return cachedToken.token;
  }
  // De-dupe concurrent fetches so a burst of requests shares one token fetch.
  inFlight ??= requestWsToken().finally(() => {
    inFlight = null;
  });
  return inFlight;
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

// Request interceptor: attach a fresh bearer token to every request.
apiClient.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// Response interceptor: on 401, refresh the token and retry ONCE, then
// normalize errors. We intentionally do NOT hard-redirect to /login here —
// doing so created an infinite dashboard<->login loop, since the login page
// bounces authenticated users straight back to the dashboard. Session expiry
// is handled by Auth.js (useAuth) instead.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const status = error.response?.status ?? 0;
    const config = error.config as
      | (AxiosRequestConfig & { _retried?: boolean })
      | undefined;

    if (status === 401 && config && !config._retried) {
      config._retried = true;
      clearAuthToken();
      const token = await getAuthToken();
      if (token) {
        return apiClient.request(config);
      }
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

export interface Paginated<T> {
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

export const orgsApi = {
  list: async (): Promise<Organization[]> => {
    const res = await request<{ organizations: Organization[] }>({
      method: "GET",
      url: "/api/orgs",
    });
    return res.data?.organizations ?? [];
  },

  get: (slug: string): Promise<ApiResponse<{ organization: Organization }>> =>
    request({ method: "GET", url: `/api/orgs/${slug}` }),

  create: (data: CreateOrgInput): Promise<ApiResponse<{ organization: Organization }>> =>
    request({ method: "POST", url: "/api/orgs", data }),

  update: (
    slug: string,
    data: UpdateOrgInput,
  ): Promise<ApiResponse<{ organization: Organization }>> =>
    request({ method: "PUT", url: `/api/orgs/${slug}`, data }),

  analytics: (slug: string): Promise<ApiResponse<{ analytics: OrgAnalytics }>> =>
    request({ method: "GET", url: `/api/orgs/${slug}/analytics` }),

  invite: (
    slug: string,
    data: InviteMemberInput,
  ): Promise<ApiResponse<{ invite: InviteResult }>> =>
    request({ method: "POST", url: `/api/orgs/${slug}/invite`, data }),

  acceptInvite: (
    token: string,
  ): Promise<ApiResponse<{ membership: OrganizationMember }>> =>
    request({ method: "POST", url: "/api/orgs/invite/accept", data: { token } }),

  updateMemberRole: (
    slug: string,
    userId: string,
    role: Exclude<OrgRole, "OWNER">,
  ): Promise<ApiResponse<{ membership: OrganizationMember }>> =>
    request({
      method: "PUT",
      url: `/api/orgs/${slug}/members/${userId}/role`,
      data: { role },
    }),

  removeMember: (slug: string, userId: string): Promise<ApiResponse<null>> =>
    request({ method: "DELETE", url: `/api/orgs/${slug}/members/${userId}` }),
};

// A free-tier backend can take ~30-60s to cold-start from sleep, so give code
// execution a long timeout before giving up.
const EXECUTION_TIMEOUT_MS = 90_000;

// Errors that typically mean the server is asleep/starting rather than a real
// failure: no response (network/timeout) or a gateway status from the platform.
function isColdStartError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return (
    err.status === 0 ||
    err.status === 502 ||
    err.status === 503 ||
    err.status === 504
  );
}

// Retries `fn` a few times when the failure looks like a cold start, with a
// short increasing backoff. Non-cold-start errors are rethrown immediately.
async function retryOnColdStart<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isColdStartError(err) || attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
  throw lastError;
}

export const executeApi = {
  run: (data: ExecuteCodeInput): Promise<ApiResponse<{ execution: Execution }>> =>
    retryOnColdStart(() =>
      request({
        method: "POST",
        url: "/api/execute",
        data,
        timeout: EXECUTION_TIMEOUT_MS,
      }),
    ),

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

  clearHistory: (roomId: string): Promise<ApiResponse<{ cleared: number }>> =>
    request({ method: "DELETE", url: `/api/execute/history/${roomId}` }),
};

export const aiApi = {
  explain: (data: AiExplainInput): Promise<ApiResponse<{ explanation: string }>> =>
    request({ method: "POST", url: "/api/ai/explain", data }),

  // Streaming completion (SSE). Returns the raw Response so callers can read
  // the token stream; token is attached manually since this bypasses axios.
  completeStream: async (
    body: { code: string; language: string; cursorPosition: { line: number; ch: number } },
    signal?: AbortSignal,
  ): Promise<Response> => {
    const token = await getAuthToken();
    return fetch(`${API_BASE_URL}/api/ai/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      credentials: "include",
      signal,
    });
  },
};

export const api = {
  auth: authApi,
  rooms: roomsApi,
  orgs: orgsApi,
  execute: executeApi,
  ai: aiApi,
};
