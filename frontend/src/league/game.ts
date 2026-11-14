// The league's score predictor. The server keeps the picks (hidden until
// they lock); points are worked out here from the public results. FNL, the
// fantasy game, lives in fnl.ts and shares the sign-in below.

import { useCallback, useEffect, useState } from "react";
import { API_URL, GAMES, type LeagueData } from "./data";

export interface GamePlayer {
  id: number;
  name: string;
  /** Has set a PIN, so signs in rather than signs up. */
  joined: boolean;
}

export interface Prediction {
  playerId: number;
  matchNo: number;
  home: number;
  away: number;
}

export interface GameData {
  players: GamePlayer[];
  /** Everyone's predictions for fixtures that have kicked off. */
  predictions: Prediction[];
}

export interface Mine {
  playerId: number;
  predictions: Prediction[];
}

export interface Credentials {
  playerId: number;
  pin: string;
}

/* ---------------------------------------------------------------- api */

export async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const errors = json?.errors ? (Object.values(json.errors).flat() as string[]) : [];
    throw new Error(errors[0] ?? json?.message ?? (res.status === 429 ? "Too many tries. Wait a minute and try again." : "That didn't work. Try again."));
  }
  return json.data as T;
}

export const auth = (c: Credentials) => ({ player_id: c.playerId, pin: c.pin });

export const signIn = (c: Credentials) => call<Mine>("/league/game/login", "POST", auth(c));

export const savePredictions = (c: Credentials, predictions: { matchNo: number; home: number; away: number }[]) =>
  call<Mine>("/league/game/predictions", "PUT", {
    ...auth(c),
    predictions: predictions.map((p) => ({ match_no: p.matchNo, home: p.home, away: p.away })),
  });

/** The public side, polled alongside the league data. */
export function useGame(liveish: boolean) {
  const [game, setGame] = useState<GameData | null>(null);
  const load = useCallback(() => call<GameData>("/league/game", "GET").then(setGame).catch(() => {}), []);
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), liveish ? 15_000 : 60_000);
    return () => window.clearInterval(id);
  }, [load, liveish]);
  return { game, reload: load };
}

const STORE = "nl_play";

export function storedCredentials(): Credentials | null {
  try {
    const raw = window.localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Credentials) : null;
  } catch {
    return null;
  }
}

export function storeCredentials(c: Credentials | null) {
  try {
    if (c) window.localStorage.setItem(STORE, JSON.stringify(c));
    else window.localStorage.removeItem(STORE);
  } catch {
    // Private mode: they'll just sign in again next time.
  }
}

/* ------------------------------------------------------------ predictor */

export const EXACT_POINTS = 3;
export const RESULT_POINTS = 1;

const sign = (n: number) => Math.sign(n);

/** Points for one prediction, or null while the game isn't finished. */
export function predictionPoints(p: Pick<Prediction, "home" | "away" | "matchNo">, data: LeagueData): number | null {
  const r = data.results.find((x) => x.matchNo === p.matchNo);
  if (r?.status !== "final") return null;
  if (r.homeScore === p.home && r.awayScore === p.away) return EXACT_POINTS;
  return sign(r.homeScore - r.awayScore) === sign(p.home - p.away) ? RESULT_POINTS : 0;
}

/* --------------------------------------------------------- leaderboards */

export interface BoardRow {
  playerId: number;
  name: string;
  points: number;
  /** Exact scores. */
  detail: number;
}

const rank = (rows: BoardRow[]) => rows.filter((r) => r.points !== 0 || r.detail > 0).sort((a, b) => b.points - a.points || b.detail - a.detail || a.name.localeCompare(b.name));

export function predictorBoard(game: GameData, data: LeagueData, night?: number): BoardRow[] {
  const nos = night ? new Set(GAMES.filter((g) => g.night === night).map((g) => g.no)) : null;
  const rows = new Map<number, BoardRow>();
  for (const p of game.predictions) {
    if (nos && !nos.has(p.matchNo)) continue;
    const pts = predictionPoints(p, data);
    if (pts === null) continue;
    const row = rows.get(p.playerId) ?? { playerId: p.playerId, name: nameOf(game, p.playerId), points: 0, detail: 0 };
    row.points += pts;
    if (pts === EXACT_POINTS) row.detail++;
    rows.set(p.playerId, row);
  }
  return rank([...rows.values()]);
}

const nameOf = (game: GameData, id: number) => game.players.find((p) => p.id === id)?.name ?? "Former player";

/** A fixture is locked once it has kicked off. */
export const fixtureLocked = (no: number, data: LeagueData) => data.results.some((r) => r.matchNo === no && r.status !== "scheduled");
