import { useEffect, useState } from "react";
import type { Guest, MatchDayEvent, MatchDayGame, MatchDayTeam, ParticipantId, Player, Position, TeamMode } from "./types";

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

export function defaultTeamName(index: number) {
  return `Team ${String.fromCharCode(65 + index)}`;
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

// Teams fill to teamSize before the next one is opened — only the last
// team (the leftover) can come in under size.
function teamCapacities(total: number, teamSize: number): number[] {
  if (total <= 0) return [];
  const teamCount = Math.ceil(total / teamSize);
  const capacities = Array(teamCount).fill(teamSize);
  capacities[teamCount - 1] = total - teamSize * (teamCount - 1);
  return capacities;
}

function distributeRandom(items: number[], capacities: number[]): number[][] {
  const teams: number[][] = Array.from({ length: capacities.length }, () => []);
  let t = 0;
  for (const item of shuffle(items)) {
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

// Greedy draft: the next-best player always goes to the weakest team so far.
function distributeByRating(present: Player[], capacities: number[]): number[][] {
  const sorted = shuffle(present).sort((a, b) => b.rating - a.rating);
  const teams: number[][] = Array.from({ length: capacities.length }, () => []);
  const totals = Array(capacities.length).fill(0);
  for (const player of sorted) {
    let best = -1;
    for (let i = 0; i < teams.length; i++) {
      if (teams[i].length >= capacities[i]) continue;
      if (best === -1 || totals[i] < totals[best]) best = i;
    }
    if (best === -1) break;
    teams[best].push(player.id);
    totals[best] += player.rating;
  }
  return teams;
}

// Spreads each position evenly across the teams.
function distributeByPosition(present: Player[], capacities: number[]): number[][] {
  const positions: Position[] = ["GK", "DEF", "MID", "FWD"];
  const groups = positions.map((pos) => shuffle(present.filter((p) => p.position === pos)));
  const teams: number[][] = Array.from({ length: capacities.length }, () => []);
  const counts = teams.map(() => ({ GK: 0, DEF: 0, MID: 0, FWD: 0 }) as Record<Position, number>);

  let remaining = groups.reduce((n, g) => n + g.length, 0);
  while (remaining > 0) {
    for (let g = 0; g < groups.length; g++) {
      const player = groups[g].shift();
      if (!player) continue;
      remaining--;
      const pos = positions[g];
      let best = -1;
      for (let i = 0; i < teams.length; i++) {
        if (teams[i].length >= capacities[i]) continue;
        if (
          best === -1 ||
          counts[i][pos] < counts[best][pos] ||
          (counts[i][pos] === counts[best][pos] && teams[i].length < teams[best].length)
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

// Guests have no rating or position, so they top up whichever team has the most room.
function fillWithGuests(teams: ParticipantId[][], capacities: number[], guestIds: string[]) {
  for (const id of shuffle(guestIds)) {
    let best = -1;
    let bestRoom = 0;
    for (let i = 0; i < teams.length; i++) {
      const room = capacities[i] - teams[i].length;
      if (room > bestRoom) {
        bestRoom = room;
        best = i;
      }
    }
    if (best === -1) break;
    teams[best].push(id);
  }
}

export function buildTeams(
  players: Player[],
  presentSquad: number[],
  guests: Guest[],
  mode: TeamMode,
  teamSize: number,
): MatchDayTeam[] {
  const capacities = teamCapacities(presentSquad.length + guests.length, teamSize);
  if (capacities.length === 0) return [];
  const present = presentSquad
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => !!p);

  const squadTeams =
    mode === "rating"
      ? distributeByRating(present, capacities)
      : mode === "position"
        ? distributeByPosition(present, capacities)
        : distributeRandom(presentSquad, capacities);

  const teams: ParticipantId[][] = squadTeams.map((t) => [...t]);
  fillWithGuests(teams, capacities, guests.map((g) => g.id));
  return teams.map((roster, i) => ({ name: defaultTeamName(i), players: roster }));
}

// ---- The game clock ----------------------------------------------------
// It lives on the game record (saved to the API), not in component state,
// so it keeps running across screens, phones and the web admin.

type ClockFields = Pick<MatchDayGame, "clockStartedAt" | "clockElapsed">;

function elapsedAt(clock: ClockFields, now: number, gameSeconds: number) {
  const run = clock.clockStartedAt ? (now - clock.clockStartedAt) / 1000 : 0;
  return Math.min(gameSeconds, (clock.clockElapsed ?? 0) + Math.max(0, run));
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
