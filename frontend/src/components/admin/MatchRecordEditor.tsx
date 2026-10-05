import { useState } from "react";
import Modal from "./Modal";
import SavesCounter from "./SavesCounter";
import { useMatchDay } from "../../lib/MatchDayContext";
import { useSquad } from "../../lib/SquadContext";
import { useCards } from "../../lib/CardsContext";
import { useValeContent } from "../../lib/ValeContentContext";
import {
  participantName,
  scoreOf,
  type MatchDayCard,
  type MatchDayEvent,
  type MatchDayGame,
  type MatchDayGoal,
  type ParticipantId,
} from "../../lib/matchDay";

const inputClass =
  "w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper";
const labelClass = "block text-xs text-mist";

// <select> values are strings, but a participant is a squad player id
// (number) or a guest id (string) — keep the two apart when round-tripping.
function encode(id: ParticipantId | undefined) {
  if (id === undefined) return "";
  return typeof id === "number" ? `p:${id}` : `g:${id}`;
}

function decode(value: string): ParticipantId | undefined {
  if (value === "") return undefined;
  return value.startsWith("p:") ? Number(value.slice(2)) : value.slice(2);
}

let idCounter = 0;
function newId(prefix: string) {
  idCounter += 1;
  return `${prefix}${Date.now()}${idCounter}`;
}

function teamOf(game: MatchDayGame, id: ParticipantId): 0 | 1 {
  return game.teams[1].players.includes(id) ? 1 : 0;
}

/**
 * Edits an ended match day's record — its details, and each game's goals,
 * cards and saves — or deletes games outright. Nothing is saved until "Save
 * changes"; the server then brings the stats, fines, ratings and The Vale
 * in line with the corrected record.
 */
