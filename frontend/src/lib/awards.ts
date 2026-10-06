// The Awards race — every honour replayed match day by match day, worked out
// from the ended match days and squad ratings the app already loads. Player
// of the week follows the server's rule (MatchDayFinalizer::computePlayerOfTheDay):
// most goal involvements, then goals, then clean sheets.

import type { Player } from "./clubData";
import type { MatchDayEvent } from "./matchDay";

interface Line {
  games: number;
  wins: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  saves: number;
  yellows: number;
  reds: number;
}

const emptyLine = (): Line => ({ games: 0, wins: 0, goals: 0, assists: 0, cleanSheets: 0, saves: 0, yellows: 0, reds: 0 });

/** One match day's numbers per squad player (finished games only, as on the server). */
function dayLines(event: MatchDayEvent, squad: Map<number, Player>): Map<number, Line> {
  const lines = new Map<number, Line>();
  const line = (id: unknown) => {
    if (typeof id !== "number" || !squad.has(id)) return null;
    let l = lines.get(id);
    if (!l) lines.set(id, (l = emptyLine()));
    return l;
  };

  for (const game of event.games) {
    if (game.status !== "finished") continue;
    const score = [0, 0];
    for (const goal of game.goals) score[goal.teamIndex === 1 ? 1 : 0]++;

    game.teams.forEach((team, i) => {
      const won = score[i] > score[1 - i];
      const cleanSheet = score[1 - i] === 0;
      for (const id of team.players) {
        const l = line(id);
        if (!l) continue;
        l.games++;
        if (won) l.wins++;
        // Forwards don't keep clean sheets — main position decides.
        if (cleanSheet && squad.get(id as number)!.position !== "FWD") l.cleanSheets++;
      }
    });
    for (const goal of game.goals) {
      const scorer = goal.ownGoal ? null : line(goal.playerId);
      if (scorer) scorer.goals++;
      const assister = line(goal.assistPlayerId);
      if (assister) assister.assists++;
    }
    for (const card of game.cards) {
      const l = line(card.playerId);
      if (l) l[card.type === "red" ? "reds" : "yellows"]++;
    }
    for (const save of game.saves ?? []) {
      const l = line(save.playerId);
      if (l) l.saves++;
    }
  }
  return lines;
}

export interface WeeklyWinner {
  day: number;
  event: MatchDayEvent;
  playerId: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  games: number;
}

function playerOfTheDay(lines: Map<number, Line>): [number, Line] | null {
  let best: [number, Line] | null = null;
  const key = (l: Line) => [l.goals + l.assists, l.goals, l.cleanSheets];
  for (const entry of lines) {
    const k = key(entry[1]);
    if (k[0] + k[2] === 0) continue;
    if (!best) {
      best = entry;
      continue;
    }
    const b = key(best[1]);
    if (k[0] > b[0] || (k[0] === b[0] && (k[1] > b[1] || (k[1] === b[1] && k[2] > b[2])))) best = entry;
  }
  return best;
}

/** What a race's value function sees for one player after a given match day. */
export interface Tally extends Line {
  potw: number;
  hatTricks: number;
  /** Null until the player has played. */
  rating: number | null;
  /** Rating gained since their first rated match day. */
  climb: number | null;
}

export type CategoryId =
  | "golden-boot"
  | "playmaker"
  | "talisman"
  | "top-rated"
  | "potw"
  | "golden-glove"
  | "brick-wall"
  | "ironman"
  | "serial-winner"
  | "climber"
  | "hat-tricks"
  | "hot-head";

export interface Category {
  id: CategoryId;
  award: string;
  /** What's being counted, for the race heading. */
  stat: string;
  blurb: string;
  unit: string;
  value: (t: Tally) => number | null;
  format: (v: number) => string;
  /** Ratings sit close together, so their bars are drawn from the lowest value up. */
  spread?: boolean;
}

const whole = (v: number) => String(v);

export const categories: Category[] = [
  { id: "golden-boot", award: "Golden Boot", stat: "Goals", blurb: "The squad's deadliest finisher.", unit: "goals", value: (t) => t.goals, format: whole },
  { id: "top-rated", award: "Top Rated", stat: "Rating", blurb: "Highest player rating, moved by every match day.", unit: "rating", value: (t) => t.rating, format: (v) => v.toFixed(2), spread: true },
  { id: "potw", award: "Player of the Week", stat: "Weekly wins", blurb: "Most match days as the standout performer.", unit: "wins", value: (t) => t.potw, format: whole },
  { id: "playmaker", award: "Playmaker", stat: "Assists", blurb: "The one who makes everyone else look good.", unit: "assists", value: (t) => t.assists, format: whole },
  { id: "talisman", award: "Talisman", stat: "Goals + assists", blurb: "Most goal involvements, scored or set up.", unit: "G+A", value: (t) => t.goals + t.assists, format: whole },
  { id: "golden-glove", award: "Golden Glove", stat: "Saves", blurb: "The safest pair of hands between the sticks.", unit: "saves", value: (t) => t.saves, format: whole },
  { id: "brick-wall", award: "Brick Wall", stat: "Clean sheets", blurb: "Games finished without conceding.", unit: "clean sheets", value: (t) => t.cleanSheets, format: whole },
  { id: "serial-winner", award: "Serial Winner", stat: "Games won", blurb: "Whoever's team it is, they end up winning.", unit: "wins", value: (t) => t.wins, format: whole },
  { id: "ironman", award: "Ironman", stat: "Games played", blurb: "Never misses a game.", unit: "games", value: (t) => t.games, format: whole },
  { id: "climber", award: "The Climber", stat: "Rating gained", blurb: "Biggest rise since their first rated match day.", unit: "rating", value: (t) => t.climb, format: (v) => `+${v.toFixed(2)}` },
  { id: "hat-tricks", award: "Hat-trick Hero", stat: "Hat-trick days", blurb: "Match days with three goals or more.", unit: "hat-tricks", value: (t) => t.hatTricks, format: whole },
  { id: "hot-head", award: "Hot Head", stat: "Cards", blurb: "The one the referee knows by name.", unit: "cards", value: (t) => t.yellows + t.reds, format: whole },
];

