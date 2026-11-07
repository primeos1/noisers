// The Noisers League live draw. Everything here is a pure function of
// (seed, entrants, clock), so every device that has the same three shows
// the same pick at the same moment, and anyone can re-run it to check.

import type { ClubId } from "../lib/league";

export type Position = "GK" | "DEF" | "MID" | "FWD";

export interface Entrant {
  id: number;
  name: string;
  position: Position;
  /** Club rating, 4.0 to 9.5. Shown ×10 as an overall (OVR) like 74. */
  rating: number;
  photoUrl?: string | null;
}

export const CLUB_ORDER: ClubId[] = ["bulwark", "citadel", "islanders", "sentinel", "castellers", "coastal"];
const POT_SIZE = CLUB_ORDER.length;

export const ovr = (rating: number) => Math.round(rating * 10);

/* ------------------------------------------------------------------ hashing */

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** sfc32: small, fast and identical on every JS engine. */
function sfc32(a: number, b: number, c: number, d: number) {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export async function seededRandom(seed: string) {
  const hex = await sha256Hex(`noisers-draw:${seed}`);
  const word = (i: number) => parseInt(hex.slice(i * 8, i * 8 + 8), 16);
  const rand = sfc32(word(0), word(1), word(2), word(3));
  for (let i = 0; i < 15; i++) rand(); // warm up
  return rand;
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* --------------------------------------------------------------------- pots */

export interface Pot {
  index: number;
  label: string;
  keepers: boolean;
  players: Entrant[];
  low: number;
  high: number;
}

const byRating = (a: Entrant, b: Entrant) => b.rating - a.rating || a.name.localeCompare(b.name) || a.id - b.id;

/**
 * Outfield players by rating into pots of six, keepers in a pot of their
 * own drawn last. Keepers beyond six go into the outfield pots by rating.
 */
export function buildPots(entrants: Entrant[]): Pot[] {
  const keepers = entrants.filter((p) => p.position === "GK").sort(byRating);
  const outfield = [...entrants.filter((p) => p.position !== "GK"), ...keepers.slice(POT_SIZE)].sort(byRating);
  const gk = keepers.slice(0, POT_SIZE);

  const groups: { players: Entrant[]; keepers: boolean }[] = [];
  for (let i = 0; i < outfield.length; i += POT_SIZE) groups.push({ players: outfield.slice(i, i + POT_SIZE), keepers: false });
  if (gk.length) groups.push({ players: gk, keepers: true });

  return groups.map((g, i) => ({
    index: i,
    label: g.keepers ? "Keepers' pot" : `Pot ${i + 1}`,
    keepers: g.keepers,
    players: g.players,
    low: ovr(Math.min(...g.players.map((p) => p.rating))),
    high: ovr(Math.max(...g.players.map((p) => p.rating))),
  }));
}

/* --------------------------------------------------------------------- draw */

export interface Pick {
  /** 0-based across the whole draw. */
  n: number;
  round: number;
  /** 0-based within the round. */
  slot: number;
  club: ClubId;
  player: Entrant;
}

export interface Round {
  pot: Pot;
  /** The clubs that get a player from this pot, in the order they pick. */
  order: ClubId[];
}

export interface DrawResult {
  rounds: Round[];
  picks: Pick[];
  squads: Record<ClubId, Entrant[]>;
}

/**
 * Each round: shuffle who picks when, then each club draws a random player
 * still in the pot. When a pot is short, the clubs with the fewest players
 * so far go first, so squads never differ by more than one.
 */
export async function runDraw(seed: string, entrants: Entrant[]): Promise<DrawResult> {
  const rand = await seededRandom(seed);
  const pots = buildPots([...entrants].sort((a, b) => a.id - b.id));
  const squads = Object.fromEntries(CLUB_ORDER.map((c) => [c, [] as Entrant[]])) as Record<ClubId, Entrant[]>;
  const rounds: Round[] = [];
  const picks: Pick[] = [];

  for (const pot of pots) {
    const shuffled = shuffle(CLUB_ORDER, rand);
    // Stable sort: the shuffle decides ties.
    const order = [...shuffled].sort((a, b) => squads[a].length - squads[b].length).slice(0, pot.players.length);
    const pool = [...pot.players];
    order.forEach((club, slot) => {
      const [player] = pool.splice(Math.floor(rand() * pool.length), 1);
      squads[club].push(player);
      picks.push({ n: picks.length, round: rounds.length, slot, club, player });
    });
    rounds.push({ pot, order });
  }
  return { rounds, picks, squads };
}

/* ----------------------------------------------------------------- timeline */

export const INTRO = 6;
export const TITLE = 3.5;
export const PICK = 6.6;

/** Seconds into a pick when each beat lands. */
export const BEATS = { pull: 1.9, flip: 2.6, countFrom: 3.2, countTo: 4.5, reveal: 4.5, fly: 6.0 } as const;

type Segment =
  | { kind: "intro"; start: number; end: number }
  | { kind: "title"; start: number; end: number; round: number }
  | { kind: "pick"; start: number; end: number; round: number; pick: number };

export function buildTimeline(draw: DrawResult) {
  const segments: Segment[] = [{ kind: "intro", start: 0, end: INTRO }];
  let t = INTRO;
  let n = 0;
  draw.rounds.forEach((round, r) => {
    segments.push({ kind: "title", start: t, end: (t += TITLE), round: r });
    for (let i = 0; i < round.order.length; i++) segments.push({ kind: "pick", start: t, end: (t += PICK), round: r, pick: n++ });
  });
  return { segments, total: t };
}

export type Timeline = ReturnType<typeof buildTimeline>;

export type Moment =
  | { phase: "before"; untilStart: number; done: number }
  | { phase: "intro"; t: number; done: number }
  | { phase: "title"; t: number; round: number; done: number }
  | { phase: "pick"; t: number; round: number; pick: number; done: number }
  | { phase: "after"; done: number };

/** Where the draw is `elapsed` seconds after it starts. `done` counts picks already on the board. */
export function momentAt(timeline: Timeline, elapsed: number, totalPicks: number): Moment {
  if (elapsed < 0) return { phase: "before", untilStart: -elapsed, done: 0 };
  if (elapsed >= timeline.total) return { phase: "after", done: totalPicks };
  // Binary search for the segment holding `elapsed`.
  const s = timeline.segments;
  let lo = 0;
  let hi = s.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s[mid].start <= elapsed) lo = mid;
    else hi = mid - 1;
  }
  const seg = s[lo];
  const t = elapsed - seg.start;
  if (seg.kind === "intro") return { phase: "intro", t, done: 0 };
  if (seg.kind === "title") {
    const done = s.slice(0, lo).filter((x) => x.kind === "pick").length;
    return { phase: "title", t, round: seg.round, done };
  }
  return { phase: "pick", t, round: seg.round, pick: seg.pick, done: seg.pick + (t >= BEATS.fly ? 1 : 0) };
}

