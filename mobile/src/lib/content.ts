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

  const reload = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: never }>(path);
      setData(map(res.data));
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Couldn't load this page."));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

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

function normaliseHome(raw: HomeContent): HomeContent {
  return {
    ...EMPTY_HOME,
    ...raw,
    statsSection: { ...EMPTY_HOME.statsSection, ...raw.statsSection },
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
    lineupNumbers: number[];
  };
  playerOfTheWeek: { playerNumber: number; note: string; weekRating: number };
  mostImproved: { playerNumber: number; note: string; previousRating: number; currentRating: number };
  weeklyLeaders: {
    topScorer: { playerNumber: number; value: number };
    topAssist: { playerNumber: number; value: number };
    cleanSheets: number[];
    roughest: { playerNumber: number; yellowCards: number; redCards: number };
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
    lineupNumbers: number[] | null;
  };
  playerOfTheWeek: { playerNumber: number | null; note: string | null; weekRating: number | null };
  mostImproved: { playerNumber: number | null; note: string | null; previousRating: number | null; currentRating: number | null };
  weeklyLeaders: {
    topScorer: { playerNumber: number | null; value: number | null };
    topAssist: { playerNumber: number | null; value: number | null };
    cleanSheets: number[] | null;
    roughest?: { playerNumber: number | null; yellowCards: number | null; redCards: number | null };
  };
}

const EMPTY_VALE: ValeContent = {
  teamOfTheWeek: { week: "", dateRange: "", sessionsWon: 0, sessionsPlayed: 0, rivalTeam: "", score: "", photo: "", lineupNumbers: [] },
  playerOfTheWeek: { playerNumber: 0, note: "", weekRating: 0 },
  mostImproved: { playerNumber: 0, note: "", previousRating: 0, currentRating: 0 },
  weeklyLeaders: {
    topScorer: { playerNumber: 0, value: 0 },
    topAssist: { playerNumber: 0, value: 0 },
    cleanSheets: [],
    roughest: { playerNumber: 0, yellowCards: 0, redCards: 0 },
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
      lineupNumbers: t.lineupNumbers ?? [],
    },
    playerOfTheWeek: {
      playerNumber: d.playerOfTheWeek.playerNumber ?? 0,
      note: d.playerOfTheWeek.note ?? "",
      weekRating: d.playerOfTheWeek.weekRating ?? 0,
    },
    mostImproved: {
      playerNumber: d.mostImproved.playerNumber ?? 0,
      note: d.mostImproved.note ?? "",
      previousRating: d.mostImproved.previousRating ?? 0,
      currentRating: d.mostImproved.currentRating ?? 0,
    },
    weeklyLeaders: {
      topScorer: { playerNumber: w.topScorer.playerNumber ?? 0, value: w.topScorer.value ?? 0 },
      topAssist: { playerNumber: w.topAssist.playerNumber ?? 0, value: w.topAssist.value ?? 0 },
      cleanSheets: w.cleanSheets ?? [],
      roughest: {
        playerNumber: w.roughest?.playerNumber ?? 0,
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
    team_lineup_numbers: t.lineupNumbers,
    potw_player_number: orNull(v.playerOfTheWeek.playerNumber),
    potw_note: v.playerOfTheWeek.note,
    potw_rating: v.playerOfTheWeek.weekRating,
    improved_player_number: orNull(v.mostImproved.playerNumber),
    improved_note: v.mostImproved.note,
    improved_prev_rating: v.mostImproved.previousRating,
    improved_curr_rating: v.mostImproved.currentRating,
    leader_top_scorer_number: orNull(w.topScorer.playerNumber),
    leader_top_scorer_value: w.topScorer.value,
    leader_top_assist_number: orNull(w.topAssist.playerNumber),
    leader_top_assist_value: w.topAssist.value,
    leader_clean_sheet_numbers: w.cleanSheets,
    leader_roughest_number: orNull(w.roughest.playerNumber),
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
