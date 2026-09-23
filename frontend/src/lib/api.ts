// Thin fetch wrapper for the handful of features wired to the real Laravel
// API (admin login, club settings). Everything else in the app still runs
// on localStorage — see lib/*Context.tsx.

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";
const TOKEN_KEY = "noisers_token";

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore — session still works for this tab
  }
}

export class ApiError extends Error {}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const data: { message?: string; errors?: Record<string, string[]> } | null = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const firstFieldError = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
    const message = data?.message ?? firstFieldError ?? "Something went wrong.";
    throw new ApiError(message);
  }

  return data as T;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  return handleResponse<T>(response);
}

// Multipart upload (file uploads) — same auth/error handling as apiFetch, but
// leaves Content-Type unset so the browser adds the multipart boundary.
export async function apiFetchForm<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers = new Headers();
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  return handleResponse<T>(response);
}
