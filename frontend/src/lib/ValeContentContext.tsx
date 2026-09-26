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
    lineupPlayerIds: number[];
  };
  playerOfTheWeek: { playerId: number; note: string; weekRating: number };
  mostImproved: {
    playerId: number;
    note: string;
    previousRating: number;
    currentRating: number;
  };
  weeklyLeaders: {
    topScorer: { playerId: number; value: number };
    topAssist: { playerId: number; value: number };
    cleanSheets: number[];
    roughest: { playerId: number; yellowCards: number; redCards: number };
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
    lineupPlayerIds: number[];
  };
  playerOfTheWeek: { playerId: number | null; note: string | null; weekRating: number | null };
  mostImproved: {
    playerId: number | null;
    note: string | null;
    previousRating: number | null;
    currentRating: number | null;
  };
  weeklyLeaders: {
    topScorer: { playerId: number | null; value: number | null };
    topAssist: { playerId: number | null; value: number | null };
    cleanSheets: number[];
    roughest?: { playerId: number | null; yellowCards: number | null; redCards: number | null };
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
    lineupPlayerIds: [],
  },
  playerOfTheWeek: { playerId: 0, note: "", weekRating: 0 },
  mostImproved: { playerId: 0, note: "", previousRating: 0, currentRating: 0 },
  weeklyLeaders: {
    topScorer: { playerId: 0, value: 0 },
    topAssist: { playerId: 0, value: 0 },
    cleanSheets: [],
    roughest: { playerId: 0, yellowCards: 0, redCards: 0 },
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
      lineupPlayerIds: data.teamOfTheWeek.lineupPlayerIds ?? [],
    },
    playerOfTheWeek: {
      playerId: data.playerOfTheWeek.playerId ?? 0,
      note: data.playerOfTheWeek.note ?? "",
      weekRating: data.playerOfTheWeek.weekRating ?? 0,
    },
    mostImproved: {
      playerId: data.mostImproved.playerId ?? 0,
      note: data.mostImproved.note ?? "",
      previousRating: data.mostImproved.previousRating ?? 0,
      currentRating: data.mostImproved.currentRating ?? 0,
    },
    weeklyLeaders: {
      topScorer: {
        playerId: data.weeklyLeaders.topScorer.playerId ?? 0,
        value: data.weeklyLeaders.topScorer.value ?? 0,
      },
      topAssist: {
        playerId: data.weeklyLeaders.topAssist.playerId ?? 0,
        value: data.weeklyLeaders.topAssist.value ?? 0,
      },
      cleanSheets: data.weeklyLeaders.cleanSheets ?? [],
      roughest: {
        playerId: data.weeklyLeaders.roughest?.playerId ?? 0,
        yellowCards: data.weeklyLeaders.roughest?.yellowCards ?? 0,
        redCards: data.weeklyLeaders.roughest?.redCards ?? 0,
      },
    },
  };
}

// "— None —" is represented as 0 in the UI (keeps player-id fields a
// plain number instead of a nullable union) but the backend's nullable FK
// validation (`exists:players,id`) rejects 0 — only null passes through.
function playerIdOrNull(n: number): number | null {
  return n > 0 ? n : null;
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
    if (t.lineupPlayerIds !== undefined) body.team_lineup_player_ids = t.lineupPlayerIds;
  }
  if (patch.playerOfTheWeek) {
    const p = patch.playerOfTheWeek;
    if (p.playerId !== undefined) body.potw_player_id = playerIdOrNull(p.playerId);
    if (p.note !== undefined) body.potw_note = p.note;
    if (p.weekRating !== undefined) body.potw_rating = p.weekRating;
  }
  if (patch.mostImproved) {
    const m = patch.mostImproved;
    if (m.playerId !== undefined) body.improved_player_id = playerIdOrNull(m.playerId);
    if (m.note !== undefined) body.improved_note = m.note;
    if (m.previousRating !== undefined) body.improved_prev_rating = m.previousRating;
    if (m.currentRating !== undefined) body.improved_curr_rating = m.currentRating;
  }
  if (patch.weeklyLeaders) {
    const w = patch.weeklyLeaders;
    if (w.topScorer?.playerId !== undefined) body.leader_top_scorer_player_id = playerIdOrNull(w.topScorer.playerId);
    if (w.topScorer?.value !== undefined) body.leader_top_scorer_value = w.topScorer.value;
    if (w.topAssist?.playerId !== undefined) body.leader_top_assist_player_id = playerIdOrNull(w.topAssist.playerId);
    if (w.topAssist?.value !== undefined) body.leader_top_assist_value = w.topAssist.value;
    if (w.cleanSheets !== undefined) body.leader_clean_sheet_player_ids = w.cleanSheets;
    if (w.roughest?.playerId !== undefined) body.leader_roughest_player_id = playerIdOrNull(w.roughest.playerId);
    if (w.roughest?.yellowCards !== undefined) body.leader_roughest_yellow = w.roughest.yellowCards;
    if (w.roughest?.redCards !== undefined) body.leader_roughest_red = w.roughest.redCards;
  }
  return body;
}

interface ValeContentContextValue {
  content: ValeContentData;
  loading: boolean;
  error: string;
  updateContent: (patch: Partial<ValeContentData>) => Promise<void>;
  refresh: () => Promise<void>;
}

const ValeContentContext = createContext<ValeContentContextValue | null>(null);

export function ValeContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ValeContentData>(DEFAULT_VALE_CONTENT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Also re-run after a match day ends — the backend rewrites the weekly
  // awards from that day's results.
  function refresh() {
    return apiFetch<{ data: ApiValeContent }>("/vale-content")
      .then((res) => setContent(fromApi(res.data)))
      .catch(() => {
        // API unreachable — keep the current content, app still works.
      });
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
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
    <ValeContentContext.Provider value={{ content, loading, error, updateContent, refresh }}>
      {children}
    </ValeContentContext.Provider>
  );
}

export function useValeContent() {
  const ctx = useContext(ValeContentContext);
  if (!ctx) throw new Error("useValeContent must be used within a ValeContentProvider");
  return ctx;
}
