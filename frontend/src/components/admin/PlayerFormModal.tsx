import { useState, type FormEvent } from "react";
import Modal from "./Modal";
import type { Player, Position } from "../../lib/clubData";

const inputClass =
  "mt-1 w-full border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper";
const labelClass = "block text-sm text-paper-dim";

export default function PlayerFormModal({
  initial,
  suggestedNumber,
  onSubmit,
  onClose,
}: {
  initial: Player | null;
  suggestedNumber: number;
  onSubmit: (player: Player) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Player>(
    initial ?? {
      number: suggestedNumber,
      name: "",
      position: "MID",
      photo: `https://i.pravatar.cc/400?img=${(suggestedNumber % 70) + 1}`,
      rating: 6.5,
      appearances: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
    },
  );
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Enter a player name.");
      return;
    }
    if (!Number.isFinite(form.number) || form.number <= 0) {
      setError("Jersey number must be a positive number.");
      return;
    }
    onSubmit(form);
  }

  return (
    <Modal title={initial ? "Edit player" : "Add player"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            Jersey number
            <input
              type="number"
              className={inputClass}
              value={form.number}
              onChange={(e) => setForm({ ...form, number: Number(e.target.value) })}
            />
          </label>
          <label className={labelClass}>
            Position
            <select
              className={inputClass}
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value as Position })}
            >
              <option value="GK">Goalkeeper</option>
              <option value="DEF">Defender</option>
              <option value="MID">Midfielder</option>
              <option value="FWD">Forward</option>
            </select>
          </label>
        </div>

        <label className={labelClass}>
          Full name
          <input
            type="text"
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Segun Owolabi"
          />
        </label>

        <label className={labelClass}>
          Photo URL
          <input
            type="text"
            className={inputClass}
            value={form.photo}
            onChange={(e) => setForm({ ...form, photo: e.target.value })}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            Rating
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              className={inputClass}
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
            />
          </label>
          <label className={labelClass}>
            Appearances
            <input
              type="number"
              min="0"
              className={inputClass}
              value={form.appearances}
              onChange={(e) => setForm({ ...form, appearances: Number(e.target.value) })}
            />
          </label>
          <label className={labelClass}>
            Goals
            <input
              type="number"
              min="0"
              className={inputClass}
              value={form.goals}
              onChange={(e) => setForm({ ...form, goals: Number(e.target.value) })}
            />
          </label>
          <label className={labelClass}>
            Assists
            <input
              type="number"
              min="0"
              className={inputClass}
              value={form.assists}
              onChange={(e) => setForm({ ...form, assists: Number(e.target.value) })}
            />
          </label>
          <label className={labelClass}>
            Clean sheets
            <input
              type="number"
              min="0"
              className={inputClass}
              value={form.cleanSheets}
              onChange={(e) => setForm({ ...form, cleanSheets: Number(e.target.value) })}
            />
          </label>
        </div>

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
            {initial ? "Save changes" : "Add player"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
