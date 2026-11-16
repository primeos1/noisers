// The league rating: a rating for league games only. Everyone starts the
// league on 6.00 and moves after each Sunday by the same rules (and the
// club's same weights) as the normal Noisers rating — see backend
// PlayerRatings. It is worked out here from the public results and never
// stored, so it can't touch anyone's Noisers rating, and FNL prices keep
// using the frozen draw rating.

import { GAMES, type LeagueData } from "./data";
import type { DrawResult, Position } from "./draw";

export const LEAGUE_RATING_START = 6.0;
const MIN = 4.0;
const MAX = 9.5;

export interface RatingWeights {
  /** Per position; penalties already negative. */
  positions: Record<Position, Record<string, number>>;
  max_swing: number;
}

/** Fallback if the API doesn't send weights: PlayerRatings' defaults. */
const base = { win: 0.1, loss: -0.1, goal: 0.12, assist: 0.08, own_goal: -0.08, goal_conceded: 0, save: 0.03, penalty_save: 0.1, yellow_card: -0.05, red_card: -0.15, penalty_miss: -0.3 };
const DEFAULT_WEIGHTS: RatingWeights = {
  positions: {
    GK: { ...base, clean_sheet: 0.15 },
    DEF: { ...base, clean_sheet: 0.12 },
    MID: { ...base, clean_sheet: 0 },
    FWD: { ...base, clean_sheet: 0 },
  },
  max_swing: 0.5,
};

export interface RatingNight {
  night: number;
  before: number;
  after: number;
}

export interface LeagueRating {
  rating: number;
  /** How far the last Sunday they played moved it. */
  change: number;
  /** One entry per Sunday they played a finished game. */
  nights: RatingNight[];
}

/** PlayerRatings::adjust: gains shrink near the ceiling, losses near the floor, capped per Sunday. */
function adjust(rating: number, raw: number, maxSwing: number) {
  const room = raw >= 0 ? MAX - rating : rating - MIN;
  const factor = Math.max(0, Math.min(1.5, (2 * room) / (MAX - MIN)));
  const delta = Math.max(-maxSwing, Math.min(maxSwing, raw * factor));
  return Math.round(Math.max(MIN, Math.min(MAX, rating + delta)) * 100) / 100;
}

/**
 * Every drawn player's league rating. A Sunday counts its finished games
 * so far, so ratings move as each game ends. A game recorded before
 * line-ups were kept counts the whole squad as having played.
 */
export function leagueRatings(draw: DrawResult, data: LeagueData): Map<number, LeagueRating> {
  const weights = data.ratingWeights ?? DEFAULT_WEIGHTS;
  const results = new Map(data.results.map((r) => [r.matchNo, r]));
  const out = new Map<number, LeagueRating>();
  const position = new Map<number, Position>();
  for (const squad of Object.values(draw.squads)) {
    for (const p of squad) {
      position.set(p.id, p.position);
      out.set(p.id, { rating: LEAGUE_RATING_START, change: 0, nights: [] });
    }
  }

  for (let night = 1; night <= 5; night++) {
    const points = new Map<number, number>();
    const add = (id: number | null | undefined, key: string | null, times = 1) => {
      const pos = id != null ? position.get(id) : undefined;
      if (!pos) return;
      const amount = key ? (weights.positions[pos]?.[key] ?? 0) : 0;
      points.set(id!, (points.get(id!) ?? 0) + amount * times);
    };

    for (const g of GAMES) {
      if (g.night !== night) continue;
      const r = results.get(g.no);
      if (r?.status !== "final") continue;
      const goals = data.goals.filter((x) => x.matchNo === g.no);

      for (const [club, home] of [[g.home, true], [g.away, false]] as const) {
        const scored = home ? r.homeScore : r.awayScore;
        const against = home ? r.awayScore : r.homeScore;
        const result = scored > against ? "win" : scored < against ? "loss" : null;
        for (const p of draw.squads[club] ?? []) {
          if (r.events && !r.events.appeared.includes(p.id)) continue;
          add(p.id, result);
          add(p.id, against === 0 ? "clean_sheet" : "goal_conceded", Math.max(1, against));
        }
      }
      for (const goal of goals) {
        add(goal.playerId, goal.ownGoal ? "own_goal" : "goal");
        if (!goal.ownGoal) add(goal.assistPlayerId, "assist");
      }
      for (const [id, n] of Object.entries(r.saves ?? {})) {
        const pens = r.events?.penaltySaves?.[id] ?? 0;
        add(Number(id), "save", Math.max(0, n - pens));
        add(Number(id), "penalty_save", pens);
      }
      for (const c of r.events?.cards ?? []) add(c.playerId, c.type === "red" ? "red_card" : "yellow_card");
      for (const id of r.events?.penaltyMisses ?? []) add(id, "penalty_miss");
    }

    for (const [id, raw] of points) {
      const line = out.get(id)!;
      const before = line.rating;
      line.rating = adjust(before, raw, weights.max_swing);
      line.change = Math.round((line.rating - before) * 100) / 100;
      line.nights.push({ night, before, after: line.rating });
    }
  }
  return out;
}

/** "+0.12", "−0.05", or "" for no change. */
export function fmtChange(change: number) {
  if (Math.abs(change) < 0.005) return "";
  return `${change > 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}`;
}
