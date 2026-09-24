// Derivations for the player portal — everything here is computed from the
// match day events, squad and cards already loaded by the app's contexts.

import type { Player, Position } from "./clubData";
import type { CardRecord } from "./cards";
import {
  participantName,
  scoreOf,
  type MatchDayEvent,
  type MatchDayGame,
  type ParticipantId,
} from "./matchDay";
import { useLocalStorageState } from "./useLocalStorageState";

/** The viewer's own shirt number — a per-phone convenience, not an account. */
export function useMyShirt() {
  return useLocalStorageState<number | null>("noisers_portal_shirt", null);
}

export const positionLabel: Record<Position, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

export const positions: Position[] = ["GK", "DEF", "MID", "FWD"];

export type Result = "W" | "D" | "L";

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
  teamIndex: 0 | 1;
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
export function playerGameLog(events: MatchDayEvent[], number: number): GameLogEntry[] {
  const log: GameLogEntry[] = [];
  for (const event of sortEvents(events)) {
    event.games.forEach((game, i) => {
      const teamIndex = game.teams[0].players.includes(number)
        ? 0
        : game.teams[1].players.includes(number)
          ? 1
          : null;
      if (teamIndex === null) return;
      log.push({
        event,
        game,
        gameNumber: i + 1,
        teamIndex,
        teamName: game.teams[teamIndex].name,
        goalsFor: scoreOf(game, teamIndex),
        goalsAgainst: scoreOf(game, teamIndex === 0 ? 1 : 0),
        result: resultFor(game, teamIndex),
        goals: game.goals.filter((g) => g.playerId === number && !g.ownGoal).length,
        assists: game.goals.filter((g) => g.assistPlayerId === number).length,
        yellows: game.cards.filter((c) => c.playerId === number && c.type === "yellow").length,
        reds: game.cards.filter((c) => c.playerId === number && c.type === "red").length,
      });
    });
  }
  return log;
}

export function cardCounts(cards: CardRecord[], number: number) {
  const mine = cards.filter((c) => c.playerNumber === number);
  const total = mine.reduce((s, c) => s + c.fine, 0);
  const paid = mine.filter((c) => c.paid).reduce((s, c) => s + c.fine, 0);
  return {
    cards: mine,
    yellow: mine.filter((c) => c.type === "yellow").length,
    red: mine.filter((c) => c.type === "red").length,
    total,
    paid,
    outstanding: total - paid,
  };
}

export interface Contribution {
  id: ParticipantId;
  name: string;
  position: Position | null;
  games: number;
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
      const player = typeof id === "number" ? players.find((p) => p.number === id) : undefined;
      r = {
        id,
        name: participantName(players, event.guests, id),
        position: player?.position ?? null,
        games: 0,
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
    for (const team of game.teams) for (const id of team.players) row(id).games++;
    for (const goal of game.goals) {
      if (!goal.ownGoal) row(goal.playerId).goals++;
      if (goal.assistPlayerId !== undefined && goal.assistPlayerId !== null) row(goal.assistPlayerId).assists++;
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
          detail:
            g.assistPlayerId !== undefined && g.assistPlayerId !== null
              ? `game ${n}, assist from ${name(g.assistPlayerId)}`
              : `game ${n}`,
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
