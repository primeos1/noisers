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
