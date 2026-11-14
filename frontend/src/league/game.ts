// The league's free-to-play games: score predictions per fixture and a
// three-player fantasy pick per Sunday. The server keeps the picks (hidden
// until they lock); points are worked out here from the public results.

import { useCallback, useEffect, useState } from "react";
import type { ClubId } from "../lib/league";
import { API_URL, GAMES, type LeagueData } from "./data";
import type { DrawResult, Entrant, Position } from "./draw";

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

export interface FantasyPick {
  playerId: number;
  night: number;
  /** GK/DEF, MID, FWD. */
  pickIds: number[];
  captainId: number;
}

export interface GameData {
  players: GamePlayer[];
  /** Everyone's predictions for fixtures that have kicked off. */
  predictions: Prediction[];
  /** Everyone's picks for Sundays that have started. */
  fantasy: FantasyPick[];
}

export interface Mine {
  playerId: number;
  predictions: Prediction[];
  fantasy: FantasyPick[];
}

export interface Credentials {
  playerId: number;
  passcode: string;
  pin: string;
}

/* ---------------------------------------------------------------- api */

async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
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

const auth = (c: Credentials) => ({ passcode: c.passcode, player_id: c.playerId, pin: c.pin });

export const signIn = (c: Credentials) => call<Mine>("/league/game/login", "POST", auth(c));

export const savePredictions = (c: Credentials, predictions: { matchNo: number; home: number; away: number }[]) =>
  call<Mine>("/league/game/predictions", "PUT", {
    ...auth(c),
    predictions: predictions.map((p) => ({ match_no: p.matchNo, home: p.home, away: p.away })),
  });

export const saveFantasy = (c: Credentials, night: number, pickIds: number[], captainId: number) =>
  call<Mine>("/league/game/fantasy", "PUT", { ...auth(c), night, pick_ids: pickIds, captain_id: captainId });

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

/* -------------------------------------------------------------- fantasy */

export const SLOTS: { label: string; positions: Position[] }[] = [
  { label: "Keeper or defender", positions: ["GK", "DEF"] },
  { label: "Midfielder", positions: ["MID"] },
  { label: "Forward", positions: ["FWD"] },
];

export const FANTASY_RULES: [string, string][] = [
  ["Goal", "Forward 4, midfielder 5, defender or keeper 6"],
  ["Assist", "3"],
  ["Clean sheet", "Defender or keeper 4, midfielder 1"],
  ["Saves", "1 for every 3"],
  ["Club win", "1"],
  ["Own goal", "−2"],
  ["Captain", "Double points"],
];

const GOAL_POINTS: Record<Position, number> = { GK: 6, DEF: 6, MID: 5, FWD: 4 };
const CLEAN_SHEET_POINTS: Record<Position, number> = { GK: 4, DEF: 4, MID: 1, FWD: 0 };

export interface FantasyLine {
  player: Entrant;
  club: ClubId;
  goals: number;
  assists: number;
  cleanSheets: number;
  saves: number;
  wins: number;
  ownGoals: number;
  points: number;
}

/** What one league player earned on one Sunday, so far. */
export function fantasyLine(playerId: number, night: number, draw: DrawResult, data: LeagueData): FantasyLine | null {
  const club = (Object.keys(draw.squads) as ClubId[]).find((c) => draw.squads[c].some((p) => p.id === playerId));
  if (!club) return null;
  const player = draw.squads[club].find((p) => p.id === playerId)!;
  const line: FantasyLine = { player, club, goals: 0, assists: 0, cleanSheets: 0, saves: 0, wins: 0, ownGoals: 0, points: 0 };
  for (const g of GAMES.filter((x) => x.night === night && (x.home === club || x.away === club))) {
    const r = data.results.find((x) => x.matchNo === g.no);
    if (!r || r.status === "scheduled") continue;
    const goals = data.goals.filter((x) => x.matchNo === g.no);
    line.goals += goals.filter((x) => x.playerId === playerId && !x.ownGoal).length;
    line.ownGoals += goals.filter((x) => x.playerId === playerId && x.ownGoal).length;
    line.assists += goals.filter((x) => x.assistPlayerId === playerId).length;
    line.saves += r.saves?.[playerId] ?? 0;
    if (r.status === "final") {
      const home = g.home === club;
      const scored = home ? r.homeScore : r.awayScore;
      const conceded = home ? r.awayScore : r.homeScore;
      if (conceded === 0) line.cleanSheets++;
      if (scored > conceded) line.wins++;
    }
  }
  const pos = player.position;
  line.points =
    line.goals * GOAL_POINTS[pos] +
    line.assists * 3 +
    line.cleanSheets * CLEAN_SHEET_POINTS[pos] +
    Math.floor(line.saves / 3) +
    line.wins -
    line.ownGoals * 2;
  return line;
}

/** A Sunday's picks scored, captain doubled. */
export function fantasyScore(pick: FantasyPick, draw: DrawResult, data: LeagueData) {
  const lines = pick.pickIds.map((id) => fantasyLine(id, pick.night, draw, data));
  const total = lines.reduce((sum, l) => sum + (l ? l.points * (l.player.id === pick.captainId ? 2 : 1) : 0), 0);
  return { lines, total };
}

/* --------------------------------------------------------- leaderboards */

export interface BoardRow {
  playerId: number;
  name: string;
  points: number;
  /** Predictor: exact scores. Fantasy: Sundays played. */
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

export function fantasyBoard(game: GameData, draw: DrawResult, data: LeagueData, night?: number): BoardRow[] {
  const rows = new Map<number, BoardRow>();
  for (const pick of game.fantasy) {
    if (night && pick.night !== night) continue;
    const row = rows.get(pick.playerId) ?? { playerId: pick.playerId, name: nameOf(game, pick.playerId), points: 0, detail: 0 };
    row.points += fantasyScore(pick, draw, data).total;
    row.detail++;
    rows.set(pick.playerId, row);
  }
  return rank([...rows.values()]);
}

const nameOf = (game: GameData, id: number) => game.players.find((p) => p.id === id)?.name ?? "Former player";

/** A fixture is locked once it has kicked off. */
export const fixtureLocked = (no: number, data: LeagueData) => data.results.some((r) => r.matchNo === no && r.status !== "scheduled");

/** A Sunday's fantasy picks lock when its first game kicks off. */
export const nightLocked = (night: number, data: LeagueData) =>
  data.liveNight === night || GAMES.some((g) => g.night === night && fixtureLocked(g.no, data));
