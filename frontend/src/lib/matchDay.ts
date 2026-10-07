// Noisers FC matches are always internal — a Match Day event (title, venue,
// date) holds the roster for the day and can run several six-a-side games
// back to back before the admin ends it and it's stored, view-only, in
// Matches.

import type { Player, Position } from "./clubData";

// Fallbacks used only until SettingsContext's real (admin-configurable)
// values load — see lib/SettingsContext.tsx.
export const DEFAULT_TEAM_SIZE = 6;
export const DEFAULT_WIN_GOALS = 2;

export type MatchDayStatus = "live" | "ended";
export type GameStatus = "live" | "finished";
export type TeamMode = "random" | "rating" | "position";

// A squad player is referenced by their player id (shirt numbers can
// repeat); a guest (someone who isn't a squad member) by a string id like
// "guest-1". Match days saved before the switch to ids may also hold "#<n>"
// for a player who has since been removed.
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

/** One per save — only keepers (GK as main or second position) make them. */
export interface MatchDaySave {
  id: string;
  teamIndex: 0 | 1;
  playerId: ParticipantId;
  minute: number;
  /** A saved penalty — still a save, with its own rating weight. */
  penalty?: boolean;
}

export interface MatchDayGame {
  id: string;
  teams: [MatchDayTeam, MatchDayTeam];
  goals: MatchDayGoal[];
  cards: MatchDayCard[];
  /** Missing on games logged before saves were recorded. */
  saves?: MatchDaySave[];
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
  /** Its week number, set by the server: Matchday 1 and 2 are week 1, 3 and 4 week 2, and so on. */
  week?: number;
  presentPlayers: number[];
  guests: Guest[];
  groups: MatchDayTeam[];
  games: MatchDayGame[];
  status: MatchDayStatus;
  /** How the teams were last drawn; missing until they are. */
  teamMode?: TeamMode | null;
  /** The server's save counter — see MatchDayContext's save queue. */
  version?: number;
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
    const player = players.find((p) => p.id === id);
    return player ? player.name : "Former player";
  }
  const guest = guests.find((g) => g.id === id);
  return guest ? guest.name : id;
}

// Teams fill to teamSize before the next one is opened — only the final
// team (the leftover) can come in under size. There are only MAX_TEAMS
// colours, so once that many teams are full the extra players are spread
// across them as evenly as possible instead of opening another team.
function teamCapacities(total: number, teamSize: number): number[] {
  if (total <= 0) return [];
  const teamCount = Math.min(MAX_TEAMS, Math.ceil(total / teamSize));
  if (total > teamCount * teamSize) {
    return Array.from({ length: teamCount }, (_, i) => Math.floor(total / teamCount) + (i < total % teamCount ? 1 : 0));
  }
  const capacities = Array(teamCount).fill(teamSize);
  capacities[teamCount - 1] = total - teamSize * (teamCount - 1);
  return capacities;
}

// Round-robins so a group spreads out instead of piling into the first
// team(s). Quotas always add up to the group size, so everyone gets a place.
function distributeRandom(ids: number[], quotas: number[]): number[][] {
  const teams: number[][] = quotas.map(() => []);
  let t = 0;
  for (const id of shuffle(ids)) {
    let tries = 0;
    while (teams[t].length >= quotas[t] && tries < quotas.length) {
      t = (t + 1) % quotas.length;
      tries++;
    }
    if (tries >= quotas.length) break;
    teams[t].push(id);
    t = (t + 1) % quotas.length;
  }
  return teams;
}

// Greedy "draft to the lightest team": sort by rating (shuffled first so
// ties don't always land the same way) and hand the next player to the team
// with the lowest rating total so far — counting the players already placed
// from an earlier group — so the strongest and weakest are spread evenly.
function distributeByRating(group: Player[], quotas: number[], placed: Player[][]): number[][] {
  const sorted = shuffle(group).sort((a, b) => b.rating - a.rating);
  const teams: number[][] = quotas.map(() => []);
  const totals = placed.map((team) => team.reduce((sum, p) => sum + p.rating, 0));
  for (const player of sorted) {
    let best = -1;
    for (let i = 0; i < teams.length; i++) {
      if (teams[i].length >= quotas[i]) continue;
      if (best === -1 || totals[i] < totals[best]) best = i;
    }
    if (best === -1) break;
    teams[best].push(player.id);
    totals[best] += player.rating;
  }
  return teams;
}

