import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "./api";
import type { TeamMode } from "./matchDay";
import type { Position } from "./clubData";

/** What a player's rating responds to; each set per position. */
export type RatingWeightKey =
  | "win"
  | "loss"
  | "goal"
  | "assist"
  | "cleanSheet"
  | "goalConceded"
  | "ownGoal"
  | "yellowCard"
  | "redCard";

/** Every weight is entered as a positive amount; these ones are taken away. */
export const RATING_PENALTIES: RatingWeightKey[] = ["loss", "goalConceded", "ownGoal", "yellowCard", "redCard"];

export type PositionWeights = Record<RatingWeightKey, number>;

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
  ratingPositions: Record<Position, PositionWeights>;
  ratingMaxSwing: number;
  valeAutoAwards: boolean;
}

// Mirrors PlayerRatings::defaultPositionWeights() on the backend.
const baseWeights = { win: 0.1, loss: 0.1, goal: 0.12, assist: 0.08, goalConceded: 0, ownGoal: 0.08, yellowCard: 0.05, redCard: 0.15 };

/** The rating-weight fields, restorable as a group from Settings. */
export const DEFAULT_RATING_WEIGHTS = {
  ratingPositions: {
    GK: { ...baseWeights, cleanSheet: 0.15 },
    DEF: { ...baseWeights, cleanSheet: 0.12 },
    MID: { ...baseWeights, cleanSheet: 0.05 },
    FWD: { ...baseWeights, cleanSheet: 0 },
  },
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

// camelCase field → the API's snake_case field (e.g. ratingMaxSwing → rating_max_swing).
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
