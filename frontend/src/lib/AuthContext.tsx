import { createContext, useContext, useState, type ReactNode } from "react";
import { useLocalStorageState } from "./useLocalStorageState";

export type UserRole = "admin" | "player";

export interface AuthUser {
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => boolean;
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

  function login(email: string, password: string) {
    if (!email.trim() || !password.trim()) return false;
    const name = email.split("@")[0].replace(/[._]/g, " ");
    persist({
      name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
      email: email.trim(),
      role: "admin",
    });
    return true;
  }

  function loginAsPlayer(passcode: string) {
    if (passcode.trim() !== playerPasscode) return false;
    persist({ name: "Squad access", email: "players@noisersfc.com", role: "player" });
    return true;
  }

  function logout() {
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
