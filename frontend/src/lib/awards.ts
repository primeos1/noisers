// The Awards race — every honour replayed match day by match day, worked out
// from the ended match days and squad ratings the app already loads. Player
// of the week follows the server's rule (MatchDayFinalizer::computeTeamOfWeek):
// the highest-rated player of the week, with the club's rating weights added
// up across its match days; ties go to more goal involvements, then saves,
// then games. The flop of the week follows MatchDayFinalizer::computeFlopPlayer:
// most games lost, then worst goal difference, then fewest goal involvements —
// there's always one.

import { keepsCleanSheets, type Player, type Position } from "./clubData";
import type { MatchDayEvent } from "./matchDay";
import { RATING_PENALTIES, type PositionWeights, type RatingWeightKey } from "./SettingsContext";

interface Line {
  games: number;
  wins: number;
  losses: number;
  /** Goal difference on the pitch. */
  gd: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  saves: number;
  yellows: number;
  reds: number;
}

const emptyLine = (): Line => ({ games: 0, wins: 0, losses: 0, gd: 0, goals: 0, assists: 0, cleanSheets: 0, saves: 0, yellows: 0, reds: 0 });

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
      const lost = score[i] < score[1 - i];
      const cleanSheet = score[1 - i] === 0;
      for (const id of team.players) {
        const l = line(id);
        if (!l) continue;
        l.games++;
        if (won) l.wins++;
        if (lost) l.losses++;
        l.gd += score[i] - score[1 - i];
        // Midfielders and forwards don't keep clean sheets — main position decides.
        if (cleanSheet && keepsCleanSheets(squad.get(id as number)!)) l.cleanSheets++;
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

/**
 * Raw rating points per squad player for one match day's finished games —
 * mirrors PlayerRatings::points(): the main position picks the weights,
 * penalties count against, and midfielders and forwards never score clean
 * sheets. Everyone who played has an entry, even on zero.
 */
function dayPoints(event: MatchDayEvent, squad: Map<number, Player>, weights: Record<Position, PositionWeights>): Map<number, number> {
  const points = new Map<number, number>();
  const add = (id: unknown, key: RatingWeightKey | null, times = 1) => {
    const position = typeof id === "number" ? squad.get(id)?.position : undefined;
    if (!position || !weights[position]) return;
    let amount = key === null ? 0 : Math.abs(weights[position][key] ?? 0);
    if (key === "cleanSheet" && !keepsCleanSheets({ position })) amount = 0;
    if (key && RATING_PENALTIES.includes(key)) amount = -amount;
    points.set(id as number, (points.get(id as number) ?? 0) + amount * times);
  };

  for (const game of event.games) {
    if (game.status !== "finished") continue;
    const score = [0, 0];
    for (const goal of game.goals) score[goal.teamIndex === 1 ? 1 : 0]++;
    game.teams.slice(0, 2).forEach((team, i) => {
      const against = score[1 - i];
      const result = score[i] > against ? "win" : score[i] < against ? "loss" : null;
      for (const id of team.players) {
        add(id, result);
        add(id, against === 0 ? "cleanSheet" : "goalConceded", Math.max(1, against));
      }
    });
    for (const goal of game.goals) {
      add(goal.playerId, goal.ownGoal ? "ownGoal" : "goal");
      add(goal.assistPlayerId, "assist");
    }
    for (const card of game.cards) add(card.playerId, card.type === "red" ? "redCard" : "yellowCard");
    for (const save of game.saves ?? []) add(save.playerId, save.penalty ? "penaltySave" : "save");
  }
  return points;
}

/** The highest-rated player — ties go to more goal involvements, then saves, then games, then the lower id. */
function topRated(points: Map<number, number>, lines: Map<number, Line>): number | null {
  const key = (id: number) => {
    const l = lines.get(id) ?? emptyLine();
    return [Math.round(points.get(id)! * 1e4) / 1e4, l.goals + l.assists, l.saves, l.games];
  };
  let best: number | null = null;
  for (const id of points.keys()) {
    if (best === null) {
      best = id;
      continue;
    }
    const a = key(id);
    const b = key(best);
    const i = a.findIndex((v, k) => v !== b[k]);
    if ((i !== -1 && a[i] > b[i]) || (i === -1 && id < best)) best = id;
  }
  return best;
}

export interface WeeklyWinner {
  /** The week's latest match day so far. */
  day: number;
  event: MatchDayEvent;
  playerId: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  games: number;
}

export interface WeeklyFlop {
  day: number;
  event: MatchDayEvent;
  playerId: number;
  games: number;
  losses: number;
  gd: number;
  involvements: number;
}

function flopOfTheDay(lines: Map<number, Line>): [number, Line] | null {
  let worst: [number, Line] | null = null;
  const key = (l: Line) => [l.losses, -l.gd, -(l.goals + l.assists)];
  for (const entry of lines) {
    if (entry[1].games === 0) continue;
    if (!worst) {
      worst = entry;
      continue;
    }
    const k = key(entry[1]);
    const w = key(worst[1]);
    if (k[0] > w[0] || (k[0] === w[0] && (k[1] > w[1] || (k[1] === w[1] && k[2] > w[2])))) worst = entry;
  }
  return worst;
}

/** What a race's value function sees for one player after a given match day. */
export interface Tally extends Line {
  potw: number;
  flops: number;
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
  | "hot-head"
  | "flop";

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
  { id: "potw", award: "Player of the Week", stat: "Weekly wins", blurb: "Most weeks as the top-rated player.", unit: "wins", value: (t) => t.potw, format: whole },
  { id: "playmaker", award: "Playmaker", stat: "Assists", blurb: "The one who makes everyone else look good.", unit: "assists", value: (t) => t.assists, format: whole },
  { id: "talisman", award: "Talisman", stat: "Goals + assists", blurb: "Most goal involvements, scored or set up.", unit: "G+A", value: (t) => t.goals + t.assists, format: whole },
  { id: "golden-glove", award: "Golden Glove", stat: "Saves", blurb: "The safest pair of hands between the sticks.", unit: "saves", value: (t) => t.saves, format: whole },
  { id: "brick-wall", award: "Brick Wall", stat: "Clean sheets", blurb: "Games finished without conceding.", unit: "clean sheets", value: (t) => t.cleanSheets, format: whole },
  { id: "serial-winner", award: "Serial Winner", stat: "Games won", blurb: "Whoever's team it is, they end up winning.", unit: "wins", value: (t) => t.wins, format: whole },
  { id: "ironman", award: "Ironman", stat: "Games played", blurb: "Never misses a game.", unit: "games", value: (t) => t.games, format: whole },
  { id: "climber", award: "The Climber", stat: "Rating gained", blurb: "Biggest rise since their first rated match day.", unit: "rating", value: (t) => t.climb, format: (v) => `+${v.toFixed(2)}` },
  { id: "hat-tricks", award: "Hat-trick Hero", stat: "Hat-trick days", blurb: "Match days with three goals or more.", unit: "hat-tricks", value: (t) => t.hatTricks, format: whole },
  { id: "flop", award: "Flop of the Week", stat: "Weekly flops", blurb: "Most match days as the week's biggest letdown.", unit: "flops", value: (t) => t.flops, format: whole },
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
  flops: WeeklyFlop[];
}

/** Ended match days with at least one finished game, oldest first. */
export function awardDays(events: MatchDayEvent[]) {
  return events
    .filter((e) => e.status === "ended" && e.games.some((g) => g.status === "finished"))
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

export function buildAwards(players: Player[], events: MatchDayEvent[], weights: Record<Position, PositionWeights>): AwardsData {
  const squad = new Map(players.map((p) => [p.id, p]));
  const days = awardDays(events);
  const totals = new Map<number, Tally>();
  const winners: WeeklyWinner[] = [];
  // Each week's points and numbers so far, and who leads it.
  const weeks = new Map<string, { points: Map<number, number>; lines: Map<number, Line>; winner: WeeklyWinner | null }>();
  const flops: WeeklyFlop[] = [];
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
        t = { ...emptyLine(), potw: 0, flops: 0, hatTricks: 0, rating: history[0]?.before ?? squad.get(id)!.rating, climb: null };
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

    // Player of the week: the week's leader so far, which a later match day
    // of the same week can overturn.
    const weekKey = event.week ? `week-${event.week}` : event.id;
    let week = weeks.get(weekKey);
    if (!week) weeks.set(weekKey, (week = { points: new Map(), lines: new Map(), winner: null }));
    for (const [id, p] of dayPoints(event, squad, weights)) week.points.set(id, (week.points.get(id) ?? 0) + p);
    for (const [id, l] of lines) {
      const sum = week.lines.get(id) ?? emptyLine();
      for (const k of Object.keys(l) as (keyof Line)[]) sum[k] += l[k];
      week.lines.set(id, sum);
    }
    const leader = topRated(week.points, week.lines);
    if (week.winner) {
      totals.get(week.winner.playerId)!.potw--;
      winners.splice(winners.indexOf(week.winner), 1);
      week.winner = null;
    }
    if (leader !== null && totals.has(leader)) {
      const l = week.lines.get(leader) ?? emptyLine();
      week.winner = { day, event, playerId: leader, goals: l.goals, assists: l.assists, cleanSheets: l.cleanSheets, games: l.games };
      totals.get(leader)!.potw++;
      winners.push(week.winner);
    }

    const worst = flopOfTheDay(lines);
    if (worst) {
      const [playerId, l] = worst;
      totals.get(playerId)!.flops++;
      flops.push({ day, event, playerId, games: l.games, losses: l.losses, gd: l.gd, involvements: l.goals + l.assists });
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

  return { days, races, winners, flops };
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
