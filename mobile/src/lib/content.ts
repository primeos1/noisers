import { useCallback, useEffect, useState } from "react";
import { apiFetch, errorMessage } from "./api";
import type { HighlightCategory, Highlight, HomeContent, HomeStat, GalleryImage, LiveStatId, MediaType } from "./types";

// Public-site content the committee edits: the Home page, The Vale and the
// Highlights gallery. Only the committee screens need these, so each screen
// loads its own copy rather than going through the ClubProvider. Field
// mappings match frontend/src/lib/{HomeContent,ValeContent,Highlights}Context.tsx.

function useResource<T>(path: string, initial: T, map: (raw: never) => T = (raw) => raw as T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(
    () =>
      apiFetch<{ data: never }>(path)
        .then((res) => {
          setData(map(res.data));
          setError("");
        })
        .catch((err) => setError(errorMessage(err, "Couldn't load this page.")))
        .finally(() => setLoading(false)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path],
  );

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ data: never }>(path)
      .then((res) => !cancelled && setData(map(res.data)))
      .catch((err) => !cancelled && setError(errorMessage(err, "Couldn't load this page.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return { data, setData, loading, error, reload };
}

// ---- Home page -----------------------------------------------------------

export const LIVE_STATS: { id: LiveStatId; label: string }[] = [
  { id: "squad", label: "Squad" },
  { id: "match_days", label: "Match days" },
  { id: "games", label: "Games played" },
  { id: "goals", label: "Goals scored" },
];

const EMPTY_HOME: HomeContent = {
  hero: { eyebrow: "", headline: "", subtext: "", imageUrl: "" },
  story: { eyebrow: "", headline: "", paragraph1: "", paragraph2: "", imageUrl: "" },
  atmosphere: { caption: "", imageUrl: "" },
  matchday: { eyebrow: "", headline: "", body: "" },
  footer: { tagline: "", copyright: "" },
  statsSection: { enabled: true, eyebrow: "", headline: "", imageUrl: "", live: LIVE_STATS.map((s) => s.id) },
  stats: [],
  gallery: [],
};

export type HomeContentPatch = {
  [K in keyof Omit<HomeContent, "stats" | "gallery">]?: Partial<HomeContent[K]>;
};

// { hero: { imageUrl } } → { hero_image_url }
const HOME_FIELDS: Record<string, Record<string, string>> = {
  hero: { eyebrow: "hero_eyebrow", headline: "hero_headline", subtext: "hero_subtext", imageUrl: "hero_image_url" },
  story: {
    eyebrow: "story_eyebrow",
    headline: "story_headline",
    paragraph1: "story_paragraph_1",
    paragraph2: "story_paragraph_2",
    imageUrl: "story_image_url",
  },
  atmosphere: { caption: "atmosphere_caption", imageUrl: "atmosphere_image_url" },
  matchday: { eyebrow: "matchday_eyebrow", headline: "matchday_headline", body: "matchday_body" },
  statsSection: {
    enabled: "stats_enabled",
    eyebrow: "stats_eyebrow",
    headline: "stats_headline",
    imageUrl: "stats_image_url",
    live: "stats_live",
  },
  footer: { tagline: "footer_tagline", copyright: "footer_copyright" },
};

function flattenHomePatch(patch: HomeContentPatch) {
  const body: Record<string, unknown> = {};
  for (const [section, fields] of Object.entries(patch)) {
    for (const [field, value] of Object.entries(fields ?? {})) {
      const column = HOME_FIELDS[section]?.[field];
      if (column && value !== undefined) body[column] = value;
    }
  }
  return body;
}

// The API sends null for blank fields; inputs need strings.
function section<T extends object>(fallback: T, raw: Partial<Record<keyof T, unknown>> | undefined): T {
  const out = { ...fallback };
  for (const key of Object.keys(fallback) as (keyof T)[]) {
    const value = raw?.[key];
    if (value !== null && value !== undefined) out[key] = value as T[keyof T];
  }
  return out;
}

function normaliseHome(raw: HomeContent): HomeContent {
  return {
    hero: section(EMPTY_HOME.hero, raw.hero),
    story: section(EMPTY_HOME.story, raw.story),
    atmosphere: section(EMPTY_HOME.atmosphere, raw.atmosphere),
    matchday: section(EMPTY_HOME.matchday, raw.matchday),
    footer: section(EMPTY_HOME.footer, raw.footer),
    statsSection: section(EMPTY_HOME.statsSection, raw.statsSection),
    stats: raw.stats ?? [],
    gallery: raw.gallery ?? [],
  };
}

export function useHomeContent() {
  const { data, setData, loading, error, reload } = useResource<HomeContent>("/home-content", EMPTY_HOME, normaliseHome);

  async function update(patch: HomeContentPatch) {
    const res = await apiFetch<{ data: HomeContent }>("/home-content", { method: "PUT", body: flattenHomePatch(patch) });
    setData((prev) => ({ ...normaliseHome(res.data), stats: prev.stats, gallery: prev.gallery }));
  }

  async function addStat(stat: { value: string; label: string }) {
    const res = await apiFetch<{ data: HomeStat }>("/home-stats", { method: "POST", body: stat });
    setData((prev) => ({ ...prev, stats: [...prev.stats, res.data] }));
  }

  async function updateStat(id: number, patch: Partial<{ value: string; label: string }>) {
    const res = await apiFetch<{ data: HomeStat }>(`/home-stats/${id}`, { method: "PUT", body: patch });
    setData((prev) => ({ ...prev, stats: prev.stats.map((s) => (s.id === id ? res.data : s)) }));
  }

  async function removeStat(id: number) {
    await apiFetch(`/home-stats/${id}`, { method: "DELETE" });
    setData((prev) => ({ ...prev, stats: prev.stats.filter((s) => s.id !== id) }));
  }

  async function addGalleryImage(imageUrl: string) {
    const res = await apiFetch<{ data: GalleryImage }>("/gallery-images", { method: "POST", body: { image_url: imageUrl } });
    setData((prev) => ({ ...prev, gallery: [...prev.gallery, res.data] }));
  }

  async function removeGalleryImage(id: number) {
    await apiFetch(`/gallery-images/${id}`, { method: "DELETE" });
    setData((prev) => ({ ...prev, gallery: prev.gallery.filter((g) => g.id !== id) }));
  }

  return { content: data, loading, error, reload, update, addStat, updateStat, removeStat, addGalleryImage, removeGalleryImage };
}

// ---- The Vale ------------------------------------------------------------

/** "None" is 0 in the form; the API wants null. */
export interface ValeContent {
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
  mostImproved: { playerId: number; note: string; previousRating: number; currentRating: number };
  weeklyLeaders: {
    topScorer: { playerId: number; value: number };
    topAssist: { playerId: number; value: number };
    cleanSheets: number[];
    roughest: { playerId: number; yellowCards: number; redCards: number };
  };
}

interface ApiVale {
  teamOfTheWeek: {
    title: string | null;
    dateRange: string | null;
    sessionsWon: number | null;
    sessionsPlayed: number | null;
    rivalTeam: string | null;
    score: string | null;
    photoUrl: string | null;
    lineupPlayerIds: number[] | null;
  };
  playerOfTheWeek: { playerId: number | null; note: string | null; weekRating: number | null };
  mostImproved: { playerId: number | null; note: string | null; previousRating: number | null; currentRating: number | null };
  weeklyLeaders: {
    topScorer: { playerId: number | null; value: number | null };
    topAssist: { playerId: number | null; value: number | null };
    cleanSheets: number[] | null;
    roughest?: { playerId: number | null; yellowCards: number | null; redCards: number | null };
  };
}

const EMPTY_VALE: ValeContent = {
  teamOfTheWeek: { week: "", dateRange: "", sessionsWon: 0, sessionsPlayed: 0, rivalTeam: "", score: "", photo: "", lineupPlayerIds: [] },
  playerOfTheWeek: { playerId: 0, note: "", weekRating: 0 },
  mostImproved: { playerId: 0, note: "", previousRating: 0, currentRating: 0 },
  weeklyLeaders: {
    topScorer: { playerId: 0, value: 0 },
    topAssist: { playerId: 0, value: 0 },
    cleanSheets: [],
    roughest: { playerId: 0, yellowCards: 0, redCards: 0 },
  },
};

function valeFromApi(d: ApiVale): ValeContent {
  const t = d.teamOfTheWeek;
  const w = d.weeklyLeaders;
  return {
    teamOfTheWeek: {
      week: t.title ?? "",
      dateRange: t.dateRange ?? "",
      sessionsWon: t.sessionsWon ?? 0,
      sessionsPlayed: t.sessionsPlayed ?? 0,
      rivalTeam: t.rivalTeam ?? "",
      score: t.score ?? "",
      photo: t.photoUrl ?? "",
      lineupPlayerIds: t.lineupPlayerIds ?? [],
    },
    playerOfTheWeek: {
      playerId: d.playerOfTheWeek.playerId ?? 0,
      note: d.playerOfTheWeek.note ?? "",
      weekRating: d.playerOfTheWeek.weekRating ?? 0,
    },
    mostImproved: {
      playerId: d.mostImproved.playerId ?? 0,
      note: d.mostImproved.note ?? "",
      previousRating: d.mostImproved.previousRating ?? 0,
      currentRating: d.mostImproved.currentRating ?? 0,
    },
    weeklyLeaders: {
      topScorer: { playerId: w.topScorer.playerId ?? 0, value: w.topScorer.value ?? 0 },
      topAssist: { playerId: w.topAssist.playerId ?? 0, value: w.topAssist.value ?? 0 },
      cleanSheets: w.cleanSheets ?? [],
      roughest: {
        playerId: w.roughest?.playerId ?? 0,
        yellowCards: w.roughest?.yellowCards ?? 0,
        redCards: w.roughest?.redCards ?? 0,
      },
    },
  };
}

const orNull = (n: number) => (n > 0 ? n : null);

function valeBody(v: ValeContent) {
  const t = v.teamOfTheWeek;
  const w = v.weeklyLeaders;
  return {
    team_week_title: t.week,
    team_week_date_range: t.dateRange,
    team_sessions_won: t.sessionsWon,
    team_sessions_played: t.sessionsPlayed,
    team_rival: t.rivalTeam,
    team_score: t.score,
    team_photo_url: t.photo,
    team_lineup_player_ids: t.lineupPlayerIds,
    potw_player_id: orNull(v.playerOfTheWeek.playerId),
    potw_note: v.playerOfTheWeek.note,
    potw_rating: v.playerOfTheWeek.weekRating,
    improved_player_id: orNull(v.mostImproved.playerId),
    improved_note: v.mostImproved.note,
    improved_prev_rating: v.mostImproved.previousRating,
    improved_curr_rating: v.mostImproved.currentRating,
    leader_top_scorer_player_id: orNull(w.topScorer.playerId),
    leader_top_scorer_value: w.topScorer.value,
    leader_top_assist_player_id: orNull(w.topAssist.playerId),
    leader_top_assist_value: w.topAssist.value,
    leader_clean_sheet_player_ids: w.cleanSheets,
    leader_roughest_player_id: orNull(w.roughest.playerId),
    leader_roughest_yellow: w.roughest.yellowCards,
    leader_roughest_red: w.roughest.redCards,
  };
}

export function useValeContent() {
  const { data, setData, loading, error, reload } = useResource<ValeContent>("/vale-content", EMPTY_VALE, valeFromApi);

  async function save(next: ValeContent) {
    const res = await apiFetch<{ data: ApiVale }>("/vale-content", { method: "PUT", body: valeBody(next) });
    setData(valeFromApi(res.data));
  }

  return { content: data, loading, error, reload, save };
}

// ---- Highlights ----------------------------------------------------------

export const HIGHLIGHT_CATEGORIES: HighlightCategory[] = ["Goals", "Saves", "Skills", "Matchday", "Behind the scenes"];

export interface HighlightInput {
  type: MediaType;
  mediaUrl: string;
  alt: string;
  caption: string;
  category: HighlightCategory;
  tall: boolean;
}

function highlightBody(h: HighlightInput) {
  return { type: h.type, media_url: h.mediaUrl, alt: h.alt, caption: h.caption, category: h.category, tall: h.tall };
}

export function useHighlights() {
  const { data, setData, loading, error, reload } = useResource<Highlight[]>("/highlights", []);

  async function add(input: HighlightInput) {
    const res = await apiFetch<{ data: Highlight }>("/highlights", { method: "POST", body: highlightBody(input) });
    setData((prev) => [...prev, res.data]);
  }

  async function update(id: number, input: HighlightInput) {
    const res = await apiFetch<{ data: Highlight }>(`/highlights/${id}`, { method: "PUT", body: highlightBody(input) });
    setData((prev) => prev.map((h) => (h.id === id ? res.data : h)));
  }

  async function remove(id: number) {
    await apiFetch(`/highlights/${id}`, { method: "DELETE" });
    setData((prev) => prev.filter((h) => h.id !== id));
  }

  return { highlights: data, loading, error, reload, add, update, remove };
}
