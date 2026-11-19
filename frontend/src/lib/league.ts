import navyKit from "../assets/kits/navy.jpg";
import whiteKit from "../assets/kits/white.jpg";
import yellowKit from "../assets/kits/yellow.jpg";
import blackKit from "../assets/kits/black.jpg";
import stripesKit from "../assets/kits/stripes.jpg";
import greenKit from "../assets/kits/green.jpg";

export type ClubId = "bulwark" | "citadel" | "islanders" | "sentinel" | "castellers" | "coastal";
export type Idea = "Protection" | "Community" | "Place";

export interface Club {
  id: ClubId;
  name: string;
  /** Three letters for tight rows and crests. */
  short: string;
  kit: string;
  motto: string;
  idea: Idea;
  meaning: string;
  fits: string;
  /** Shirt, trim, glow; `on` is the text colour that reads on the shirt. */
  colours: { primary: string; secondary: string; glow: string; on: string; stripe?: string };
  image: string;
}

/** The six squads, in the order of "How we chose our club names" (8 Oct 2026). */
export const clubs: Club[] = [
  {
    id: "bulwark",
    name: "Bulwark FC",
    short: "BUL",
    kit: "Navy",
    motto: "The wall that holds.",
    idea: "Protection",
    meaning:
      "A bulwark is a solid defensive wall or rampart. At sea it is the strong side of a ship that shields everyone on deck from the waves. The word has long described anyone or anything that stands firm so that others are protected.",
    fits: "Navy is the colour of naval discipline and depth, so the name and the kit say the same thing: solid, composed and very hard to break down. It is short, strong and easy to chant.",
    colours: { primary: "#1d2547", secondary: "#efece4", glow: "#4a63b8", on: "#f6f6f3" },
    image: navyKit,
  },
  {
    id: "citadel",
    name: "Citadel FC",
    short: "CIT",
    kit: "White",
    motto: "The last stronghold.",
    idea: "Protection",
    meaning:
      "A citadel is the fortified heart of a city, the strongest point that must hold when everything else is under pressure. It stands for protection, pride and a place that opponents find very difficult to enter.",
    fits: "White reads like clean stone walls, calm and confident. The name carries authority without sounding aggressive, and it sits naturally beside Bulwark FC as a second name built on strong defence.",
    colours: { primary: "#eeeeea", secondary: "#1d2a4d", glow: "#b9c6e6", on: "#0a0e1a" },
    image: whiteKit,
  },
  {
    id: "islanders",
    name: "Islanders United",
    short: "ISL",
    kit: "Yellow",
    motto: "Stronger together, wherever we stand.",
    idea: "Community",
    meaning:
      "People who live on an island are surrounded by water and depend on one another, so the word stands for community and loyalty to a close-knit group. 'United' is the classic football word for a team that wins as one.",
    fits: "Yellow is the colour of sun, light and energy, which gives the name a warm, bright feel. Lagos itself grew from islands, so the name also sits comfortably beside Coastal City FC. It is the most upbeat of the six names.",
    colours: { primary: "#f2b41c", secondary: "#121212", glow: "#f2b41c", on: "#0a0e1a" },
    image: yellowKit,
  },
  {
    id: "sentinel",
    name: "Sentinel FC",
    short: "SEN",
    kit: "Black",
    motto: "Always on watch.",
    idea: "Protection",
    meaning:
      "A sentinel is a guard posted to keep watch, alert while others rest. The word stands for discipline, awareness and reliability: a team that never switches off and never lets its guard down.",
    fits: "Black is the colour of the night watch, quiet and focused, so the kit and the name feel like one idea. It is easy to say and spell, and gives the squad a sharp, serious identity.",
    colours: { primary: "#141416", secondary: "#f0ad1e", glow: "#f0ad1e", on: "#f0ad1e" },
    image: blackKit,
  },
  {
    id: "castellers",
    name: "Castellers United",
    short: "CAS",
    kit: "Blue and red stripes",
    motto: "Built from the base up.",
    idea: "Community",
    meaning:
      "Castellers are the people who build the human towers (castells) of Catalonia, climbing onto one another's shoulders to make columns many levels high. A tower stands only when a strong base carries everyone above it, so the name stands for strength, balance, trust and teamwork.",
    fits: "Blue and red stripes are the famous colours of FC Barcelona. This squad is our nod to real football at the highest level, and the Catalan tradition of the castellers ties those colours to their home region. 'United' completes the name.",
    colours: { primary: "#a01d3a", secondary: "#e9b53b", glow: "#3a5bd1", on: "#e9b53b", stripe: "#1f3c94" },
    image: stripesKit,
  },
  {
    id: "coastal",
    name: "Coastal City FC",
    short: "CCF",
    kit: "Green",
    motto: "A nod to Lagos, Nigeria.",
    idea: "Place",
    meaning:
      "Lagos sits on the Atlantic coast and is Nigeria's largest city, a lagoon and ocean port that is known as the Centre of Excellence. 'Coastal City' is a plain, proud way of pointing to it without naming it.",
    fits: "Green is also Nigeria's national colour, so the kit and the name both speak for home. The name is simple, easy to say and gives the squad a sense of place that the other names do not.",
    colours: { primary: "#1d6a3a", secondary: "#f3f1ea", glow: "#2fa35f", on: "#f6f6f3" },
    image: greenKit,
  },
];