export interface Standing {
  playerId: number;
  value: number;
}

export interface Reign {
  playerId: number;
  /** Match day indexes, inclusive. */
  from: number;
  to: number;
  /** Who took the top spot from them — null while they still hold it. */
  endedBy: number | null;
}

export interface Race {
  category: Category;
  /** Standings after each match day, leader first. */
  frames: Standing[][];
  reigns: Reign[];
}

export interface AwardsData {
  days: MatchDayEvent[];
  races: Race[];
  winners: WeeklyWinner[];
}

/** Ended match days with at least one finished game, oldest first. */
export function awardDays(events: MatchDayEvent[]) {
  return events
    .filter((e) => e.status === "ended" && e.games.some((g) => g.status === "finished"))
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

export function buildAwards(players: Player[], events: MatchDayEvent[]): AwardsData {
  const squad = new Map(players.map((p) => [p.id, p]));
  const days = awardDays(events);
  const totals = new Map<number, Tally>();
  const winners: WeeklyWinner[] = [];
  const frames = new Map<CategoryId, Standing[][]>(categories.map((c) => [c.id, []]));

  // Rating after each match day the player was rated in.
  const ratedAfter = new Map<number, Map<string, number>>();
  for (const p of players) ratedAfter.set(p.id, new Map((p.ratingHistory ?? []).map((h) => [h.eventId, h.after])));

  days.forEach((event, day) => {
    const lines = dayLines(event, squad);

    for (const [id, l] of lines) {
      let t = totals.get(id);
      if (!t) {
        const history = squad.get(id)!.ratingHistory ?? [];
        t = { ...emptyLine(), potw: 0, hatTricks: 0, rating: history[0]?.before ?? squad.get(id)!.rating, climb: null };
        totals.set(id, t);
      }
      for (const k of Object.keys(l) as (keyof Line)[]) t[k] += l[k];
      if (l.goals >= 3) t.hatTricks++;
    }

    for (const [id, t] of totals) {
      const after = ratedAfter.get(id)?.get(event.id);
      if (after === undefined) continue;
      t.rating = after;
      const first = squad.get(id)!.ratingHistory![0].before;
      t.climb = Math.round((after - first) * 100) / 100;
    }

    const best = playerOfTheDay(lines);
    if (best) {
      const [playerId, l] = best;
      totals.get(playerId)!.potw++;
      winners.push({ day, event, playerId, goals: l.goals, assists: l.assists, cleanSheets: l.cleanSheets, games: l.games });
    }

    for (const category of categories) {
      const list = frames.get(category.id)!;
      const previous = list[day - 1] ?? [];
      const prevRank = new Map(previous.map((s, i) => [s.playerId, i]));
      const standings: Standing[] = [];
      for (const [playerId, t] of totals) {
        const value = category.value(t);
        if (value !== null && (category.spread || value > 0)) standings.push({ playerId, value });
      }
      // A tie doesn't dethrone anyone: the earlier holder of a place keeps it.
      standings.sort(
        (a, b) =>
          b.value - a.value ||
          (prevRank.get(a.playerId) ?? Infinity) - (prevRank.get(b.playerId) ?? Infinity) ||
          squad.get(a.playerId)!.name.localeCompare(squad.get(b.playerId)!.name),
      );
      list.push(standings);
    }
  });

  const races = categories.map((category) => {
    const list = frames.get(category.id)!;
    const reigns: Reign[] = [];
    list.forEach((standings, day) => {
      const leader = standings[0]?.playerId;
      const current = reigns[reigns.length - 1];
      if (leader === undefined) return;
      if (current && current.playerId === leader && current.to === day - 1) {
        current.to = day;
        return;
      }
      if (current && current.endedBy === null) current.endedBy = leader;
      reigns.push({ playerId: leader, from: day, to: day, endedBy: null });
    });
    return { category, frames: list, reigns };
  });

  return { days, races, winners };
}

/** Totals per player across a race's reigns at the top. */
export function reignSummary(race: Race) {
  const byPlayer = new Map<number, { playerId: number; reigns: number; days: number }>();
  for (const r of race.reigns) {
    const s = byPlayer.get(r.playerId) ?? { playerId: r.playerId, reigns: 0, days: 0 };
    s.reigns++;
    s.days += r.to - r.from + 1;
    byPlayer.set(r.playerId, s);
  }
  return [...byPlayer.values()].sort((a, b) => b.days - a.days || b.reigns - a.reigns);
}
