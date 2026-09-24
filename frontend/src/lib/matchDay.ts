// Noisers FC matches are always internal — a Match Day event (title, venue,
// date) holds the roster for the day and can run several six-a-side games
// back to back before the admin ends it and it's stored, view-only, in
// Matches.

import type { Player, Position } from "./clubData";
import { findPlayer } from "./clubData";

// Fallbacks used only until SettingsContext's real (admin-configurable)
// values load — see lib/SettingsContext.tsx.
export const DEFAULT_TEAM_SIZE = 6;
export const DEFAULT_WIN_GOALS = 2;

export type MatchDayStatus = "live" | "ended";
export type GameStatus = "live" | "finished";
export type TeamMode = "random" | "rating" | "position";

// A squad player is referenced by their jersey number; a guest (someone
// who isn't a squad member) by a string id like "guest-1".
export type ParticipantId = number | string;

export interface Guest {
  id: string;
  name: string;
}

export interface MatchDayTeam {
  name: string;
  players: ParticipantId[];
}

export interface MatchDayGoal {
  id: string;
  teamIndex: 0 | 1;
  playerId: ParticipantId;
  assistPlayerId?: ParticipantId;
  ownGoal: boolean;
  minute: number;
}

export interface MatchDayCard {
  id: string;
  teamIndex: 0 | 1;
  playerId: ParticipantId;
  type: "yellow" | "red";
  reason: string;
  minute: number;
}

export interface MatchDayGame {
  id: string;
  teams: [MatchDayTeam, MatchDayTeam];
  goals: MatchDayGoal[];
  cards: MatchDayCard[];
  status: GameStatus;
  /** Epoch ms when the clock was last started; null/undefined while paused. */
  clockStartedAt?: number | null;
  /** Seconds of play accumulated before the current run. */
  clockElapsed?: number;
}