export const ideas: { idea: Idea; note: string }[] = [
  { idea: "Protection", note: "Walls, strongholds and the night watch." },
  { idea: "Community", note: "Clubs that win as one." },
  { idea: "Place", note: "A proud nod to home." },
];

export interface Fixture {
  home: ClubId;
  away: ClubId;
}

/**
 * A triple round robin by the circle method: every club meets every other
 * club home, away, then home again, three games a round, fifteen rounds.
 */
export function buildFixtures(ids: ClubId[] = clubs.map((c) => c.id)): Fixture[][] {
  const order = [...ids];
  const n = order.length;
  const first: Fixture[][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: Fixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = order[i];
      const b = order[n - 1 - i];
      // Alternate the fixed club's venue so nobody stays home all half.
      const swap = i === 0 ? r % 2 === 1 : (r + i) % 2 === 1;
      round.push(swap ? { home: b, away: a } : { home: a, away: b });
    }
    first.push(round);
    order.splice(1, 0, order.pop()!);
  }
  const second = first.map((round) => round.map((f) => ({ home: f.away, away: f.home })));
  return [...first, ...second, ...first];
}

/** Season one kicks off on Sunday 15 November 2026 at 9pm, Lagos time. */
export const KICK_OFF = new Date("2026-11-15T21:00:00+01:00");
export const GAME_MINUTES = 15;
export const CHANGEOVER_MINUTES = 5;
export const GAMES_PER_NIGHT = 9;

export interface ScheduledGame extends Fixture {
  round: number;
  /** Minutes after 9pm. */
  start: number;
}

export interface MatchNight {
  /** Midnight UTC of the Sunday, for date labels. */
  date: Date;
  games: ScheduledGame[];
}