/**
 * The roulette: which waiting club is lit `t` seconds into a pick. It steps
 * through the clubs, slowing down (ease-out), and stops on the drawn one.
 */
export function rouletteAt(t: number, waiting: ClubId[], target: ClubId): { club: ClubId; step: number } {
  const steps = Math.max(1, waiting.length) * 2 + Math.max(0, waiting.indexOf(target));
  if (waiting.length <= 1 || t >= BEATS.pull) return { club: target, step: steps };
  const p = Math.min(1, t / BEATS.pull);
  const eased = 1 - Math.pow(1 - p, 3);
  const step = Math.min(steps, Math.floor(eased * (steps + 1)));
  return { club: waiting[step % waiting.length], step };
}

/** The rating shown on the card while it counts up from 40. */
export function countAt(t: number, target: number) {
  if (t < BEATS.countFrom) return 40;
  if (t >= BEATS.countTo) return target;
  const p = (t - BEATS.countFrom) / (BEATS.countTo - BEATS.countFrom);
  return Math.round(40 + (target - 40) * (1 - Math.pow(1 - p, 2)));
}

/* ------------------------------------------------------------------- verify */

export async function verifyDraw(seed: string, fingerprint: string, entrants: Entrant[], expected?: DrawResult) {
  const hash = await sha256Hex(seed.trim());
  const hashMatches = hash === fingerprint.trim().toLowerCase();
  const rerun = await runDraw(seed.trim(), entrants);
  const picksMatch =
    !expected ||
    (rerun.picks.length === expected.picks.length &&
      rerun.picks.every((p, i) => p.club === expected.picks[i].club && p.player.id === expected.picks[i].player.id));
  return { hash, hashMatches, picksMatch, picks: rerun.picks.length };
}

/* --------------------------------------------------------------- demo squad */

/** Stand-in players for demo draws before the real list is marked. */
export const DEMO_PLAYERS: Entrant[] = (() => {
  const first = ["Tobi", "Chidi", "Kunle", "Emeka", "Seyi", "Dayo", "Femi", "Uche", "Bayo", "Ifeanyi", "Tunde", "Obi", "Wale", "Nnamdi", "Segun", "Kelechi"];
  const last = ["A.", "B.", "C.", "D.", "E.", "F."];
  const positions: Position[] = ["DEF", "MID", "FWD"];
  const out: Entrant[] = [];
  for (let i = 0; i < 48; i++) {
    const gk = i >= 42;
    out.push({
      id: -(i + 1),
      name: `${first[i % first.length]} ${last[Math.floor(i / first.length) % last.length]}`,
      position: gk ? "GK" : positions[i % 3],
      rating: gk ? 6.4 + ((i * 7) % 20) / 10 : 6.2 + ((i * 37) % 28) / 10,
    });
  }
  return out;
})();
