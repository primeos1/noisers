import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, ApiError } from "./api";

export interface ValeContentData {
  teamOfTheWeek: {
    week: string;
    dateRange: string;
    sessionsWon: number;
    sessionsPlayed: number;
    rivalTeam: string;
    score: string;
    photo: string;
    lineupNumbers: number[];
  };
  playerOfTheWeek: { playerNumber: number; note: string; weekRating: number };
  mostImproved: {
    playerNumber: number;
    note: string;
    previousRating: number;
    currentRating: number;
  };
  weeklyLeaders: {
    topScorer: { playerNumber: number; value: number };
    topAssist: { playerNumber: number; value: number };
    cleanSheets: number[];
  };
}

interface ApiValeContent {
  teamOfTheWeek: {
    title: string | null;
    dateRange: string | null;
    sessionsWon: number | null;
    sessionsPlayed: number | null;
    rivalTeam: string | null;
    score: string | null;
    photoUrl: string | null;
    lineupNumbers: number[];
  };
  playerOfTheWeek: { playerNumber: number | null; note: string | null; weekRating: number | null };
  mostImproved: {
    playerNumber: number | null;
    note: string | null;
    previousRating: number | null;
    currentRating: number | null;
  };
  weeklyLeaders: {
    topScorer: { playerNumber: number | null; value: number | null };
    topAssist: { playerNumber: number | null; value: number | null };
    cleanSheets: number[];
  };
}

export const DEFAULT_VALE_CONTENT: ValeContentData = {
  teamOfTheWeek: {
    week: "",
    dateRange: "",
    sessionsWon: 0,
    sessionsPlayed: 0,
    rivalTeam: "",
    score: "",
    photo: "",
    lineupNumbers: [],
  },
  playerOfTheWeek: { playerNumber: 0, note: "", weekRating: 0 },
  mostImproved: { playerNumber: 0, note: "", previousRating: 0, currentRating: 0 },
  weeklyLeaders: {
    topScorer: { playerNumber: 0, value: 0 },
    topAssist: { playerNumber: 0, value: 0 },
    cleanSheets: [],
  },
};

function fromApi(data: ApiValeContent): ValeContentData {
  return {
    teamOfTheWeek: {
      week: data.teamOfTheWeek.title ?? "",
      dateRange: data.teamOfTheWeek.dateRange ?? "",
      sessionsWon: data.teamOfTheWeek.sessionsWon ?? 0,
      sessionsPlayed: data.teamOfTheWeek.sessionsPlayed ?? 0,
      rivalTeam: data.teamOfTheWeek.rivalTeam ?? "",
      score: data.teamOfTheWeek.score ?? "",
      photo: data.teamOfTheWeek.photoUrl ?? "",
      lineupNumbers: data.teamOfTheWeek.lineupNumbers ?? [],
    },
    playerOfTheWeek: {
      playerNumber: data.playerOfTheWeek.playerNumber ?? 0,
      note: data.playerOfTheWeek.note ?? "",
      weekRating: data.playerOfTheWeek.weekRating ?? 0,
    },
    mostImproved: {
      playerNumber: data.mostImproved.playerNumber ?? 0,
      note: data.mostImproved.note ?? "",
      previousRating: data.mostImproved.previousRating ?? 0,
      currentRating: data.mostImproved.currentRating ?? 0,
    },
    weeklyLeaders: {
      topScorer: {
        playerNumber: data.weeklyLeaders.topScorer.playerNumber ?? 0,
        value: data.weeklyLeaders.topScorer.value ?? 0,
      },
      topAssist: {
        playerNumber: data.weeklyLeaders.topAssist.playerNumber ?? 0,
        value: data.weeklyLeaders.topAssist.value ?? 0,
      },
      cleanSheets: data.weeklyLeaders.cleanSheets ?? [],
    },
  };
}

function toApiBody(patch: Partial<ValeContentData>) {
  const body: Record<string, unknown> = {};
  if (patch.teamOfTheWeek) {
    const t = patch.teamOfTheWeek;
    if (t.week !== undefined) body.team_week_title = t.week;
    if (t.dateRange !== undefined) body.team_week_date_range = t.dateRange;
    if (t.sessionsWon !== undefined) body.team_sessions_won = t.sessionsWon;
    if (t.sessionsPlayed !== undefined) body.team_sessions_played = t.sessionsPlayed;
    if (t.rivalTeam !== undefined) body.team_rival = t.rivalTeam;
    if (t.score !== undefined) body.team_score = t.score;
    if (t.photo !== undefined) body.team_photo_url = t.photo;
    if (t.lineupNumbers !== undefined) body.team_lineup_numbers = t.lineupNumbers;
  }
  if (patch.playerOfTheWeek) {
    const p = patch.playerOfTheWeek;
    if (p.playerNumber !== undefined) body.potw_player_number = p.playerNumber;
    if (p.note !== undefined) body.potw_note = p.note;
    if (p.weekRating !== undefined) body.potw_rating = p.weekRating;
  }
  if (patch.mostImproved) {
    const m = patch.mostImproved;
    if (m.playerNumber !== undefined) body.improved_player_number = m.playerNumber;
    if (m.note !== undefined) body.improved_note = m.note;
    if (m.previousRating !== undefined) body.improved_prev_rating = m.previousRating;
    if (m.currentRating !== undefined) body.improved_curr_rating = m.currentRating;
  }
  if (patch.weeklyLeaders) {
    const w = patch.weeklyLeaders;
    if (w.topScorer?.playerNumber !== undefined) body.leader_top_scorer_number = w.topScorer.playerNumber;
    if (w.topScorer?.value !== undefined) body.leader_top_scorer_value = w.topScorer.value;
    if (w.topAssist?.playerNumber !== undefined) body.leader_top_assist_number = w.topAssist.playerNumber;
    if (w.topAssist?.value !== undefined) body.leader_top_assist_value = w.topAssist.value;
    if (w.cleanSheets !== undefined) body.leader_clean_sheet_numbers = w.cleanSheets;
  }
  return body;
}

interface ValeContentContextValue {
  content: ValeContentData;
  loading: boolean;
  error: string;
  updateContent: (patch: Partial<ValeContentData>) => Promise<void>;
}

const ValeContentContext = createContext<ValeContentContextValue | null>(null);

export function ValeContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ValeContentData>(DEFAULT_VALE_CONTENT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ data: ApiValeContent }>("/vale-content")
      .then((res) => setContent(fromApi(res.data)))
      .catch(() => {
        // API unreachable — keep the defaults, app still works.
      })
      .finally(() => setLoading(false));
  }, []);

  async function updateContent(patch: Partial<ValeContentData>) {
    setError("");
    try {
      const res = await apiFetch<{ data: ApiValeContent }>("/vale-content", {
        method: "PUT",
        body: JSON.stringify(toApiBody(patch)),
      });
      setContent(fromApi(res.data));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that change.");
      throw err;
    }
  }

  return (
    <ValeContentContext.Provider value={{ content, loading, error, updateContent }}>
      {children}
    </ValeContentContext.Provider>
  );
}

export function useValeContent() {
  const ctx = useContext(ValeContentContext);
  if (!ctx) throw new Error("useValeContent must be used within a ValeContentProvider");
  return ctx;
}
