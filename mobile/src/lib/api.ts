// Thin fetch wrapper around the Laravel API — the mobile twin of
// frontend/src/lib/api.ts. The Sanctum token lives in memory for requests
// and in SecureStore across launches (see lib/auth.tsx).

import { API_URL } from "./config";

let token: string | null = null;

export function setApiToken(next: string | null) {
  token = next;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 15000;

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; form?: FormData; timeoutMs?: number } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  // FormData sets its own multipart Content-Type (with the boundary).
  if (options.body !== undefined && !options.form) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(`Can't reach the club server at ${API_URL}. Check your connection.`, 0);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;

  const data: { message?: string; errors?: Record<string, string[]> } | null = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const firstFieldError = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
    throw new ApiError(firstFieldError ?? data?.message ?? "Something went wrong.", response.status);
  }

  return data as T;
}

export function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}
