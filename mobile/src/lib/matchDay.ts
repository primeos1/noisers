import { useEffect, useState } from "react";
import type { Guest, MatchDayEvent, MatchDayGame, MatchDayTeam, ParticipantId, Player, Position, TeamMode } from "./types";
import { scoreOf } from "./derive";

// Running a match day from the phone — ported from frontend/src/lib/matchDay.ts
// and useMatchTimer.ts. If you change how teams are built or the clock
// works, update both.

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function slugify(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "match-day";
}

/** The event id is a slug of its title, made unique. */
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

export function nextJerseyNumber(players: Player[]): number {
  const taken = new Set(players.map((p) => p.number));
  for (let n = 1; n < 100; n++) if (!taken.has(n)) return n;
  return 99;
}

const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** Same label the web writes, e.g. "Sun 21 Sep". */
export function formatEventDate(date: Date) {
  return dateLabel.format(date);
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
  teamSize: number,
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

// ---- The game clock ----------------------------------------------------
// It lives on the game record (saved to the API), not in component state,
// so it keeps running across screens, phones and the web admin.

type ClockFields = Pick<MatchDayGame, "clockStartedAt" | "clockElapsed">;

function elapsedAt(clock: ClockFields, now: number, gameSeconds: number) {
  const run = clock.clockStartedAt ? (now - clock.clockStartedAt) / 1000 : 0;
  return Math.min(gameSeconds, (clock.clockElapsed ?? 0) + Math.max(0, run));
}

/** A game's clock fields, stopped where it is now — for saves built outside the hook. */
export function stoppedClockOf(game: ClockFields, gameMinutes: number): ClockFields {
  return { clockStartedAt: null, clockElapsed: elapsedAt(game, Date.now(), gameMinutes * 60) };
}

export function useMatchTimer(game: MatchDayGame | null, save: (clock: ClockFields) => void, gameMinutes: number) {
  const gameSeconds = gameMinutes * 60;
  const [now, setNow] = useState(() => Date.now());
  const clockRunning = !!game?.clockStartedAt;

  useEffect(() => {
    if (!clockRunning) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [clockRunning]);

  // `now` can trail a just-started clock by one tick; elapsedAt clamps that to zero.
  const elapsed = game ? elapsedAt(game, now, gameSeconds) : 0;
  const secondsLeft = Math.ceil(gameSeconds - elapsed);
  const isFinished = secondsLeft <= 0;
  const running = clockRunning && !isFinished;

  /** Clock fields for a stopped clock — merge into another update to pause in the same save. */
  function stoppedClock(): ClockFields {
    return { clockStartedAt: null, clockElapsed: game ? elapsedAt(game, Date.now(), gameSeconds) : 0 };
  }

  return {
    secondsLeft: Math.max(0, secondsLeft),
    running,
    isFinished,
    minute: Math.min(gameMinutes, Math.floor(elapsed / 60) + 1),
    start() {
      if (game && !running && !isFinished) save({ clockStartedAt: Date.now(), clockElapsed: elapsed });
    },
    pause() {
      if (game?.clockStartedAt) save(stoppedClock());
    },
    reset() {
      if (game) save({ clockStartedAt: null, clockElapsed: 0 });
    },
    stoppedClock,
  };
}

export function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
