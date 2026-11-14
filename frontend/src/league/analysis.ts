// A quick, transparent read on each fixture for the predictor: club
// strength from the squad's league ratings, nudged by league form once games
// are played, turned into a likely score and a likely scorer. A guide, not a
// promise: it only uses what's on the league site.

import type { ClubId } from "../lib/league";
import { clubById, type LeagueData, type NumberedGame } from "./data";
import type { DrawResult, Entrant } from "./draw";

export interface FixtureRead {
  home: number;
  away: number;
  favourite: ClubId | null;
  scorer: Entrant | null;
  text: string;
}

function form(club: ClubId, data: LeagueData, games: NumberedGame[]) {
  let played = 0, points = 0, scored = 0;
  for (const g of games) {
    if (g.home !== club && g.away !== club) continue;
    const r = data.results.find((x) => x.matchNo === g.no);
    if (r?.status !== "final") continue;
    const home = g.home === club;
    const f = home ? r.homeScore : r.awayScore;
    const a = home ? r.awayScore : r.homeScore;
    played++;
    scored += f;
    points += f > a ? 3 : f === a ? 1 : 0;
  }
  return { played, ppg: played ? points / played : 0, gpg: played ? scored / played : 0 };
}

function strength(club: ClubId, draw: DrawResult, data: LeagueData, games: NumberedGame[]) {
  const squad = draw.squads[club];
  const rating = squad.length ? squad.reduce((s, p) => s + p.rating, 0) / squad.length : 6;
  const f = form(club, data, games);
  // Form counts for more as the season goes on.
  return rating + (f.played ? (f.ppg - 1.4) * 0.25 * Math.min(1, f.played / 4) : 0);
}

function likelyScorer(club: ClubId, draw: DrawResult, data: LeagueData): Entrant | null {
  const squad = draw.squads[club];
  const goals = new Map<number, number>();
  for (const g of data.goals) if (g.playerId && !g.ownGoal) goals.set(g.playerId, (goals.get(g.playerId) ?? 0) + 1);
  const byGoals = [...squad].filter((p) => goals.has(p.id)).sort((a, b) => goals.get(b.id)! - goals.get(a.id)! || b.rating - a.rating)[0];
  if (byGoals) return byGoals;
  const attackers = squad.filter((p) => p.position === "FWD").sort((a, b) => b.rating - a.rating);
  return attackers[0] ?? [...squad].filter((p) => p.position === "MID").sort((a, b) => b.rating - a.rating)[0] ?? null;
}

export function readFixture(g: NumberedGame, draw: DrawResult, data: LeagueData, games: NumberedGame[]): FixtureRead {
  const sh = strength(g.home, draw, data, games);
  const sa = strength(g.away, draw, data, games);
  const diff = sh - sa;
  const clamp = (x: number) => Math.min(3.5, Math.max(0.3, x));
  let home = Math.round(clamp(1.2 + diff * 1.1));
  let away = Math.round(clamp(1.2 - diff * 1.1));
  const favourite = Math.abs(diff) < 0.12 ? null : diff > 0 ? g.home : g.away;
  if (favourite && home === away) {
    if (favourite === g.home) home++;
    else away++;
  }
  const scorer = likelyScorer(favourite ?? g.home, draw, data);
  const short = (id: ClubId) => clubById.get(id)!.name;
  const lead = favourite
    ? `${short(favourite)} ${Math.abs(diff) > 0.45 ? "are clear favourites" : "edge it"}`
    : "Too close to call";
  const text = `${lead}. Tip: ${home}–${away}${scorer ? `, ${scorer.name} to score` : ""}.`;
  return { home, away, favourite, scorer, text };
}
