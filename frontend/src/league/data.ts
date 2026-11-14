import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildSchedule, clubs, type ClubId, type ScheduledGame } from "../lib/league";
import type { Entrant } from "./draw";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export type MatchStatus = "scheduled" | "live" | "final";

export interface LeagueResult {
  matchNo: number;
  status: MatchStatus;
  saves?: Record<string, number>;
  /** Who played, cards and penalties; set when the game was recorded on the Match Day screen. */
  events?: {
    appeared: number[];
    cards: { playerId: number; type: "yellow" | "red" }[];
    penaltyMisses: number[];
    penaltySaves: Record<string, number>;
  } | null;
  homeScore: number;
  awayScore: number;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface LeagueGoal {
  id: number;
  matchNo: number;
  side: "home" | "away";
  playerId: number | null;
  assistPlayerId: number | null;
  ownGoal: boolean;
}

export interface LeagueData {
  entrantIds: number[];
  /** Players who keep goal in the league, whatever their squad position. */
  keeperIds: number[];
  entrants: Entrant[];
  draw: { hash: string; startsAt: string; speed: number; revealed: boolean; seed: string | null } | null;
  liveNight: number | null;
  results: LeagueResult[];
  goals: LeagueGoal[];
  serverTime: string;
}

export async function fetchLeague(): Promise<{ data: LeagueData; offset: number }> {
  const sent = Date.now();
  const res = await fetch(`${API_URL}/league`, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`The league couldn't load (HTTP ${res.status}).`);
  const { data } = (await res.json()) as { data: LeagueData };
  const received = Date.now();
  // Server clock minus ours, assuming the reply took half the round trip.
  const offset = Date.parse(data.serverTime) - (sent + received) / 2;
  return { data, offset };
}

/**
 * The league state, polled: every 3s around the moment the draw seed is
 * revealed, every 10s while a match day is on, otherwise every minute.
 */
export function useLeague() {
  const [data, setData] = useState<LeagueData | null>(null);
  const [error, setError] = useState("");
  const offset = useRef(0);
  const now = useCallback(() => Date.now() + offset.current, []);

  const load = useCallback(async () => {
    try {
      const r = await fetchLeague();
      offset.current = r.offset;
      setData(r.data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The league couldn't load.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const waitingForSeed = data?.draw && !data.draw.revealed && Date.parse(data.draw.startsAt) - now() < 20_000;
    const live = data?.liveNight != null || data?.results.some((r) => r.status === "live");
    const ms = waitingForSeed ? 3000 : live ? 10_000 : 60_000;
    const id = window.setInterval(() => void load(), ms);
    return () => window.clearInterval(id);
  }, [data, load, now]);

  return { data, error, now, reload: load, setData };
}

/* ------------------------------------------------------------- fixtures */

export interface NumberedGame extends ScheduledGame {
  /** 1-45, the key results are stored under. */
  no: number;
  night: number;
}

export const SEASON = buildSchedule().map((night, i) => ({ ...night, number: i + 1 }));
export const GAMES: NumberedGame[] = (() => {
  let no = 0;
  return SEASON.flatMap((night) => night.games.map((g) => ({ ...g, no: ++no, night: night.number })));
})();

export const clubById = new Map(clubs.map((c) => [c.id, c]));

export function nightDate(night: number) {
  return SEASON[night - 1].date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/* ------------------------------------------------------------ standings */

export interface StandingRow {
  club: ClubId;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

export function standings(results: LeagueResult[]): StandingRow[] {
  const rows = new Map<ClubId, StandingRow>(clubs.map((c) => [c.id, { club: c.id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  for (const r of results) {
    if (r.status !== "final") continue;
    const g = GAMES[r.matchNo - 1];
    if (!g) continue;
    const home = rows.get(g.home)!;
    const away = rows.get(g.away)!;
    home.p++; away.p++;
    home.gf += r.homeScore; home.ga += r.awayScore;
    away.gf += r.awayScore; away.ga += r.homeScore;
    if (r.homeScore > r.awayScore) { home.w++; home.pts += 3; away.l++; }
    else if (r.homeScore < r.awayScore) { away.w++; away.pts += 3; home.l++; }
    else { home.d++; away.d++; home.pts++; away.pts++; }
  }
  return [...rows.values()].sort(
    (a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || a.club.localeCompare(b.club),
  );
}

export function useResultsByNo(results: LeagueResult[] | undefined) {
  return useMemo(() => new Map((results ?? []).map((r) => [r.matchNo, r])), [results]);
}

export function topScorers(goals: LeagueGoal[], count = 5) {
  const tally = new Map<number, number>();
  for (const g of goals) if (!g.ownGoal && g.playerId) tally.set(g.playerId, (tally.get(g.playerId) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, count);
}

/** The Sunday to open on: the live one, else the next not yet finished. */
export function defaultNight(data: LeagueData | null) {
  if (data?.liveNight) return data.liveNight;
  const done = new Set((data?.results ?? []).filter((r) => r.status === "final").map((r) => r.matchNo));
  const next = GAMES.find((g) => !done.has(g.no));
  return next?.night ?? 1;
}
