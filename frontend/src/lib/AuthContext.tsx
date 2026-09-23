import { createContext, useContext, useState, type ReactNode } from "react";
import { useLocalStorageState } from "./useLocalStorageState";
import { apiFetch, setToken } from "./api";

export type UserRole = "admin" | "player";

export interface AuthUser {
  name: string;
  email: string;
  role: UserRole;
  /** Raw backend role, kept so Settings can tell admin apart from committee. */
  staffRole?: "admin" | "committee";
}

interface LoginResponse {
  token: string;
  user: { id: number; name: string; email: string; role: "admin" | "committee" };
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  loginAsPlayer: (passcode: string) => boolean;
  logout: () => void;
  playerPasscode: string;
  setPlayerPasscode: (passcode: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "noisers_auth_user";
const DEFAULT_PASSCODE = "vale2zenith";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [playerPasscode, setPlayerPasscode] = useLocalStorageState(
    "noisers_player_passcode",
    DEFAULT_PASSCODE,
  );

  function persist(nextUser: AuthUser | null) {
    setUser(nextUser);
    try {
      if (nextUser) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore — session still works for this tab
    }
  }

  async function login(email: string, password: string) {
    const { token, user: staff } = await apiFetch<LoginResponse>("/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), password, device_name: "web" }),
    });
    setToken(token);
    persist({ name: staff.name, email: staff.email, role: "admin", staffRole: staff.role });
  }

  function loginAsPlayer(passcode: string) {
    if (passcode.trim() !== playerPasscode) return false;
    persist({ name: "Squad access", email: "players@noisersfc.com", role: "player" });
    return true;
  }

  function logout() {
    apiFetch("/logout", { method: "POST" }).catch(() => {
      // best-effort — clear the local session regardless
    });
    setToken(null);
    persist(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, login, loginAsPlayer, logout, playerPasscode, setPlayerPasscode }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
