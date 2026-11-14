// FNL, the Fantasy Noisers League: FPL rules for a six-a-side league.
// Squads of nine (1 GK, 3 DEF, 2 MID, 3 FWD) on a budget, six starting with
// three on an ordered bench, a captain and vice, a free transfer a week and
// three chips. Gameweek N is league Sunday N. The server keeps the squads
// (league/fantasy endpoints); every point is worked out here from the public
// results, just like the league table.

import { useCallback, useEffect, useState } from "react";
import type { ClubId } from "../lib/league";
import { GAMES, type LeagueData, type LeagueResult } from "./data";
import type { DrawResult, Entrant, Position } from "./draw";
import { auth, call, type Credentials } from "./game";

export type Chip = "wildcard" | "bench_boost" | "triple_captain";

export const CHIP_LABELS: Record<Chip, { name: string; blurb: string }> = {
  wildcard: { name: "Wildcard", blurb: "Unlimited free transfers this gameweek." },
  bench_boost: { name: "Bench Boost", blurb: "Your bench's points count too." },
  triple_captain: { name: "Triple Captain", blurb: "Your captain scores triple, not double." },
};

export interface FnlRules {
  budget: number;
  squad: Record<Position, number>;
  starters: number;
  maxPerClub: number;
  transferCost: number;
  chips: Chip[];
}

export interface FnlTeam {
  id: number;
  playerId: number;
  name: string;
}

export interface FnlEntry {
  teamId: number;
  gameweek: number;
  starters: number[];
  bench: number[];
  captainId: number;
  viceId: number;
  chip: Chip | null;
  transfers: number;
  transferCost: number;
}

export interface FnlLeague {
  id: number;
  name: string;
  ownerTeamId: number;
  teamIds: number[];
  /** Only sent to members. */
  code?: string;
}

export interface FnlData {
  rules: FnlRules;
  /** The gameweek squads are being picked for; null once the last has started. */
  openGameweek: number | null;
  deadlines: string[];
  /** Prices for the gameweek being picked; change is how far ownership has moved it from the base price. */
  players: { id: number; position: Position; price: number; change: number; owned: number }[];
  teams: FnlTeam[];
  /** Every squad for gameweeks that have locked. */
  entries: FnlEntry[];
  leagues: FnlLeague[];
}

export interface FnlMine {
  playerId: number;
  team: FnlTeam | null;
  entries: FnlEntry[];
  /** For the open gameweek; null is unlimited (a first squad, before its first deadline). */
  freeTransfers: number | null;
  leagues: FnlLeague[];
}

/* ------------------------------------------------------------------ api */

export const fnlMe = (c: Credentials) => call<FnlMine>("/fnl/me", "POST", auth(c));
export const fnlSaveTeam = (c: Credentials, name: string) => call<FnlMine>("/fnl/team", "PUT", { ...auth(c), name });
export const fnlSaveEntry = (c: Credentials, gameweek: number, e: { starters: number[]; bench: number[]; captainId: number; viceId: number; chip: Chip | null }) =>
  call<FnlMine>("/fnl/entry", "PUT", { ...auth(c), gameweek, starters: e.starters, bench: e.bench, captain_id: e.captainId, vice_id: e.viceId, chip: e.chip });
export const fnlCreateLeague = (c: Credentials, name: string) => call<FnlMine>("/fnl/leagues", "POST", { ...auth(c), name });
export const fnlJoinLeague = (c: Credentials, code: string) => call<FnlMine>("/fnl/leagues/join", "POST", { ...auth(c), code });
export const fnlLeaveLeague = (c: Credentials, id: number) => call<FnlMine>(`/fnl/leagues/${id}/leave`, "POST", auth(c));

export function useFnl(live: boolean) {
  const [fnl, setFnl] = useState<FnlData | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(
    () =>
      call<FnlData>("/fnl", "GET")
        .then((d) => {
          setFnl(d);
          setError("");
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), live ? 20_000 : 60_000);
    return () => window.clearInterval(id);
  }, [load, live]);
  return { fnl, error, reload: load };
}

/* -------------------------------------------------------------- players */

export interface FnlPlayer {
  player: Entrant;
  club: ClubId;
  position: Position;
  price: number;
  change: number;
  /** % of managers who had him last gameweek. */
  owned: number;
}

/** Everyone pickable: the drawn squads, with FNL's positions and prices. */
export function fnlPlayers(draw: DrawResult, fnl: FnlData): Map<number, FnlPlayer> {
  const priced = new Map(fnl.players.map((p) => [p.id, p]));
  const out = new Map<number, FnlPlayer>();
  for (const club of Object.keys(draw.squads) as ClubId[]) {
    for (const player of draw.squads[club]) {
      const p = priced.get(player.id);
      if (p) out.set(player.id, { player, club, position: p.position, price: p.price, change: p.change ?? 0, owned: p.owned ?? 0 });
    }
  }
  return out;
}

/* --------------------------------------------------------------- points */

