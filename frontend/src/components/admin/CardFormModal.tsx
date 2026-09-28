import { useState, type FormEvent } from "react";
import Modal from "./Modal";
import type { Player } from "../../lib/clubData";
import { formatNaira, type CardRecord, type CardType } from "../../lib/cards";
import { useSettings } from "../../lib/SettingsContext";
import { useMatchDay } from "../../lib/MatchDayContext";
import { isoDateLabel, scoreOf } from "../../lib/matchDay";

const inputClass =
  "mt-1 w-full border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper";
const labelClass = "block text-sm text-paper-dim";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Where a card was picked up, when it belongs to a finished match day game. */
export interface CardMatchLink {
  eventId: string;
  gameId: string;
}

export default function CardFormModal({
  players,
  onSubmit,
  onClose,
}: {
  players: Player[];
  onSubmit: (card: CardRecord, link: CardMatchLink | null) => void;
  onClose: () => void;
}) {
  const { settings } = useSettings();
  const { events } = useMatchDay();
  const fineAmounts: Record<CardType, number> = {
    yellow: settings.yellowCardFine,
    red: settings.redCardFine,
  };
  const sorted = [...players].sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
  const matchDays = [...events].reverse().filter((e) => e.status === "ended" && e.games.length > 0);

  const [eventId, setEventId] = useState("");
  const [gameId, setGameId] = useState("");
  const [playerId, setPlayerId] = useState<number>(sorted[0]?.id ?? 0);
  const [type, setType] = useState<CardType>("yellow");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState("");

  const event = matchDays.find((e) => e.id === eventId);
  const game = event?.games.find((g) => g.id === gameId);
  // Linked to a game, only the squad players who played in it can be booked.
  const choices = game
    ? sorted.filter((p) => game.teams.some((t) => t.players.includes(p.id)))
    : sorted;

  function pickGame(id: string) {
    setGameId(id);
    const next = event?.games.find((g) => g.id === id);
    if (next && !next.teams.some((t) => t.players.includes(playerId))) {
      const first = sorted.find((p) => next.teams.some((t) => t.players.includes(p.id)));
      if (first) setPlayerId(first.id);
    }
  }

  function pickEvent(id: string) {
    setEventId(id);
    setGameId("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Give a reason for the card.");
      return;
    }
    if (event && !game) {
      setError("Pick the game the card was given in.");
      return;
    }
    if (!choices.some((p) => p.id === playerId)) {
      setError("Pick a player.");
      return;
    }
    onSubmit(
      {
        id: `card${Date.now()}`,
        playerId,
        type,
        reason: reason.trim(),
        fine: fineAmounts[type],
        paid: false,
        date: isoDateLabel(date),
        occurredOn: date,
      },
      event && game ? { eventId: event.id, gameId: game.id } : null,
    );
  }

  return (
    <Modal title="Add card" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className={labelClass}>
          Match day
          <select className={inputClass} value={eventId} onChange={(e) => pickEvent(e.target.value)}>
            <option value="">Not from a match day</option>
            {matchDays.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} · {m.date}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-mist">
            {event
              ? "The card is added to that game's record, so it also counts in the player's stats, rating and The Vale."
              : "For a card that wasn't logged during a match day. Pick one to add it to that game's record instead."}
          </span>
        </label>

        {event && (
          <label className={labelClass}>
            Game
            <select className={inputClass} value={gameId} onChange={(e) => pickGame(e.target.value)}>
              <option value="" disabled>
                Pick a game…
              </option>
              {event.games.map((g, i) => (
                <option key={g.id} value={g.id}>
                  Game {i + 1}: {g.teams[0].name} {scoreOf(g, 0)}–{scoreOf(g, 1)} {g.teams[1].name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className={labelClass}>
          Player
          <select
            className={inputClass}
            value={playerId}
            disabled={!!event && !game}
            onChange={(e) => setPlayerId(Number(e.target.value))}
          >
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.number} {p.name}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className={labelClass}>Card</span>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(["yellow", "red"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`border px-4 py-3 text-left transition-colors ${
                  type === t ? "border-paper bg-ink-raised" : "border-ink-line hover:border-paper/40"
                }`}
              >
                <span className={t === "red" ? "text-loss" : "text-draw"}>
                  {t === "red" ? "Red card" : "Yellow card"}
                </span>
                <p className="mt-1 text-xs text-mist">{formatNaira(fineAmounts[t])} fine</p>
              </button>
            ))}
          </div>
        </div>

        <label className={labelClass}>
          Reason
          <input
            type="text"
            className={inputClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Dissent, late challenge…"
          />
        </label>

        {!event && (
          <label className={labelClass}>
            Date
            <input
              type="date"
              className={inputClass}
              value={date}
              max={todayIso()}
              onChange={(e) => setDate(e.target.value || todayIso())}
            />
          </label>
        )}

        {error && <p className="text-sm text-loss">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-ink-line pt-4">
          <button
            type="button"
            onClick={onClose}
            className="border border-ink-line px-4 py-2 text-sm text-paper-dim hover:text-paper"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="border border-paper bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-transparent hover:text-paper"
          >
            Add card
          </button>
        </div>
      </form>
    </Modal>
  );
}
