import { useState, type FormEvent } from "react";
import Modal from "./Modal";
import type { Player } from "../../lib/clubData";
import { formatNaira, type CardRecord, type CardType } from "../../lib/cards";
import { useSettings } from "../../lib/SettingsContext";

const inputClass =
  "mt-1 w-full border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper";
const labelClass = "block text-sm text-paper-dim";

function today() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function CardFormModal({
  players,
  onSubmit,
  onClose,
}: {
  players: Player[];
  onSubmit: (card: CardRecord) => void;
  onClose: () => void;
}) {
  const { settings } = useSettings();
  const fineAmounts: Record<CardType, number> = {
    yellow: settings.yellowCardFine,
    red: settings.redCardFine,
  };
  const sorted = [...players].sort((a, b) => a.number - b.number);
  const [playerNumber, setPlayerNumber] = useState<number>(sorted[0]?.number ?? 0);
  const [type, setType] = useState<CardType>("yellow");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(today());
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Give a reason for the card.");
      return;
    }
    onSubmit({
      id: `card${Date.now()}`,
      playerNumber,
      type,
      reason: reason.trim(),
      fine: fineAmounts[type],
      paid: false,
      date,
    });
  }

  return (
    <Modal title="Add card" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className={labelClass}>
          Player
          <select
            className={inputClass}
            value={playerNumber}
            onChange={(e) => setPlayerNumber(Number(e.target.value))}
          >
            {sorted.map((p) => (
              <option key={p.number} value={p.number}>
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

        <label className={labelClass}>
          Date
          <input
            type="text"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

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