export const SCORING: [string, string][] = [
  ["Played a game", "1 each"],
  ["Goal", "Keeper or defender 6, midfielder 5, forward 4"],
  ["Assist", "3"],
  ["Clean sheet", "Keeper or defender 4, midfielder 1"],
  ["Every 3 saves in a game", "1"],
  ["Penalty save", "5"],
  ["Every 2 goals conceded", "−1 (keeper or defender)"],
  ["Penalty miss", "−2"],
  ["Yellow card", "−1"],
  ["Red card", "−3"],
  ["Own goal", "−2"],
  ["Bonus", "3, 2 and 1 to the top three scorers of each game"],
];

const GOAL: Record<Position, number> = { GK: 6, DEF: 6, MID: 5, FWD: 4 };
const CLEAN_SHEET: Record<Position, number> = { GK: 4, DEF: 4, MID: 1, FWD: 0 };

export interface PlayerGw {
  games: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  conceded: number;
  saves: number;
  penaltySaves: number;
  penaltyMisses: number;
  yellows: number;
  reds: number;
  ownGoals: number;
  bonus: number;
  points: number;
}

const emptyLine = (): PlayerGw => ({
  games: 0, goals: 0, assists: 0, cleanSheets: 0, conceded: 0, saves: 0, penaltySaves: 0,
  penaltyMisses: 0, yellows: 0, reds: 0, ownGoals: 0, bonus: 0, points: 0,
});

/**
 * Every player's points in every game, keyed "gameweek:playerId". A game
 * recorded before line-ups were kept counts everyone in both squads as
 * having played.
 */
export function scoreSeason(draw: DrawResult, data: LeagueData, players: Map<number, FnlPlayer>) {
  const lines = new Map<string, PlayerGw>();
  const line = (gw: number, id: number) => {
    const key = `${gw}:${id}`;
    if (!lines.has(key)) lines.set(key, emptyLine());
    return lines.get(key)!;
  };
  const results = new Map<number, LeagueResult>(data.results.map((r) => [r.matchNo, r]));

  for (const g of GAMES) {
    const r = results.get(g.no);
    if (!r || r.status === "scheduled") continue;
    const goals = data.goals.filter((x) => x.matchNo === g.no);
    const game = new Map<number, number>();

    for (const [club, home] of [[g.home, true], [g.away, false]] as const) {
      const conceded = home ? r.awayScore : r.homeScore;
      for (const p of draw.squads[club]) {
        const fp = players.get(p.id);
        if (!fp) continue;
        if (r.events && !r.events.appeared.includes(p.id)) continue;
        const l = emptyLine();
        l.games = 1;
        l.goals = goals.filter((x) => x.playerId === p.id && !x.ownGoal).length;
        l.ownGoals = goals.filter((x) => x.playerId === p.id && x.ownGoal).length;
        l.assists = goals.filter((x) => x.assistPlayerId === p.id).length;
        l.saves = r.saves?.[p.id] ?? 0;
        l.penaltySaves = r.events?.penaltySaves?.[p.id] ?? 0;
        l.penaltyMisses = r.events?.penaltyMisses.filter((id) => id === p.id).length ?? 0;
        l.yellows = r.events?.cards.filter((c) => c.playerId === p.id && c.type === "yellow").length ?? 0;
        l.reds = r.events?.cards.filter((c) => c.playerId === p.id && c.type === "red").length ?? 0;
        if (r.status === "final") {
          l.conceded = conceded;
          if (conceded === 0) l.cleanSheets = 1;
        }
        const pos = fp.position;
        l.points =
          1 +
          l.goals * GOAL[pos] +
          l.assists * 3 +
          l.cleanSheets * CLEAN_SHEET[pos] +
          Math.floor(l.saves / 3) +
          l.penaltySaves * 5 -
          (pos === "GK" || pos === "DEF" ? Math.floor(l.conceded / 2) : 0) -
          l.penaltyMisses * 2 -
          l.yellows -
          l.reds * 3 -
          l.ownGoals * 2;
        game.set(p.id, l.points);
        const total = line(g.night, p.id);
        for (const k of Object.keys(l) as (keyof PlayerGw)[]) total[k] += l[k];
      }
    }

    // Bonus: 3, 2, 1 to the game's top three on points once it's finished; ties share.
    if (r.status === "final") {
      const ranked = [...game.entries()].sort((a, b) => b[1] - a[1]);
      let award = 3;
      for (let i = 0; i < ranked.length && award > 0; ) {
        const tied = ranked.filter(([, pts]) => pts === ranked[i][1]);
        for (const [id] of tied) {
          const l = line(g.night, id);
          l.bonus += award;
          l.points += award;
        }
        i += tied.length;
        award -= tied.length;
      }
    }
  }
  return (gw: number, id: number) => lines.get(`${gw}:${id}`) ?? null;
}

export type Season = ReturnType<typeof scoreSeason>;

/** A gameweek has started once any of its games has kicked off. */
export const gwStarted = (gw: number, data: LeagueData) =>
  data.liveNight === gw || GAMES.some((g) => g.night === gw && data.results.some((r) => r.matchNo === g.no && r.status !== "scheduled"));

