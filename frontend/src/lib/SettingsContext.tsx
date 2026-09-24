import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "./api";
import type { TeamMode } from "./matchDay";

export interface ClubSettings {
  yellowCardFine: number;
  redCardFine: number;
  finesFromMatchDay: boolean;
  matchTeamSize: number;
  matchWinGoals: number;
  matchGameMinutes: number;
  matchDefaultTeamMode: TeamMode;
  matchDefaultVenue: string;
  ratingsEnabled: boolean;
  ratingNewPlayer: number;
  ratingWin: number;
  ratingLoss: number;
  ratingGoal: number;
  ratingAssist: number;
  ratingOwnGoal: number;
  ratingCleanSheetGk: number;
  ratingCleanSheetDef: number;
  ratingCleanSheetMid: number;
  ratingCleanSheetFwd: number;
  ratingYellowCard: number;
  ratingRedCard: number;
  ratingMaxSwing: number;
  valeAutoAwards: boolean;
}

/** The rating-weight fields, restorable as a group from Settings. */
export const DEFAULT_RATING_WEIGHTS = {
  ratingWin: 0.1,
  ratingLoss: 0.1,
  ratingGoal: 0.12,
  ratingAssist: 0.08,
  ratingOwnGoal: 0.08,
  ratingCleanSheetGk: 0.15,
  ratingCleanSheetDef: 0.12,
  ratingCleanSheetMid: 0.05,
  ratingCleanSheetFwd: 0,
  ratingYellowCard: 0.05,
  ratingRedCard: 0.15,
  ratingMaxSwing: 0.5,
} satisfies Partial<ClubSettings>;

// Matches the values that used to be hardcoded in the frontend — shown
// while the real settings are loading, and if the API can't be reached.
export const DEFAULT_SETTINGS: ClubSettings = {
  yellowCardFine: 2000,
  redCardFine: 5000,
  finesFromMatchDay: true,
  matchTeamSize: 6,
  matchWinGoals: 2,
  matchGameMinutes: 10,
  matchDefaultTeamMode: "random",
  matchDefaultVenue: "",
  ratingsEnabled: true,
  ratingNewPlayer: 6,
  ...DEFAULT_RATING_WEIGHTS,
  valeAutoAwards: true,
};

// camelCase field → the API's snake_case column (e.g. ratingCleanSheetGk → rating_clean_sheet_gk).
function toSnake(key: string) {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

interface SettingsContextValue {
  settings: ClubSettings;
  loading: boolean;
  error: string;
  updateSettings: (patch: Partial<ClubSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ClubSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ data: ClubSettings }>("/settings")
      .then((res) => setSettings({ ...DEFAULT_SETTINGS, ...res.data }))
      .catch(() => {
        // API unreachable — keep the defaults, app still works.
      })
      .finally(() => setLoading(false));
  }, []);

  async function updateSettings(patch: Partial<ClubSettings>) {
    setError("");
    const body = Object.fromEntries(
      Object.entries(patch)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [toSnake(k), v]),
    );
    try {
      const res = await apiFetch<{ data: ClubSettings }>("/settings", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setSettings({ ...DEFAULT_SETTINGS, ...res.data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save settings.");
      throw err;
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, error, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
