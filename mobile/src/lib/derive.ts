// Derivations computed from the loaded squad, cards and match days — ported
// from frontend/src/lib/portal.ts so the app and the web portal agree.

import type {
  Card,
  Guest,
  MatchDayEvent,
  MatchDayGame,
  ParticipantId,
  Player,
  Position,
} from "./types";

export type Result = "W" | "D" | "L";

export const positions: Position[] = ["GK", "DEF", "MID", "FWD"];

export const positionLabel: Record<Position, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

export const positionGroupLabel: Record<Position, string> = {
  GK: "Goalkeepers",
  DEF: "Defenders",
  MID: "Midfielders",
  FWD: "Forwards",
};

// Mirrors PlayerRatings::MIN / MAX on the backend.
export const RATING_MIN = 4.0;
export const RATING_MAX = 9.5;

const nairaFormat = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

export function formatNaira(amount: number) {
  return `₦${nairaFormat.format(amount)}`;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

export function cardDate(card: Card) {
  const iso = card.occurredOn ?? card.createdAt;
  return iso ? dateFormat.format(new Date(iso)) : "";
}

export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function scoreOf(game: Pick<MatchDayGame, "goals">, teamIndex: 0 | 1) {
  return game.goals.filter((g) => g.teamIndex === teamIndex).length;
}

export function participantName(players: Player[], guests: Guest[], id: ParticipantId): string {
  if (typeof id === "number") {
    const player = players.find((p) => p.id === id);
    return player ? player.name : `#${id}`;
  }
  const guest = guests.find((g) => g.id === id);
  return guest ? guest.name : id;
}

/** Newest match day first. */
export function sortEvents(events: MatchDayEvent[]): MatchDayEvent[] {
  return [...events].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export function eventGoals(event: MatchDayEvent) {
  return event.games.reduce((sum, g) => sum + g.goals.length, 0);
}

export function eventParticipants(event: MatchDayEvent) {
  return event.presentPlayers.length + event.guests.length;
}

export function resultFor(game: MatchDayGame, teamIndex: 0 | 1): Result | null {
  if (game.status !== "finished") return null;
  const us = scoreOf(game, teamIndex);
  const them = scoreOf(game, teamIndex === 0 ? 1 : 0);
  return us > them ? "W" : us < them ? "L" : "D";
}

export interface GameLogEntry {
  event: MatchDayEvent;
  game: MatchDayGame;
  gameNumber: number;
  teamName: string;
  goalsFor: number;
  goalsAgainst: number;
  result: Result | null;
  goals: number;
  assists: number;
  yellows: number;
  reds: number;
}

/** Every game a squad player took part in, newest match day first. */
export function playerGameLog(events: MatchDayEvent[], playerId: number): GameLogEntry[] {
  const log: GameLogEntry[] = [];
  for (const event of sortEvents(events)) {
    event.games.forEach((game, i) => {
      const teamIndex = game.teams[0].players.includes(playerId)
        ? 0
        : game.teams[1].players.includes(playerId)
          ? 1
          : null;
      if (teamIndex === null) return;
      log.push({
        event,
        game,
        gameNumber: i + 1,
        teamName: game.teams[teamIndex].name,
        goalsFor: scoreOf(game, teamIndex),
        goalsAgainst: scoreOf(game, teamIndex === 0 ? 1 : 0),
        result: resultFor(game, teamIndex),
        goals: game.goals.filter((g) => g.playerId === playerId && !g.ownGoal).length,
        assists: game.goals.filter((g) => g.assistPlayerId === playerId).length,
        yellows: game.cards.filter((c) => c.playerId === playerId && c.type === "yellow").length,
        reds: game.cards.filter((c) => c.playerId === playerId && c.type === "red").length,
      });
    });
  }
  return log;
}

export function cardCounts(cards: Card[], playerId: number) {
  const mine = cards.filter((c) => c.playerId === playerId);
  const total = mine.reduce((s, c) => s + c.fineAmount, 0);
  const paid = mine.filter((c) => c.paid).reduce((s, c) => s + c.fineAmount, 0);
  return {
    cards: mine,
    yellow: mine.filter((c) => c.type === "yellow").length,
    red: mine.filter((c) => c.type === "red").length,
    total,
    paid,
    outstanding: total - paid,
  };
}

export function outstandingFines(cards: Card[]) {
  return cards.filter((c) => !c.paid).reduce((sum, c) => sum + c.fineAmount, 0);
}

export interface Contribution {
  id: ParticipantId;
  name: string;
  position: Position | null;
  goals: number;
  assists: number;
  yellows: number;
  reds: number;
}

/** Per-participant tallies for one match day (squad players and guests). */
export function eventContributions(event: MatchDayEvent, players: Player[]): Contribution[] {
  const rows = new Map<ParticipantId, Contribution>();
  const row = (id: ParticipantId) => {
    let r = rows.get(id);
    if (!r) {
      const player = typeof id === "number" ? players.find((p) => p.id === id) : undefined;
      r = {
        id,
        name: participantName(players, event.guests, id),
        position: player?.position ?? null,
        goals: 0,
        assists: 0,
        yellows: 0,
        reds: 0,
      };
      rows.set(id, r);
    }
    return r;
  };

  for (const game of event.games) {
    for (const team of game.teams) for (const id of team.players) row(id);
    for (const goal of game.goals) {
      if (!goal.ownGoal) row(goal.playerId).goals++;
      if (goal.assistPlayerId != null) row(goal.assistPlayerId).assists++;
    }
    for (const card of game.cards) {
      if (card.type === "red") row(card.playerId).reds++;
      else row(card.playerId).yellows++;
    }
  }

  return [...rows.values()].sort(
    (a, b) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals || a.name.localeCompare(b.name),
  );
}

export interface ActivityItem {
  key: string;
  kind: "goal" | "own-goal" | "yellow" | "red";
  minute: number;
  text: string;
  detail: string;
  event: MatchDayEvent;
}

/** Goals and cards from the most recent match days, newest first. */
export function recentActivity(events: MatchDayEvent[], players: Player[], limit = 15): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const event of sortEvents(events)) {
    const name = (id: ParticipantId) => participantName(players, event.guests, id);
    [...event.games].reverse().forEach((game) => {
      const n = event.games.indexOf(game) + 1;
      const inGame: ActivityItem[] = [
        ...game.goals.map((g) => ({
          key: `${event.id}-${game.id}-${g.id}`,
          kind: (g.ownGoal ? "own-goal" : "goal") as ActivityItem["kind"],
          minute: g.minute,
          text: g.ownGoal ? `${name(g.playerId)} scored an own goal` : `${name(g.playerId)} scored`,
          detail: g.assistPlayerId != null ? `game ${n}, assist from ${name(g.assistPlayerId)}` : `game ${n}`,
          event,
        })),
        ...game.cards.map((c) => ({
          key: `${event.id}-${game.id}-${c.id}`,
          kind: c.type,
          minute: c.minute,
          text: `${name(c.playerId)} got a ${c.type} card`,
          detail: c.reason ? `game ${n}, ${c.reason}` : `game ${n}`,
          event,
        })),
      ];
      items.push(...inGame.sort((a, b) => b.minute - a.minute));
    });
    if (items.length >= limit) break;
  }
  return items.slice(0, limit);
}