/** "9:20 PM" for a game starting `start` minutes after 9pm. */
export function clockTime(start: number) {
  const total = 21 * 60 + start;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * Lays the rounds out over Sundays: nine games a night, 15 minutes each with
 * a 5-minute changeover. Within a night, games are ordered so no club plays
 * two in a row.
 */
export function buildSchedule(rounds: Fixture[][] = buildFixtures()): MatchNight[] {
  const nights = buildRoundOrderSchedule(rounds);
  if (nights.length <= PLAYED_NIGHTS) return nights;
  const played = nights.slice(0, PLAYED_NIGHTS);
  const later = FAIR_NIGHTS.map((games, i) => ({
    date: new Date(Date.UTC(2026, 10, 15 + (PLAYED_NIGHTS + i) * 7)),
    games: games.map(([home, away, round], k) => ({ home, away, round, start: k * (GAME_MINUTES + CHANGEOVER_MINUTES) })),
  }));
  return [...played, ...later];
}

/**
 * Sundays 2-5 in playing order (home, away, round), as fairNights() dealt
 * them: laps in order, Bulwark meeting Islanders and Sentinel on 22 Nov. Kept as a list so the page doesn't redo the search on every load;
 * rerun fairNights(rest of the pool, played Sundays) to regenerate.
 */
const FAIR_NIGHTS: [ClubId, ClubId, number][][] = [
  [["sentinel", "castellers", 5], ["coastal", "islanders", 5], ["bulwark", "citadel", 5], ["coastal", "castellers", 4], ["islanders", "bulwark", 4], ["sentinel", "citadel", 4], ["castellers", "islanders", 8], ["citadel", "coastal", 8], ["sentinel", "bulwark", 8]],
  [["citadel", "sentinel", 9], ["castellers", "coastal", 9], ["bulwark", "islanders", 9], ["castellers", "sentinel", 10], ["citadel", "bulwark", 10], ["islanders", "coastal", 10], ["citadel", "castellers", 6], ["sentinel", "islanders", 6], ["coastal", "bulwark", 6]],
  [["citadel", "islanders", 7], ["sentinel", "coastal", 7], ["bulwark", "castellers", 7], ["sentinel", "citadel", 14], ["coastal", "castellers", 14], ["islanders", "bulwark", 14], ["coastal", "citadel", 13], ["bulwark", "sentinel", 13], ["islanders", "castellers", 13]],
  [["castellers", "bulwark", 12], ["islanders", "citadel", 12], ["coastal", "sentinel", 12], ["castellers", "citadel", 11], ["bulwark", "coastal", 11], ["islanders", "sentinel", 11], ["bulwark", "citadel", 15], ["coastal", "islanders", 15], ["sentinel", "castellers", 15]],
];

/** Sundays already played with the original order; their fixture numbers (and results) stay put. */
const PLAYED_NIGHTS = 1;

/** mulberry32 with a fixed seed, so every device draws the same "random" schedule. */
function seededRand(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The most one-game rests a night can get away with. A club rests two games
 * between matches wherever possible, but with six clubs and nine games a
 * full two-game rest every time would mean the same three pairings playing
 * each other three times over, so four one-game rests a night is the floor.
 */
const SHORT_RESTS_PER_NIGHT = 4;

/**
 * One-game rests each club has across the whole season, Sunday 1 included
 * (20 in all, as the committee set them). Sunday 1 gave Castellers and
 * Islanders one each and Sentinel two; the rest come on Sundays 2-5.
 */
const SHORT_REST_CAPS: Record<ClubId, number> = { bulwark: 4, islanders: 4, coastal: 3, citadel: 3, castellers: 3, sentinel: 3 };

/**
 * A random order of a night's games in which no club plays two in a row,
 * clubs rest two games between matches except for SHORT_RESTS_PER_NIGHT
 * one-game rests (at most one per club a night, and within `shortSoFar`'s
 * season cap), the opener passes `canOpen` and the last game passes
 * `canClose`. Null if there is none.
 * Clubs also play their meetings in order (see legOf): nobody starts a
 * new lap of opponents before finishing the last, so `legSoFar` holds each
 * club's current lap. Records each club's one-game rests in `shortSoFar`
 * and laps in `legSoFar` on success.
 */
function restedOrder<G extends Fixture>(
  games: G[],
  rand: () => number,
  canOpen: (g: G) => boolean = () => true,
  shortSoFar: Map<ClubId, number> = new Map(),
  canClose: (g: G) => boolean = () => true,
  legSoFar: Map<ClubId, number> = new Map(),
): G[] | null {
  const order: G[] = [];
  const leg = new Map(legSoFar);
  const last = new Map<ClubId, number>();
  const short = new Map<ClubId, number>();
  let shortTotal = 0;
  const place = (left: G[]): boolean => {
    if (left.length === 0) return true;
    const slot = order.length;
    for (const g of shuffled(left, rand)) {
      if (slot === 0 && !canOpen(g)) continue;
      if (left.length === 1 && !canClose(g)) continue;
      const ids = [g.home, g.away];
      const gaps = ids.map((id) => (last.has(id) ? slot - last.get(id)! : Infinity));
      if (gaps.some((gap) => gap < 2)) continue;
      if (ids.some((id) => legOf(g) < (leg.get(id) ?? 1))) continue;
      const shortIds = ids.filter((_, k) => gaps[k] === 2);
      if (shortTotal + shortIds.length > SHORT_RESTS_PER_NIGHT) continue;
      if (shortIds.some((id) => (short.get(id) ?? 0) > 0 || (shortSoFar.get(id) ?? 0) >= SHORT_REST_CAPS[id])) continue;
      const prevLast = ids.map((id) => last.get(id));
      const prevLeg = ids.map((id) => leg.get(id));
      ids.forEach((id) => leg.set(id, legOf(g)));
      order.push(g);
      ids.forEach((id) => last.set(id, slot));
      shortIds.forEach((id) => short.set(id, 1));
      shortTotal += shortIds.length;
      if (place(left.filter((x) => x !== g))) return true;
      order.pop();
      ids.forEach((id, k) => (prevLeg[k] === undefined ? leg.delete(id) : leg.set(id, prevLeg[k]!)));
      ids.forEach((id, k) => (prevLast[k] === undefined ? last.delete(id) : last.set(id, prevLast[k]!)));
      shortIds.forEach((id) => short.delete(id));
      shortTotal -= shortIds.length;
    }
    return false;
  };
  if (!place(games)) return null;
  for (const [id, n] of short) shortSoFar.set(id, (shortSoFar.get(id) ?? 0) + n);
  for (const [id, l] of leg) legSoFar.set(id, l);
  return order;
}

/**
 * Which meeting of the two clubs a game is (1st, 2nd or 3rd): rounds 1-5
 * are the first lap of the round robin, 6-10 the second, 11-15 the third.
 * Every club plays everybody once before meeting anyone again.
 */
function legOf(g: Fixture & { round?: number }) {
  return Math.ceil((g.round ?? 1) / (clubs.length - 1));
}

/** Pairs that must meet on a given Sunday (1-5): Bulwark v Sentinel on 22 Nov, alongside Islanders. */
const MUST_MEET: Record<number, [ClubId, ClubId][]> = { 2: [["bulwark", "sentinel"], ["bulwark", "islanders"]] };

/** Most times a club may play the first, or the last, game of a night across the season (ten of each). */
const OPENS_PER_CLUB = 2;
const CLOSES_PER_CLUB = 2;

/** Clubs that open one particular Sunday (1-5) and no other: Bulwark's one is 13 Dec. */
const OPENER_NIGHTS: Partial<Record<ClubId, number>> = { bulwark: 5 };

/** How far apart the clubs' total games rested over the season may be. */
const REST_SPREAD = 2;

/** Per club: one-game rests, games rested, first and last games of the night. */
function nightStats(nights: MatchNight[]) {
  const stats = new Map<ClubId, { short: number; rested: number; opens: number; closes: number }>();
  for (const id of clubs.map((c) => c.id)) stats.set(id, { short: 0, rested: 0, opens: 0, closes: 0 });
  for (const night of nights) {
    const last = new Map<ClubId, number>();
    night.games.forEach((g, k) => {
      for (const id of [g.home, g.away]) {
        const s = stats.get(id)!;
        if (last.has(id)) {
          s.rested += k - last.get(id)! - 1;
          if (k - last.get(id)! === 2) s.short++;
        }
        if (k === 0) s.opens++;
        if (k === night.games.length - 1) s.closes++;
        last.set(id, k);
      }
    });
  }
  return stats;
}

/**
 * The Sundays after the played ones, fully random: every remaining game goes
 * into one pool and is dealt onto a random Sunday in a random slot, then
 * the season is kept only if it is fair. The rules, counting the played
 * Sundays too: every club plays everybody once before meeting anyone again
 * (laps, see legOf), MUST_MEET pairs meet on their Sunday, each club plays three games a night, two clubs meet at most
 * once a night, nobody plays two in a row, clubs rest two games between
 * matches bar the one-game rests SHORT_REST_CAPS sets,
 * nobody opens or closes a night more than twice, the clubs' total rest is within REST_SPREAD games and Castellers get
 * as much rest as anyone. Home and away are kept as drawn.
 */
export function fairNights(pool: ScheduledGame[], played: MatchNight[]): MatchNight[] {
  const offset = played.length;
  const rand = seededRand(20261116);
  const perClub = (GAMES_PER_NIGHT * 2) / clubs.length;
  const pair = (g: Fixture) => [g.home, g.away].sort().join();
  const before = nightStats(played);
  for (;;) {
    let left = shuffled(pool, rand);
    const nights: MatchNight[] = [];
    const opened = new Map<ClubId, number>([...before].map(([id, s]) => [id, s.opens]));
    const closed = new Map<ClubId, number>([...before].map(([id, s]) => [id, s.closes]));
    const shortRests = new Map<ClubId, number>([...before].map(([id, s]) => [id, s.short]));
    const legs = new Map<ClubId, number>(clubs.map((c) => [c.id, Math.max(1, ...played.flatMap((n) => n.games).filter((g) => g.home === c.id || g.away === c.id).map(legOf))]));
    const canOpen = (night: number) => (g: Fixture) => {
      const ids = [g.home, g.away];
      const fixed = (Object.keys(OPENER_NIGHTS) as ClubId[]).filter((id) => OPENER_NIGHTS[id] === night);
      return (
        ids.every((id) => (opened.get(id) ?? 0) < OPENS_PER_CLUB) &&
        ids.every((id) => OPENER_NIGHTS[id] === undefined || OPENER_NIGHTS[id] === night) &&
        fixed.every((id) => ids.includes(id))
      );
    };
    const canClose = (g: Fixture) =>
      [g.home, g.away].every((id) => (closed.get(id) ?? 0) < CLOSES_PER_CLUB);
    while (left.length > 0) {
      // Earlier laps first, then the pairs that must meet tonight, so the deal can keep laps in order.
      const must = (MUST_MEET[offset + nights.length + 1] ?? []).map((p) => [...p].sort().join());
      const rank = (g: ScheduledGame) => (legOf(g) === 1 ? 0 : must.includes(pair(g)) ? 1 : 1 + legOf(g));
      left = [...left].sort((a, b) => rank(a) - rank(b));
      const count = new Map<ClubId, number>();
      const pairs = new Set<string>();
      const games: ScheduledGame[] = [];
      const skipped: ScheduledGame[] = [];
      for (const g of left) {
        const fits =
          games.length < GAMES_PER_NIGHT &&
          (count.get(g.home) ?? 0) < perClub &&
          (count.get(g.away) ?? 0) < perClub &&
          !pairs.has(pair(g));
        if (!fits) { skipped.push(g); continue; }
        games.push(g);
        pairs.add(pair(g));
        count.set(g.home, (count.get(g.home) ?? 0) + 1);
        count.set(g.away, (count.get(g.away) ?? 0) + 1);
      }
      const dealt = games.length === Math.min(GAMES_PER_NIGHT, left.length)
        ? (must.every((p) => games.some((g) => pair(g) === p)) ? restedOrder(games, rand, canOpen(offset + nights.length + 1), shortRests, canClose, legs) : null)
        : null;
      if (!dealt) break;
      for (const id of [dealt[0].home, dealt[0].away]) opened.set(id, (opened.get(id) ?? 0) + 1);
      const end = dealt[dealt.length - 1];
      for (const id of [end.home, end.away]) closed.set(id, (closed.get(id) ?? 0) + 1);
      const n = offset + nights.length;
      nights.push({
        date: new Date(Date.UTC(2026, 10, 15 + n * 7)),
        games: dealt.map((g, k) => ({ ...g, start: k * (GAME_MINUTES + CHANGEOVER_MINUTES) })),
      });
      left = skipped;
    }
    if (left.length > 0) continue;
    const rested = [...nightStats([...played, ...nights]).values()].map((s) => s.rested);
    const castellers = nightStats([...played, ...nights]).get("castellers")!.rested;
    if (Math.max(...rested) - Math.min(...rested) <= REST_SPREAD && castellers === Math.max(...rested)) return nights;
  }
}

/** The original layout: rounds in order, nine games a night. */
function buildRoundOrderSchedule(rounds: Fixture[][]): MatchNight[] {
  const queue = rounds.flatMap((round, r) => round.map((f) => ({ ...f, round: r + 1 })));
  const nights: MatchNight[] = [];
  for (let n = 0; queue.length > 0; n++) {
    const date = new Date(Date.UTC(2026, 10, 15 + n * 7));
    const games: ScheduledGame[] = [];
    while (games.length < GAMES_PER_NIGHT && queue.length > 0) {
      const prev = games[games.length - 1];
      const round = queue[0].round;
      // Among the games left in this round, pick one that rests the last game's clubs.
      let pick = queue.findIndex(
        (g) => g.round === round && (!prev || ![prev.home, prev.away].some((id) => id === g.home || id === g.away)),
      );
      if (pick < 0) pick = 0;
      const [g] = queue.splice(pick, 1);
      games.push({ ...g, start: games.length * (GAME_MINUTES + CHANGEOVER_MINUTES) });
    }
    nights.push({ date, games });
  }
  return nights;
}
