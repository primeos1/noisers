// "Insights" for the player portal — the personal numbers that change after
// every match day (rank, streaks, partnerships, milestones, badges), worked
// out from the match days and squad the portal already has loaded.

import type { Player } from "./clubData";
import type { MatchDayEvent } from "./matchDay";
import { playerGameLog, type GameLogEntry } from "./portal";

export interface Partner {
  player: Player;
  games: number;
  wins: number;
}

export interface Milestone {
  label: string;
  target: number;
  current: number;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  earned: boolean;
}

export interface PlayerInsights {
  squadSize: number;
  rank: { rating: number; goals: number; assists: number };
  /** Movement at the most recent match day this player was rated in. */
  lastMove: { delta: number; event: MatchDayEvent | null } | null;
  /** Rating after each rated match day, oldest first, starting from the first "before". */
  ratingJourney: number[];
  peakRating: number;
  unbeatenRun: number;
  winRun: number;
  longestWinRun: number;
  scoringRun: number;
  bookingFreeGames: number;
  winRate: number | null;
  bestDay: { event: MatchDayEvent; goals: number; assists: number } | null;
  bestPartner: Partner | null;
  connection: { player: Player; count: number } | null;
  nemesis: { player: Player; losses: number } | null;
  earliestGoal: number | null;
  milestones: Milestone[];
  badges: Badge[];
}

/** 1-based position when sorted by a stat, highest first — ties share a rank. */
function rankBy(players: Player[], me: Player, value: (p: Player) => number) {
  return players.filter((p) => value(p) > value(me)).length + 1;
}

/** Oldest game first. */
function chronological(log: GameLogEntry[]) {
  return [...log].sort(
    (a, b) => (a.event.createdAt ?? "").localeCompare(b.event.createdAt ?? "") || a.gameNumber - b.gameNumber,
  );
}

/** Games at the end of the list for which the test holds, counted backwards. */
function runFromEnd<T>(items: T[], test: (item: T) => boolean) {
  let n = 0;
  for (let i = items.length - 1; i >= 0 && test(items[i]); i--) n++;
  return n;
}

const GOAL_STEPS = [1, 5, 10, 25, 50, 100, 200];
const APP_STEPS = [10, 25, 50, 100, 200];

function nextStep(steps: number[], current: number) {
  return steps.find((s) => s > current) ?? null;
}