// Same greedy idea, but balancing each position across teams rather than a
// single rating total. Players are balanced by their main position; a second
// position doesn't count.
function distributeByPosition(group: Player[], quotas: number[], placed: Player[][]): number[][] {
  const positions: Position[] = ["GK", "DEF", "MID", "FWD"];
  const groups = positions.map((pos) => shuffle(group.filter((p) => p.position === pos)));
  const teams: number[][] = quotas.map(() => []);
  const counts = placed.map((team) => {
    const count: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    team.forEach((p) => count[p.position]++);
    return count;
  });
  const size = (i: number) => placed[i].length + teams[i].length;

  let remaining = groups.reduce((n, g) => n + g.length, 0);
  while (remaining > 0) {
    for (let g = 0; g < groups.length; g++) {
      const player = groups[g].shift();
      if (!player) continue;
      remaining--;
      const pos = positions[g];
      let best = -1;
      for (let i = 0; i < teams.length; i++) {
        if (teams[i].length >= quotas[i]) continue;
        if (
          best === -1 ||
          counts[i][pos] < counts[best][pos] ||
          (counts[i][pos] === counts[best][pos] && size(i) < size(best))
        ) {
          best = i;
        }
      }
      if (best === -1) continue;
      teams[best].push(player.id);
      counts[best][pos]++;
    }
  }
  return teams;
}

// How many of a group each team takes so the group is spread evenly: each
// one goes to the team with the fewest of them so far (ties: the most room
// left, then random), never past the room a team has left.
function spreadQuotas(room: number[], count: number): number[] {
  const quotas = room.map(() => 0);
  const order = shuffle(room.map((_, i) => i));
  for (let n = 0; n < count; n++) {
    let best = -1;
    for (const i of order) {
      if (quotas[i] >= room[i]) continue;
      if (
        best === -1 ||
        quotas[i] < quotas[best] ||
        (quotas[i] === quotas[best] && room[i] - quotas[i] > room[best] - quotas[best])
      ) {
        best = i;
      }
    }
    if (best === -1) break;
    quotas[best] += 1;
  }
  return quotas;
}

// Members are placed first, then guest members, then guests — each group
// spread as evenly as the room left by the one before allows. Guests have
// no rating or position, so they're simply dealt into whatever is left.
export function buildTeams(
  players: Player[],
  presentSquad: number[],
  guests: Guest[],
  mode: TeamMode,
  teamSize: number = DEFAULT_TEAM_SIZE,
): MatchDayTeam[] {
  const squad = presentSquad
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => !!p);
  const capacities = teamCapacities(squad.length + guests.length, teamSize);
  if (capacities.length === 0) return [];

  const placed: Player[][] = capacities.map(() => []);
  let room = [...capacities];
  for (const group of [squad.filter((p) => p.membership !== "guest"), squad.filter((p) => p.membership === "guest")]) {
    const quotas = spreadQuotas(room, group.length);
    const picks =
      mode === "rating"
        ? distributeByRating(group, quotas, placed)
        : mode === "position"
          ? distributeByPosition(group, quotas, placed)
          : distributeRandom(group.map((p) => p.id), quotas);
    picks.forEach((ids, i) => placed[i].push(...group.filter((p) => ids.includes(p.id))));
    room = room.map((r, i) => r - quotas[i]);
  }

  const teams: ParticipantId[][] = placed.map((team) => team.map((p) => p.id));
  const guestIds = shuffle(guests.map((g) => g.id));
  room.forEach((r, i) => teams[i].push(...guestIds.splice(0, r)));

  return nameTeams(players, teams);
}

// The five colours are dealt out in a random order; Team Bibs only ever
// appears as the sixth team. Rozay (#7) always wears the white stripes:
// his team takes that name, swapping with whichever team had it. Bibs is
// pinned to sixth, so if he's drawn there he instead trades places with the
// most similar player on White Stripes (same position, closest rating).
const WHITE_STRIPES = "Team White Stripes";
const BIBS = "Team Bibs";

function isRozay(player: Player) {
  return player.name.trim().toLowerCase() === "rozay";
}

