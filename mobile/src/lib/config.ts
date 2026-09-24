import Constants from "expo-constants";

// Where the Laravel API lives. Set EXPO_PUBLIC_API_URL for anything other
// than local development. In development we fall back to the machine running
// Metro (the same host the phone already reaches), on `php artisan serve`'s
// port — so a physical phone on the same Wi-Fi works without configuration,
// provided the API is served with `--host 0.0.0.0`.
function devMachineApiUrl(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  return host ? `http://${host}:8000/api` : null;
}

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || devMachineApiUrl() || "http://localhost:8000/api"
).replace(/\/+$/, "");

export const API_ORIGIN = new URL(API_URL).origin;

const LOOPBACK = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

/**
 * Media URLs are built by Laravel from APP_URL, which is usually
 * http://localhost:8000 in development — unreachable from a phone. Point
 * loopback and relative URLs at the host the app actually talks to.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("/")) return `${API_ORIGIN}${url}`;
  try {
    const parsed = new URL(url);
    if (LOOPBACK.has(parsed.hostname) && !LOOPBACK.has(new URL(API_ORIGIN).hostname)) {
      return `${API_ORIGIN}${parsed.pathname}${parsed.search}`;
    }
    return url;
  } catch {
    return null;
  }
}

/** The public web site — used for links the committee shares, like /join. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || "https://noisersfc.com").replace(/\/+$/, "");
