import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { apiFetch, ApiError, setApiToken } from "./api";
import { getItem, setItem } from "./storage";
import type { StaffUser } from "./types";

// Two ways in, as on the web: the squad passcode (checked by the API, so a
// change in Settings applies to every phone) opens the player side, and a
// committee sign-in against Laravel Sanctum opens everything. Staff get their
// own device-named token, so signing out on the phone doesn't sign anyone
// out on the web.

const TOKEN_KEY = "noisers_token";
const USER_KEY = "noisers_staff_user";
const SQUAD_ACCESS_KEY = "noisers_squad_access";

type Status = "restoring" | "signedOut" | "signedIn";

interface AuthContextValue {
  status: Status;
  user: StaffUser | null;
  /** True once the squad passcode was accepted, or a committee member is signed in. */
  hasAccess: boolean;
  /** `beforeEnter` runs once the API accepts, before the app moves on — for a success animation. */
  unlockSquad: (passcode: string, beforeEnter?: () => Promise<void>) => Promise<void>;
  /** Leave the app entirely: forget the passcode and sign any staff member out. */
  leave: () => Promise<void>;
  signIn: (email: string, password: string, beforeEnter?: () => Promise<void>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("restoring");
  const [user, setUser] = useState<StaffUser | null>(null);
  const [squadAccess, setSquadAccess] = useState(false);

  async function clear() {
    setApiToken(null);
    setUser(null);
    setStatus("signedOut");
    await Promise.all([setItem(TOKEN_KEY, null), setItem(USER_KEY, null)]);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, cachedUser, squad] = await Promise.all([
        getItem(TOKEN_KEY),
        getItem(USER_KEY),
        getItem(SQUAD_ACCESS_KEY),
      ]);
      if (cancelled) return;
      setSquadAccess(squad === "1");
      if (!token) {
        setStatus("signedOut");
        return;
      }
      setApiToken(token);
      if (cachedUser) {
        try {
          setUser(JSON.parse(cachedUser) as StaffUser);
        } catch {
          // ignore a corrupt cache — /user below replaces it
        }
      }
      setStatus("signedIn");
      try {
        const fresh = await apiFetch<StaffUser>("/user");
        if (cancelled) return;
        setUser(fresh);
        await setItem(USER_KEY, JSON.stringify(fresh));
      } catch (err) {
        // Revoked or expired token: sign out. Offline: keep the cached session.
        if (!cancelled && err instanceof ApiError && err.status === 401) await clear();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function unlockSquad(passcode: string, beforeEnter?: () => Promise<void>) {
    await apiFetch("/player-login", { method: "POST", body: { passcode: passcode.trim() } });
    await beforeEnter?.();
    setSquadAccess(true);
    await setItem(SQUAD_ACCESS_KEY, "1");
  }

  async function leave() {
    setSquadAccess(false);
    await setItem(SQUAD_ACCESS_KEY, null);
    if (status === "signedIn") await signOut();
  }

  async function signIn(email: string, password: string, beforeEnter?: () => Promise<void>) {
    const res = await apiFetch<{ token: string; user: StaffUser }>("/login", {
      method: "POST",
      body: { email: email.trim(), password, device_name: `mobile-${Platform.OS}` },
    });
    await beforeEnter?.();
    setApiToken(res.token);
    setUser(res.user);
    setStatus("signedIn");
    await Promise.all([setItem(TOKEN_KEY, res.token), setItem(USER_KEY, JSON.stringify(res.user))]);
  }

  async function signOut() {
    // Best-effort token revocation — clear the local session regardless.
    await apiFetch("/logout", { method: "POST" }).catch(() => undefined);
    await clear();
  }

  const hasAccess = squadAccess || status === "signedIn";

  return (
    <AuthContext value={{ status, user, hasAccess, unlockSquad, leave, signIn, signOut }}>{children}</AuthContext>
  );
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