function nameTeams(players: Player[], rosters: ParticipantId[][]): MatchDayTeam[] {
  const colours = shuffle(TEAM_NAMES.filter((n) => n !== BIBS));
  const teams = rosters.map((roster, i) => ({
    name: i < colours.length ? colours[i] : defaultTeamName(i),
    players: [...roster],
  }));

  const rozay = players.find(isRozay);
  const his = rozay ? teams.findIndex((t) => t.players.includes(rozay.id)) : -1;
  if (!rozay || his < 0 || teams[his].name === WHITE_STRIPES) return teams;

  const stripes = teams.findIndex((t) => t.name === WHITE_STRIPES);
  if (teams[his].name === BIBS && stripes >= 0) {
    const candidates = teams[stripes].players;
    const squad = candidates
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is Player => !!p);
    const score = (p: Player) =>
      (p.membership === rozay.membership ? 0 : 10000) + (p.position === rozay.position ? 0 : 1000) + Math.abs(p.rating - rozay.rating);
    const partner = squad.length > 0 ? squad.reduce((a, b) => (score(b) < score(a) ? b : a)).id : candidates[0];
    if (partner === undefined) return teams;
    teams[his].players = teams[his].players.map((id) => (id === rozay.id ? partner : id));
    teams[stripes].players = candidates.map((id) => (id === partner ? rozay.id : id));
    return teams;
  }

  if (stripes >= 0) teams[stripes].name = teams[his].name;
  teams[his].name = WHITE_STRIPES;
  return teams;
}

export const TEAM_NAMES = ["Team Black", "Team Blue", "Team Green", "Team Grey", "Team White Stripes", "Team Bibs"] as const;
export const MAX_TEAMS = TEAM_NAMES.length;

export function defaultTeamName(index: number) {
  return TEAM_NAMES[index] ?? `Team ${index + 1}`;
}

/** The first colour not already taken by one of the existing teams. */
export function nextTeamName(existing: { name: string }[]) {
  const taken = new Set(existing.map((t) => t.name));
  return TEAM_NAMES.find((n) => !taken.has(n)) ?? defaultTeamName(existing.length);
}

export function scoreOf(game: Pick<MatchDayGame, "goals">, teamIndex: 0 | 1) {
  return game.goals.filter((g) => g.teamIndex === teamIndex).length;
}

export function newGame(a: MatchDayTeam, b: MatchDayTeam): MatchDayGame {
  return {
    id: `g${Date.now()}`,
    teams: [
      { name: a.name, players: [...a.players] },
      { name: b.name, players: [...b.players] },
    ],
    goals: [],
    cards: [],
    saves: [],
    status: "live",
    clockStartedAt: null,
    clockElapsed: 0,
  };
}

/** A game auto-started but never played — nothing logged, clock never run. */
export function isUntouched(game: MatchDayGame) {
  return (
    game.goals.length === 0 &&
    game.cards.length === 0 &&
    (game.saves ?? []).length === 0 &&
    !game.clockStartedAt &&
    !game.clockElapsed
  );
}

export interface Rotation {
  /** Indexes into the groups for the next game, or null with under two teams. */
  next: [number, number] | null;
  /** Teams waiting after that, in order. */
  queue: number[];
}

// Winner stays on. The randomized team order is the queue: the first two
// play, the winner stays to face the next in line and the loser goes to the
// back. A draw sends both off — the challenger first, then the team that was
// already on (it has played more) — and the next two in line play. The queue
// is rebuilt from the finished games each time, so correcting or deleting a
// result fixes the rotation too. Games are matched to teams by name.
export function nextFixture(groups: MatchDayTeam[], games: MatchDayGame[]): Rotation {
  if (groups.length < 2) return { next: null, queue: [] };

  const indexOf = (name: string) => groups.findIndex((g) => g.name === name);
  let queue = groups.map((_, i) => i);
  let holder: number | null = null;

  for (const game of games) {
    if (game.status !== "finished") continue;
    const a = indexOf(game.teams[0].name);
    const b = indexOf(game.teams[1].name);
    if (a < 0 || b < 0 || a === b) continue;

    // A hand-picked game that left the team on out — it keeps its turn.
    if (holder !== null && holder !== a && holder !== b) queue.unshift(holder);
    queue = queue.filter((i) => i !== a && i !== b);

    const sa = scoreOf(game, 0);
    const sb = scoreOf(game, 1);
    if (sa === sb) {
      queue.push(...(holder === a ? [b, a] : [a, b]));
      holder = null;
    } else {
      const winner: number = sa > sb ? a : b;
      queue.push(winner === a ? b : a);
      holder = winner;
    }
  }

  const next: [number, number] = holder !== null ? [holder, queue[0]] : [queue[0], queue[1]];
  return { next, queue: queue.filter((i) => !next.includes(i)) };
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