export interface MatchDayEvent {
  id: string;
  title: string;
  venue: string;
  date: string;
  createdAt: string;
  presentPlayers: number[];
  guests: Guest[];
  groups: MatchDayTeam[];
  games: MatchDayGame[];
  status: MatchDayStatus;
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function slugify(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "match-day";
}

export function uniqueEventId(title: string, existing: MatchDayEvent[]): string {
  const base = slugify(title);
  const taken = new Set(existing.map((e) => e.id));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function nextGuestId(guests: Guest[]): string {
  let n = guests.length + 1;
  const taken = new Set(guests.map((g) => g.id));
  while (taken.has(`guest-${n}`)) n++;
  return `guest-${n}`;
}

export function participantName(players: Player[], guests: Guest[], id: ParticipantId): string {
  if (typeof id === "number") {
    const player = players.find((p) => p.number === id);
    return player ? player.name : `#${id}`;
  }
  const guest = guests.find((g) => g.id === id);
  return guest ? guest.name : id;
}

// Teams fill to teamSize before the next one is opened — only the final
// team (the leftover) can come in under size.
function teamCapacities(total: number, teamSize: number): number[] {
  if (total <= 0) return [];
  const teamCount = Math.ceil(total / teamSize);
  const capacities = Array(teamCount).fill(teamSize);
  capacities[teamCount - 1] = total - teamSize * (teamCount - 1);
  return capacities;
}

// Round-robins across the eligible (not-yet-full) teams so a partial input
// (e.g. squad players when guests will top up the rest) still spreads out
// instead of piling into the first team(s).
function distributeRandom(items: number[], capacities: number[]): number[][] {
  const shuffled = shuffle(items);
  const teams: number[][] = Array.from({ length: capacities.length }, () => []);
  let t = 0;
  for (const item of shuffled) {
    let tries = 0;
    while (teams[t].length >= capacities[t] && tries < capacities.length) {
      t = (t + 1) % capacities.length;
      tries++;
    }
    if (tries >= capacities.length) break;
    teams[t].push(item);
    t = (t + 1) % capacities.length;
  }
  return teams;
}

// Greedy "draft to the lightest team": sort by rating (shuffled first so
// ties don't always land the same way), and always hand the next player to
// the eligible team with the lowest rating total so far — this spreads the
// strongest and weakest players evenly instead of stacking one team.
function distributeByRating(present: Player[], capacities: number[]): number[][] {
  const sorted = shuffle(present).sort((a, b) => b.rating - a.rating);
  const teamCount = capacities.length;
  const teams: number[][] = Array.from({ length: teamCount }, () => []);
  const totals = Array(teamCount).fill(0);

  for (const player of sorted) {
    let bestIdx = -1;
    let bestTotal = Infinity;
    for (let i = 0; i < teamCount; i++) {
      if (teams[i].length >= capacities[i]) continue;
      if (totals[i] < bestTotal) {
        bestTotal = totals[i];
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    teams[bestIdx].push(player.number);
    totals[bestIdx] += player.rating;
  }
  return teams;
}

// Same greedy idea, but balancing each position across teams rather than a
// single rating total — every team ends up with as even a mix of
// goalkeepers/defenders/midfielders/forwards as the numbers allow.
function distributeByPosition(present: Player[], capacities: number[]): number[][] {
  const positions: Position[] = ["GK", "DEF", "MID", "FWD"];
  const groups = positions.map((pos) => shuffle(present.filter((p) => p.position === pos)));

  const teamCount = capacities.length;
  const teams: number[][] = Array.from({ length: teamCount }, () => []);
  const posCounts: Record<Position, number>[] = Array.from({ length: teamCount }, () => ({
    GK: 0,
    DEF: 0,
    MID: 0,
    FWD: 0,
  }));

  let remaining = present.length;
  while (remaining > 0) {
    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];
      if (group.length === 0) continue;
      const pos = positions[g];
      const player = group.shift()!;

      let bestIdx = -1;
      let bestPosCount = Infinity;
      let bestSize = Infinity;
      for (let i = 0; i < teamCount; i++) {
        if (teams[i].length >= capacities[i]) continue;
        const posCount = posCounts[i][pos];
        const size = teams[i].length;
        if (posCount < bestPosCount || (posCount === bestPosCount && size < bestSize)) {
          bestPosCount = posCount;
          bestSize = size;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) continue;
      teams[bestIdx].push(player.number);
      posCounts[bestIdx][pos] += 1;
      remaining -= 1;
    }
  }
  return teams;
}

// Guests don't have a rating or position to balance by, so once the squad
// players are placed, guests just top up whichever team currently has the
// most room — keeping team sizes even without pretending to rate them.
function fillWithGuests(teams: ParticipantId[][], capacities: number[], guestIds: string[]): void {
  for (const id of shuffle(guestIds)) {
    let bestIdx = -1;
    let bestRoom = 0;
    for (let i = 0; i < teams.length; i++) {
      const room = capacities[i] - teams[i].length;
      if (room > bestRoom) {
        bestRoom = room;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    teams[bestIdx].push(id);
  }
}

export function buildTeams(
  players: Player[],
  presentSquad: number[],
  guests: Guest[],
  mode: TeamMode,
  teamSize: number = DEFAULT_TEAM_SIZE,
): MatchDayTeam[] {
  const total = presentSquad.length + guests.length;
  const capacities = teamCapacities(total, teamSize);
  if (capacities.length === 0) return [];

  let squadTeams: number[][];
  if (mode === "rating") {
    squadTeams = distributeByRating(presentSquad.map((n) => findPlayer(players, n)), capacities);
  } else if (mode === "position") {
    squadTeams = distributeByPosition(presentSquad.map((n) => findPlayer(players, n)), capacities);
  } else {
    squadTeams = distributeRandom(presentSquad, capacities);
  }

  const teams: ParticipantId[][] = squadTeams.map((t) => [...t]);
  fillWithGuests(
    teams,
    capacities,
    guests.map((g) => g.id),
  );

  return teams.map((roster, i) => ({ name: defaultTeamName(i), players: roster }));
}

export function defaultTeamName(index: number) {
  return `Team ${String.fromCharCode(65 + index)}`;
}

export function scoreOf(game: Pick<MatchDayGame, "goals">, teamIndex: 0 | 1) {
  return game.goals.filter((g) => g.teamIndex === teamIndex).length;
}

// Flattens every game played across every match day, in play order, paired
// with the event it belongs to (needed to resolve guest names/date/etc).
export function allGames(events: MatchDayEvent[]): { event: MatchDayEvent; game: MatchDayGame }[] {
  return events.flatMap((event) => event.games.map((game) => ({ event, game })));
}

export function todayLabel() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Formats a date-picker value ("YYYY-MM-DD") the same way as todayLabel. */
export function isoDateLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
