export interface PageRequest {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, unknown>;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  status: number;
  title: string;
  detail?: string;
  traceId?: string;
  errors?: Record<string, string[]>;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError };

export interface AuditMeta {
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}