export default function MatchRecordEditor({ event, onClose }: { event: MatchDayEvent; onClose: () => void }) {
  const { updateEvent, error } = useMatchDay();
  const { players, refresh: refreshSquad } = useSquad();
  const { refresh: refreshCards } = useCards();
  const { refresh: refreshVale } = useValeContent();

  const [venue, setVenue] = useState(event.venue);
  const [date, setDate] = useState(event.date);
  // The record as it was when opened — saving patches `event` optimistically.
  const [original] = useState(event.games);
  const [games, setGames] = useState<MatchDayGame[]>(event.games);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const name = (id: ParticipantId) => participantName(players, event.guests, id);
  const deletedCount = original.length - games.length;

  function patchGame(gameId: string, update: (game: MatchDayGame) => MatchDayGame) {
    setGames((prev) => prev.map((g) => (g.id === gameId ? update(g) : g)));
  }

  function patchGoal(gameId: string, goalId: string, patch: Partial<MatchDayGoal>) {
    patchGame(gameId, (g) => ({
      ...g,
      goals: g.goals.map((goal) => {
        if (goal.id !== goalId) return goal;
        const next = { ...goal, ...patch };
        // The scorer comes from the credited team, or the other one for an own goal.
        const scorerSide = g.teams[next.ownGoal ? 1 - next.teamIndex : next.teamIndex].players;
        if (!scorerSide.includes(next.playerId)) next.playerId = scorerSide[0];
        if (next.ownGoal || (next.assistPlayerId !== undefined && !g.teams[next.teamIndex].players.includes(next.assistPlayerId))) {
          next.assistPlayerId = undefined;
        }
        return next;
      }),
    }));
  }

  function addGoal(game: MatchDayGame) {
    const goal: MatchDayGoal = {
      id: newId("g"),
      teamIndex: 0,
      playerId: game.teams[0].players[0],
      ownGoal: false,
      minute: 0,
    };
    patchGame(game.id, (g) => ({ ...g, goals: [...g.goals, goal] }));
  }

  function patchCard(gameId: string, cardId: string, patch: Partial<MatchDayCard>) {
    patchGame(gameId, (g) => ({
      ...g,
      cards: g.cards.map((c) => {
        if (c.id !== cardId) return c;
        const next = { ...c, ...patch };
        return { ...next, teamIndex: teamOf(g, next.playerId) };
      }),
    }));
  }

  function addCard(game: MatchDayGame) {
    const playerId = game.teams[0].players[0] ?? game.teams[1].players[0];
    const card: MatchDayCard = {
      id: newId("c"),
      teamIndex: teamOf(game, playerId),
      playerId,
      type: "yellow",
      reason: "",
      minute: 0,
    };
    patchGame(game.id, (g) => ({ ...g, cards: [...g.cards, card] }));
  }

  async function handleSave() {
    if (!date.trim()) {
      setFormError("A match day needs a date.");
      return;
    }
    if (games.some((g) => g.goals.some((goal) => goal.playerId === undefined) || g.cards.some((c) => c.playerId === undefined))) {
      setFormError("Every goal and card needs a player.");
      return;
    }
    setFormError("");
    setSaving(true);
    const ok = await updateEvent(event.id, {
      venue: venue.trim(),
      date: date.trim(),
      games: games.map((g) => ({
        ...g,
        cards: g.cards.map((c) => ({ ...c, reason: c.reason.trim() || (c.type === "yellow" ? "Yellow card" : "Red card") })),
      })),
    });
    setSaving(false);
    if (ok) {
      refreshSquad();
      refreshCards();
      refreshVale();
      onClose();
    }
  }

  return (
    <Modal title="Edit match record" onClose={() => !saving && onClose()} wide>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          Title
          <input className={`${inputClass} mt-1 opacity-60`} value={event.title} disabled title="Match days are numbered automatically" />
        </label>
        <label className={labelClass}>
          Venue
          <input className={`${inputClass} mt-1`} value={venue} onChange={(e) => setVenue(e.target.value)} />
        </label>
        <label className={labelClass}>
          Date
          <input className={`${inputClass} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      {games.length === 0 && (
        <p className="mt-6 rounded-xl bg-ink px-4 py-3 text-sm text-paper-dim">
          No games left. Saving keeps the match day but it won't count towards anyone's stats.
        </p>
      )}

      <ol className="mt-6 space-y-4">
        {games.map((game) => {
          const index = original.findIndex((g) => g.id === game.id);
          const everyone = [...game.teams[0].players, ...game.teams[1].players];
          return (
            <li key={game.id} className="rounded-xl border border-ink-line bg-ink p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-mist">
                    Game {index + 1}
                    {game.status !== "finished" && " · not finished, doesn't count"}
                  </p>
                  <p className="font-display text-lg text-paper">
                    {game.teams[0].name} <span className="tabular-nums">{scoreOf(game, 0)}–{scoreOf(game, 1)}</span>{" "}
                    {game.teams[1].name}
                  </p>
                </div>
                {confirmDelete === game.id ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-paper-dim">Delete this game?</span>
                    <button type="button" onClick={() => setConfirmDelete(null)} className="px-2 py-1.5 text-paper-dim hover:text-paper">
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGames((prev) => prev.filter((g) => g.id !== game.id));
                        setConfirmDelete(null);
                      }}
                      className="rounded-full bg-loss px-3 py-1.5 font-semibold text-paper"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(game.id)}
                    className="rounded-full bg-loss/15 px-3 py-1.5 text-xs font-semibold text-loss hover:bg-loss/25"
                  >
                    Delete game
                  </button>
                )}
              </div>

              {/* Goals */}
              <p className="mt-4 text-sm text-paper">Goals</p>
              {game.goals.length === 0 && <p className="mt-1 text-xs text-mist">No goals.</p>}
              <ul className="mt-2 space-y-2">
                {game.goals.map((goal) => {
                  const scorerSide = game.teams[goal.ownGoal ? 1 - goal.teamIndex : goal.teamIndex].players;
                  const teammates = game.teams[goal.teamIndex].players.filter((id) => id !== goal.playerId);
                  return (
                    <li key={goal.id} className="grid grid-cols-2 gap-2 rounded-lg bg-ink-raised p-2 sm:grid-cols-[1fr_1.3fr_1.3fr_auto_auto] sm:items-center">
                      <select
                        aria-label="Goal for"
                        className={inputClass}
                        value={goal.teamIndex}
                        onChange={(e) => patchGoal(game.id, goal.id, { teamIndex: Number(e.target.value) as 0 | 1 })}
                      >
                        <option value={0}>For {game.teams[0].name}</option>
                        <option value={1}>For {game.teams[1].name}</option>
                      </select>
                      <select
                        aria-label="Scorer"
                        className={inputClass}
                        value={encode(goal.playerId)}
                        onChange={(e) => patchGoal(game.id, goal.id, { playerId: decode(e.target.value)! })}
                      >
                        {scorerSide.map((id) => (
                          <option key={encode(id)} value={encode(id)}>
                            {name(id)}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Assist"
                        className={inputClass}
                        disabled={goal.ownGoal}
                        value={encode(goal.assistPlayerId)}
                        onChange={(e) => patchGoal(game.id, goal.id, { assistPlayerId: decode(e.target.value) })}
                      >
                        <option value="">No assist</option>
                        {teammates.map((id) => (
                          <option key={encode(id)} value={encode(id)}>
                            Assist: {name(id)}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 px-1 text-xs text-paper-dim">
                        <input
                          type="checkbox"
                          checked={goal.ownGoal}
                          onChange={(e) => patchGoal(game.id, goal.id, { ownGoal: e.target.checked })}
                        />
                        Own goal
                      </label>
                      <button
                        type="button"
                        onClick={() => patchGame(game.id, (g) => ({ ...g, goals: g.goals.filter((x) => x.id !== goal.id) }))}
                        className="justify-self-end px-2 text-xs text-paper-dim hover:text-loss"
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
              {everyone.length > 0 && (
                <button type="button" onClick={() => addGoal(game)} className="mt-2 text-xs text-paper-dim underline underline-offset-4 hover:text-paper">
                  + Add goal
                </button>
              )}

              {/* Cards */}
              <p className="mt-4 text-sm text-paper">Cards</p>
              {game.cards.length === 0 && <p className="mt-1 text-xs text-mist">No cards.</p>}
              <ul className="mt-2 space-y-2">
                {game.cards.map((card) => (
                  <li key={card.id} className="grid grid-cols-2 gap-2 rounded-lg bg-ink-raised p-2 sm:grid-cols-[1.3fr_auto_1.5fr_auto] sm:items-center">
                    <select
                      aria-label="Player"
                      className={inputClass}
                      value={encode(card.playerId)}
                      onChange={(e) => patchCard(game.id, card.id, { playerId: decode(e.target.value)! })}
                    >
                      {game.teams.map((team) => (
                        <optgroup key={team.name} label={team.name}>
                          {team.players.map((id) => (
                            <option key={encode(id)} value={encode(id)}>
                              {name(id)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <select
                      aria-label="Card type"
                      className={`${inputClass} ${card.type === "red" ? "text-loss" : "text-draw"}`}
                      value={card.type}
                      onChange={(e) => patchCard(game.id, card.id, { type: e.target.value as MatchDayCard["type"] })}
                    >
                      <option value="yellow">Yellow</option>
                      <option value="red">Red</option>
                    </select>
                    <input
                      aria-label="Reason"
                      className={inputClass}
                      value={card.reason}
                      placeholder="Reason"
                      onChange={(e) => patchCard(game.id, card.id, { reason: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => patchGame(game.id, (g) => ({ ...g, cards: g.cards.filter((x) => x.id !== card.id) }))}
                      className="justify-self-end px-2 text-xs text-paper-dim hover:text-loss"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              {everyone.length > 0 && (
                <button type="button" onClick={() => addCard(game)} className="mt-2 text-xs text-paper-dim underline underline-offset-4 hover:text-paper">
                  + Add card
                </button>
              )}

              {/* Saves */}
              <p className="mt-4 text-sm text-paper">Saves</p>
              <div className="mt-2">
                <SavesCounter
                  game={game}
                  players={players}
                  minute={0}
                  onChange={(update) => patchGame(game.id, (g) => ({ ...g, saves: update(g.saves ?? []) }))}
                />
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-xs text-mist">
        Saving updates everything this match day counted towards: appearances, goals, assists, clean sheets and saves, cards
        and fines (paid fines stay paid), player ratings, and The Vale if it's showing this match day.
        {deletedCount > 0 && (
          <span className="text-loss">
            {" "}
            {deletedCount} game{deletedCount === 1 ? "" : "s"} will be deleted, with {deletedCount === 1 ? "its" : "their"}{" "}
            goals, cards and saves.
          </span>
        )}
      </p>

      {(formError || error) && <p className="mt-3 text-sm text-loss">{formError || error}</p>}

      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-ink-line pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          className="border border-ink-line px-5 py-2.5 text-sm text-paper-dim hover:text-paper disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="border border-paper bg-paper px-5 py-2.5 text-sm font-medium text-ink hover:bg-transparent hover:text-paper disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}
