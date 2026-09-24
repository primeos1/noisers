import { useState, type FormEvent } from "react";
import Modal from "./Modal";
import { isStockPhoto, type Player, type Position } from "../../lib/clubData";
import ImageUploadField from "./ImageUploadField";
import { useSquad } from "../../lib/SquadContext";

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
  // The photo field only ever holds an uploaded image; players without one
  // fall back to a stock face when displayed.
  const [form, setForm] = useState<Player>(
    initial ? { ...initial, photo: isStockPhoto(initial.photo) ? "" : initial.photo } : {
      number: suggestedNumber,
      name: "",
      position: "MID",
      photo: "",
      rating: 6.5,
      appearances: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
    },
  );
  const [error, setError] = useState("");
  const { players } = useSquad();
  // Jersey numbers identify players everywhere (cards, match days, awards),
  // so each one can only belong to a single player.
  const numberOwner = players.find((p) => p.number === form.number && p.number !== initial?.number);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Enter a player name.");
      return;
    }
    if (!Number.isInteger(form.number) || form.number < 1 || form.number > 99) {
      setError("Jersey number must be a whole number from 1 to 99.");
      return;
    }
    if (numberOwner) {
      setError(`#${form.number} is already taken by ${numberOwner.name} — pick another number.`);
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
              min={1}
              max={99}
              aria-invalid={!!numberOwner}
              onChange={(e) => setForm({ ...form, number: Number(e.target.value) })}
            />
            {numberOwner && (
              <span className="mt-1 block text-xs text-loss">Taken by {numberOwner.name}</span>
            )}
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

        <ImageUploadField
          label="Photo"
          value={form.photo}
          onChange={(url) => setForm({ ...form, photo: url })}
          maxDim={480}
        />

        <label className={labelClass}>
          Rating
          <input
            type="number"
            step="0.01"
            min="4"
            max="9.5"
            className={inputClass}
            value={form.rating}
            onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
          />
          <span className="mt-1 block text-xs text-mist">
            Between 4.0 and 9.5. Moves automatically after each match day with team results, goals, assists and clean sheets; set it here to override.
          </span>
        </label>

        {initial && (
          <div>
            <span className={labelClass}>Career stats</span>
            <p className="mt-2 text-xs text-mist">
              Calculated automatically from finished Match Day games — not
              editable here.
            </p>
            <div className="mt-2 grid grid-cols-4 gap-px bg-ink-line text-center text-sm">
              {[
                { label: "Apps", value: form.appearances },
                { label: "Goals", value: form.goals },
                { label: "Assists", value: form.assists },
                { label: "Clean sheets", value: form.cleanSheets },
              ].map((stat) => (
                <div key={stat.label} className="bg-ink py-3">
                  <p className="text-paper">{stat.value}</p>
                  <p className="mt-1 text-xs text-mist">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
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
            {initial ? "Save changes" : "Add player"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
