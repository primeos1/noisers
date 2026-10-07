// Noisers — the club blog. Stories are written server-side (see the API's
// NoisersFeed) from match days, cards and absences; this file only fetches
// and shapes them for the page.

import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import type { AbsenceStatus, AbsenceType } from "./absences";

export type StoryKind =
  | "match_report"
  | "team_of_week"
  | "discipline"
  | "injury"
  | "travel"
  | "suspension"
  | "unavailable"
  | "comeback";

export interface StoryGameLine {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
}

export interface StoryCard {
  playerId: number | null;
  name: string;
  type: "yellow" | "red";
  reason: string | null;
  minute: number | null;
}

export interface Story {
  id: string;
  kind: StoryKind;
  tag: string;
  publishedAt: string;
  headline: string;
  standfirst: string;
  body: string[];
  /** Featured players, the lead first. */
  playerIds: number[];
  matchDay: { id: string; title: string; venue: string | null; date: string } | null;
  scoreline: StoryGameLine[] | null;
  stats: { label: string; value: number }[] | null;
  /** The team of the match day: its six, keeper first, with the position each was picked for. */
  lineup: { team: string; playerIds: number[]; positions: string[] } | null;
  cards: StoryCard[] | null;
  absence: {
    type: AbsenceType;
    reason: string | null;
    startsOn: string;
    endsOn: string | null;
    status: AbsenceStatus;
  } | null;
}

/** The feed's sections — each groups one or more story kinds. */
export const desks: { id: string; label: string; kinds: StoryKind[] }[] = [
  { id: "all", label: "All stories", kinds: [] },
  { id: "reports", label: "Match reports", kinds: ["match_report"] },
  { id: "totw", label: "Team of the match day", kinds: ["team_of_week"] },
  { id: "discipline", label: "Discipline", kinds: ["discipline", "suspension"] },
  { id: "treatment", label: "Treatment room", kinds: ["injury", "comeback"] },
  { id: "away", label: "Away & out", kinds: ["travel", "unavailable"] },
];

/** Accent per kind, as a CSS colour. */
export const kindAccent: Record<StoryKind, string> = {
  match_report: "var(--color-win)",
  team_of_week: "var(--color-justice)",
  discipline: "#e0413a",
  injury: "var(--color-loss)",
  travel: "var(--color-travel)",
  suspension: "#f4c430",
  unavailable: "var(--color-mist)",
  comeback: "#3fd6a4",
};

/** "Just now", "3h ago", "Yesterday", "Sat 27 Sep" */
export function timeAgo(iso: string, now = Date.now()) {
  const then = new Date(iso).getTime();
  const mins = Math.round((now - then) / 60_000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Roughly how long a story takes to read, at ~200 words a minute. */
export function readingTime(story: Story) {
  const words = [story.headline, story.standfirst, ...story.body].join(" ").split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export function useNoisersFeed() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiFetch<{ data: Story[] }>("/noisers")
      .then((res) => setStories(res.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  return { stories, loading, failed };
}