export function playerInsights(player: Player, players: Player[], events: MatchDayEvent[]): PlayerInsights {
  const me = player.id;
  const byId = new Map(players.map((p) => [p.id, p]));
  const games = chronological(playerGameLog(events, me));
  const finished = games.filter((g) => g.result !== null);

  // Streaks over finished games, most recent at the end.
  const unbeatenRun = runFromEnd(finished, (g) => g.result !== "L");
  const winRun = runFromEnd(finished, (g) => g.result === "W");
  let longestWinRun = 0;
  let run = 0;
  for (const g of finished) {
    run = g.result === "W" ? run + 1 : 0;
    longestWinRun = Math.max(longestWinRun, run);
  }
  const bookingFreeGames = runFromEnd(games, (g) => g.yellows + g.reds === 0);
  let longestBookingFree = 0;
  run = 0;
  for (const g of games) {
    run = g.yellows + g.reds === 0 ? run + 1 : 0;
    longestBookingFree = Math.max(longestBookingFree, run);
  }

  // Per match day totals, oldest first.
  const days = new Map<string, { event: MatchDayEvent; goals: number; assists: number }>();
  for (const g of games) {
    const d = days.get(g.event.id) ?? { event: g.event, goals: 0, assists: 0 };
    d.goals += g.goals;
    d.assists += g.assists;
    days.set(g.event.id, d);
  }
  const dayList = [...days.values()];
  const scoringRun = runFromEnd(dayList, (d) => d.goals > 0);
  const bestDay =
    dayList
      .filter((d) => d.goals + d.assists > 0)
      .sort((a, b) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals)[0] ?? null;

  // Teammates and opponents across finished games.
  const withTeammate = new Map<number, { games: number; wins: number }>();
  const lostTo = new Map<number, number>();
  for (const g of finished) {
    for (const id of g.game.teams[g.teamIndex].players) {
      if (typeof id !== "number" || id === me) continue;
      const t = withTeammate.get(id) ?? { games: 0, wins: 0 };
      t.games++;
      if (g.result === "W") t.wins++;
      withTeammate.set(id, t);
    }
    if (g.result === "L") {
      for (const id of g.game.teams[g.teamIndex === 0 ? 1 : 0].players) {
        if (typeof id === "number") lostTo.set(id, (lostTo.get(id) ?? 0) + 1);
      }
    }
  }

  let bestPartner: Partner | null = null;
  for (const [id, t] of withTeammate) {
    const p = byId.get(id);
    if (!p || t.games < 3) continue;
    const better =
      !bestPartner ||
      t.wins / t.games > bestPartner.wins / bestPartner.games ||
      (t.wins / t.games === bestPartner.wins / bestPartner.games && t.games > bestPartner.games);
    if (better) bestPartner = { player: p, ...t };
  }

  let nemesis: PlayerInsights["nemesis"] = null;
  for (const [id, losses] of lostTo) {
    const p = byId.get(id);
    if (p && losses >= 2 && (!nemesis || losses > nemesis.losses)) nemesis = { player: p, losses };
  }

  // Goal connections, both directions: who sets you up, and who you set up.
  const links = new Map<number, number>();
  let earliestGoal: number | null = null;
  for (const g of games) {
    for (const goal of g.game.goals) {
      if (goal.ownGoal) continue;
      if (goal.playerId === me) {
        earliestGoal = earliestGoal === null ? goal.minute : Math.min(earliestGoal, goal.minute);
        if (typeof goal.assistPlayerId === "number") links.set(goal.assistPlayerId, (links.get(goal.assistPlayerId) ?? 0) + 1);
      } else if (goal.assistPlayerId === me && typeof goal.playerId === "number") {
        links.set(goal.playerId, (links.get(goal.playerId) ?? 0) + 1);
      }
    }
  }
  let connection: PlayerInsights["connection"] = null;
  for (const [id, count] of links) {
    const p = byId.get(id);
    if (p && (!connection || count > connection.count)) connection = { player: p, count };
  }

  // Rating history from the API — ids line up with match day events.
  const history = player.ratingHistory ?? [];
  const last = history[history.length - 1];
  const lastMove = last
    ? { delta: Math.round((last.after - last.before) * 100) / 100, event: events.find((e) => e.id === last.eventId) ?? null }
    : null;
  const ratingJourney = history.length ? [history[0].before, ...history.map((h) => h.after)] : [player.rating];
  const peakRating = Math.max(...ratingJourney, player.rating);

  const milestones: Milestone[] = [];
  const goalStep = nextStep(GOAL_STEPS, player.goals);
  if (goalStep) milestones.push({ label: goalStep === 1 ? "First goal" : `${goalStep} goals`, target: goalStep, current: player.goals });
  const assistStep = nextStep(GOAL_STEPS, player.assists);
  if (assistStep) milestones.push({ label: assistStep === 1 ? "First assist" : `${assistStep} assists`, target: assistStep, current: player.assists });
  const appStep = nextStep(APP_STEPS, player.appearances);
  if (appStep) milestones.push({ label: `${appStep} games`, target: appStep, current: player.appearances });
  milestones.sort((a, b) => (a.target - a.current) / a.target - (b.target - b.current) / b.target);

  const rank = {
    rating: rankBy(players, player, (p) => p.rating),
    goals: rankBy(players, player, (p) => p.goals),
    assists: rankBy(players, player, (p) => p.assists),
  };
  const maxDayGoals = Math.max(0, ...dayList.map((d) => d.goals));
  const maxDayAssists = Math.max(0, ...dayList.map((d) => d.assists));

  const badges: Badge[] = [
    { id: "first-goal", title: "Off the mark", description: "Score your first goal", earned: player.goals >= 1 },
    { id: "hat-trick", title: "Hat-trick hero", description: "Score 3 goals on one match day", earned: maxDayGoals >= 3 },
    { id: "playmaker", title: "Playmaker", description: "Set up 3 goals on one match day", earned: maxDayAssists >= 3 },
    { id: "on-fire", title: "On fire", description: "Win 3 games in a row", earned: longestWinRun >= 3 },
    { id: "brick-wall", title: "Brick wall", description: "Keep 5 clean sheets", earned: player.cleanSheets >= 5 },
    { id: "regular", title: "Regular", description: "Play 10 games", earned: player.appearances >= 10 },
    { id: "centurion", title: "Centurion", description: "Play 100 games", earned: player.appearances >= 100 },
    { id: "angel", title: "Angel", description: "Go 10 games without a card", earned: longestBookingFree >= 10 },
    { id: "top-rated", title: "Top of the squad", description: "Hold the highest rating in the squad", earned: rank.rating === 1 && players.length > 1 },
    { id: "rising", title: "Rising star", description: "Reach a rating of 7.50", earned: peakRating >= 7.5 },
  ];

  return {
    squadSize: players.length,
    rank,
    lastMove,
    ratingJourney,
    peakRating,
    unbeatenRun,
    winRun,
    longestWinRun,
    scoringRun,
    bookingFreeGames,
    winRate: finished.length ? finished.filter((g) => g.result === "W").length / finished.length : null,
    bestDay,
    bestPartner,
    connection,
    nemesis,
    earliestGoal,
    milestones: milestones.slice(0, 3),
    badges,
  };
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