/** Done: started, nothing live, and the match day is over. Auto-subs only happen then. */
export const gwDone = (gw: number, data: LeagueData) =>
  gwStarted(gw, data) && data.liveNight !== gw && !GAMES.some((g) => g.night === gw && data.results.some((r) => r.matchNo === g.no && r.status === "live"));

/** The squad a team carries into a gameweek: its latest entry up to then. */
export function entryFor(entries: FnlEntry[], teamId: number, gw: number): FnlEntry | null {
  return entries.filter((e) => e.teamId === teamId && e.gameweek <= gw).sort((a, b) => b.gameweek - a.gameweek)[0] ?? null;
}

export interface TeamGw {
  entry: FnlEntry;
  /** After auto-subs. */
  starters: number[];
  bench: number[];
  subs: { out: number; in: number }[];
  /** Who's actually wearing the armband, and how much they're worth. */
  captainId: number | null;
  multiplier: number;
  points: number;
  /** Before the transfer cost. */
  gross: number;
}

/** A team's gameweek: auto-subs, captaincy, chips and transfer hits, FPL-style. */
export function teamGameweek(entries: FnlEntry[], teamId: number, gw: number, data: LeagueData, season: Season, players: Map<number, FnlPlayer>): TeamGw | null {
  const entry = entryFor(entries, teamId, gw);
  if (!entry) return null;
  const done = gwDone(gw, data);
  const played = (id: number) => (season(gw, id)?.games ?? 0) > 0;
  const pts = (id: number) => season(gw, id)?.points ?? 0;
  const starters = [...entry.starters];
  const bench = [...entry.bench];
  const subs: TeamGw["subs"] = [];
  const boost = entry.chip === "bench_boost";

  if (done && !boost) {
    const pos = (id: number) => players.get(id)?.position;
    const valid = (xi: number[]) => {
      const n = (p: Position) => xi.filter((id) => pos(id) === p).length;
      return n("GK") === 1 && n("DEF") >= 1 && n("MID") >= 1 && n("FWD") >= 1;
    };
    for (let i = 0; i < starters.length; i++) {
      if (played(starters[i])) continue;
      for (let j = 0; j < bench.length; j++) {
        const candidate = bench[j];
        if (!played(candidate)) continue;
        const xi = starters.map((id, k) => (k === i ? candidate : id));
        if (!valid(xi)) continue;
        subs.push({ out: starters[i], in: candidate });
        bench[j] = starters[i];
        starters[i] = candidate;
        break;
      }
    }
  }

  const double = entry.chip === "triple_captain" ? 3 : 2;
  const captainId = !done || played(entry.captainId) ? entry.captainId : played(entry.viceId) ? entry.viceId : null;
  const counted = boost ? [...starters, ...bench] : starters;
  const gross = counted.reduce((sum, id) => sum + pts(id) * (id === captainId ? double : 1), 0);
  const cost = entry.gameweek === gw ? entry.transferCost : 0;
  return { entry, starters, bench, subs, captainId, multiplier: double, gross, points: gross - cost };
}

export interface Standing {
  team: FnlTeam;
  gw: number;
  total: number;
}

/** League table: each team's latest started gameweek and season total. */
export function standings(teams: FnlTeam[], fnl: FnlData, data: LeagueData, season: Season, players: Map<number, FnlPlayer>, gameweeks: number): Standing[] {
  const started = Array.from({ length: gameweeks }, (_, i) => i + 1).filter((gw) => gwStarted(gw, data));
  const latest = started[started.length - 1];
  return teams
    .map((team) => {
      const byGw = started.map((gw) => teamGameweek(fnl.entries, team.id, gw, data, season, players)?.points ?? 0);
      return { team, gw: latest ? byGw[byGw.length - 1] : 0, total: byGw.reduce((a, b) => a + b, 0) };
    })
    .sort((a, b) => b.total - a.total || b.gw - a.gw || a.team.name.localeCompare(b.team.name));
}

/* ----------------------------------------------------------- squad edits */

export interface Slot {
  id: number | null;
  position: Position;
}

/** Six starters then three bench; positions are fixed per slot, so the squad's shape always holds. */
export const EMPTY_LINEUP: Slot[] = (["GK", "DEF", "DEF", "MID", "FWD", "FWD", "DEF", "MID", "FWD"] as Position[]).map((position) => ({ id: null, position }));

export function lineupFrom(entry: FnlEntry | null, players: Map<number, FnlPlayer>): Slot[] {
  if (!entry) return EMPTY_LINEUP.map((s) => ({ ...s }));
  return [...entry.starters, ...entry.bench].map((id) => ({ id, position: players.get(id)?.position ?? "MID" }));
}

/** Starting XI shape check: the keeper and at least one of each outfield line. */
export function validStart(lineup: Slot[]) {
  const xi = lineup.slice(0, 6);
  const n = (p: Position) => xi.filter((s) => s.position === p).length;
  return n("GK") === 1 && n("DEF") >= 1 && n("MID") >= 1 && n("FWD") >= 1;
}
