import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "./api";

export interface ClubSettings {
  yellowCardFine: number;
  redCardFine: number;
  matchTeamSize: number;
  matchWinGoals: number;
}

// Matches the values that used to be hardcoded in the frontend — shown
// while the real settings are loading, and if the API can't be reached.
export const DEFAULT_SETTINGS: ClubSettings = {
  yellowCardFine: 2000,
  redCardFine: 5000,
  matchTeamSize: 6,
  matchWinGoals: 2,
};

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
      .then((res) => setSettings(res.data))
      .catch(() => {
        // API unreachable — keep the defaults, app still works.
      })
      .finally(() => setLoading(false));
  }, []);

  async function updateSettings(patch: Partial<ClubSettings>) {
    setError("");
    const body = {
      ...(patch.yellowCardFine !== undefined && { yellow_card_fine: patch.yellowCardFine }),
      ...(patch.redCardFine !== undefined && { red_card_fine: patch.redCardFine }),
      ...(patch.matchTeamSize !== undefined && { match_team_size: patch.matchTeamSize }),
      ...(patch.matchWinGoals !== undefined && { match_win_goals: patch.matchWinGoals }),
    };
    try {
      const res = await apiFetch<{ data: ClubSettings }>("/settings", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setSettings(res.data);
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
