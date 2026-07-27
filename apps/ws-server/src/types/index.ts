// Global HTTP types for the ws-server (see .cursor/rules.md Section 5.3).

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
