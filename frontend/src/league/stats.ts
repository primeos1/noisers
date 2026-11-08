// League-only player numbers and awards, worked out from the league's own
// results and goals. Nothing here reads or writes Noisers match days or
// ratings — the rating shown is the frozen one the draw used.

import type { ClubId } from "../lib/league";
import { GAMES, standings, type LeagueData } from "./data";
import type { DrawResult, Entrant } from "./draw";

export interface MatchLine {
  no: number;
  night: number;
  opp: ClubId;
  home: boolean;
  status: "scheduled" | "live" | "final";
  for: number;
  against: number;
  goals: number;
  assists: number;
  ownGoals: number;
}

export interface PlayerLine {
  player: Entrant;
  club: ClubId;
  /** Finished games of their club; we don't track line-ups, so the whole squad counts. */
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals: number;
  assists: number;
  ownGoals: number;
  /** Defenders and keepers: finished games their club didn't concede. */
  cleanSheets: number;
  saves: number;
  hatTricks: number;
  /** Sundays they were Player of the Night. */
  nights: number;
  matches: MatchLine[];
}

export interface NightWinner {
  night: number;
  line: PlayerLine;
  goals: number;
  assists: number;
}

export interface LeagueStats {
  lines: PlayerLine[];
  byId: Map<number, PlayerLine>;
  nightWinners: NightWinner[];
  /** Every game finished: the awards are decided. */
  seasonOver: boolean;
  started: boolean;
}

export function leagueStats(draw: DrawResult, data: LeagueData): LeagueStats {
  const results = new Map(data.results.map((r) => [r.matchNo, r]));
  const lines: PlayerLine[] = [];
  const byId = new Map<number, PlayerLine>();

  for (const [club, squad] of Object.entries(draw.squads) as [ClubId, Entrant[]][]) {
    for (const player of squad) {
      const line: PlayerLine = { player, club, played: 0, won: 0, drawn: 0, lost: 0, goals: 0, assists: 0, ownGoals: 0, cleanSheets: 0, saves: 0, hatTricks: 0, nights: 0, matches: [] };
      for (const g of GAMES) {
        if (g.home !== club && g.away !== club) continue;
        const home = g.home === club;
        const r = results.get(g.no);
        const m: MatchLine = {
          no: g.no,
          night: g.night,
          opp: home ? g.away : g.home,
          home,
          status: r?.status ?? "scheduled",
          for: r ? (home ? r.homeScore : r.awayScore) : 0,
          against: r ? (home ? r.awayScore : r.homeScore) : 0,
          goals: 0,
          assists: 0,
          ownGoals: 0,
        };
        if (player.position === "GK" && m.status !== "scheduled") line.saves += r?.saves?.[player.id] ?? 0;
        line.matches.push(m);
        if (m.status === "final") {
          line.played++;
          if (m.for > m.against) line.won++;
          else if (m.for < m.against) line.lost++;
          else line.drawn++;
          if (m.against === 0 && ["GK", "DEF"].includes(player.position)) line.cleanSheets++;
        }
      }
      lines.push(line);
      byId.set(player.id, line);
    }
  }

  for (const goal of data.goals) {
    const scorer = goal.playerId != null ? byId.get(goal.playerId) : undefined;
    const m = scorer?.matches.find((x) => x.no === goal.matchNo);
    if (scorer && m) {
      if (goal.ownGoal) { scorer.ownGoals++; m.ownGoals++; }
      else { scorer.goals++; m.goals++; }
    }
    const assister = goal.assistPlayerId != null ? byId.get(goal.assistPlayerId) : undefined;
    const am = assister?.matches.find((x) => x.no === goal.matchNo);
    if (assister && am && !goal.ownGoal) { assister.assists++; am.assists++; }
  }
  for (const l of lines) l.hatTricks = l.matches.filter((m) => m.goals >= 3).length;

  // Player of the Night: once every game that Sunday is finished, the most
  // goals + assists that night; ties go to goals, then wins that night.
  const nightWinners: NightWinner[] = [];
  for (let night = 1; night <= 5; night++) {
    const games = GAMES.filter((g) => g.night === night);
    if (!games.every((g) => results.get(g.no)?.status === "final")) continue;
    let best: NightWinner & { wins: number } | null = null;
    for (const l of lines) {
      const ms = l.matches.filter((m) => m.night === night);
      const goals = ms.reduce((s, m) => s + m.goals, 0);
      const assists = ms.reduce((s, m) => s + m.assists, 0);
      const wins = ms.filter((m) => m.for > m.against).length;
      if (goals + assists === 0) continue;
      const better =
        !best ||
        goals + assists > best.goals + best.assists ||
        (goals + assists === best.goals + best.assists && (goals > best.goals || (goals === best.goals && wins > best.wins)));
      if (better) best = { night, line: l, goals, assists, wins };
    }
    if (best) {
      best.line.nights++;
      nightWinners.push({ night: best.night, line: best.line, goals: best.goals, assists: best.assists });
    }
  }

  return {
    lines,
    byId,
    nightWinners,
    seasonOver: GAMES.every((g) => results.get(g.no)?.status === "final"),
    started: data.results.some((r) => r.status !== "scheduled"),
  };
}

/* ----------------------------------------------------------------- awards */

export interface AwardDef {
  id: string;
  award: string;
  stat: string;
  blurb: string;
  value: (l: PlayerLine) => number;
  /** Who can win it. */
  eligible?: (l: PlayerLine) => boolean;
}

export const AWARDS: AwardDef[] = [
  { id: "golden-boot", award: "Golden Boot", stat: "goals", blurb: "The league's top scorer.", value: (l) => l.goals },
  { id: "playmaker", award: "Playmaker", stat: "assists", blurb: "Most goals set up for someone else.", value: (l) => l.assists },
  { id: "talisman", award: "Talisman", stat: "goals + assists", blurb: "Most goals scored or set up.", value: (l) => l.goals + l.assists },
  { id: "golden-glove", award: "Golden Glove", stat: "clean sheets", blurb: "The keeper who kept the door shut.", value: (l) => l.cleanSheets, eligible: (l) => l.player.position === "GK" },
  { id: "potn", award: "Player of the Night", stat: "nights", blurb: "Most Sundays as the night's best player.", value: (l) => l.nights },
  { id: "hat-tricks", award: "Hat-trick Hero", stat: "hat-tricks", blurb: "Games with three goals or more.", value: (l) => l.hatTricks },
  { id: "serial-winner", award: "Serial Winner", stat: "wins", blurb: "Their club just keeps winning.", value: (l) => l.won },
  { id: "wrong-end", award: "Wrong End", stat: "own goals", blurb: "Scored for the other lot. Most own goals.", value: (l) => l.ownGoals },
];

/** The top few for an award, best first; empty until someone has a number. */
export function race(stats: LeagueStats, def: AwardDef, count = 4) {
  return stats.lines
    .filter((l) => (def.eligible ? def.eligible(l) : true) && def.value(l) > 0)
    .sort((a, b) => def.value(b) - def.value(a) || b.goals + b.assists - (a.goals + a.assists) || a.player.name.localeCompare(b.player.name))
    .slice(0, count);
}

export function champions(data: LeagueData) {
  return standings(data.results)[0];
}
