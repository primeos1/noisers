import { useState, type FormEvent } from "react";
import Modal from "./Modal";
import { isStockPhoto, membershipLabels, positionLabels, type Membership, type Player, type Position } from "../../lib/clubData";
import ImageUploadField from "./ImageUploadField";
import { useSquad } from "../../lib/SquadContext";
import { useSettings } from "../../lib/SettingsContext";

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
  onSubmit: (player: Omit<Player, "id">) => void;
  onClose: () => void;
}) {
  const { settings } = useSettings();
  // The photo field only ever holds an uploaded image; players without one
  // fall back to a stock face when displayed.
  const [form, setForm] = useState<Omit<Player, "id">>(
    initial ? { ...initial, photo: isStockPhoto(initial.photo) ? "" : initial.photo } : {
      number: suggestedNumber,
      name: "",
      position: "MID",
      secondaryPosition: null,
      membership: "member",
      photo: "",
      rating: settings.ratingNewPlayer,
      appearances: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
    },
  );
  const [error, setError] = useState("");
  const { players } = useSquad();
  // Shirt numbers can be shared — just let the admin know who else wears it.
  const sharedWith = players.filter((p) => p.number === form.number && p.id !== initial?.id);

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
              onChange={(e) => setForm({ ...form, number: Number(e.target.value) })}
            />
            {sharedWith.length > 0 && (
              <span className="mt-1 block text-xs text-mist">
                Also worn by {sharedWith.map((p) => p.name).join(", ")}
              </span>
            )}
          </label>
          <label className={labelClass}>
            Position
            <select
              className={inputClass}
              value={form.position}
              onChange={(e) => {
                const position = e.target.value as Position;
                // A second position matching the new main one is dropped.
                setForm({
                  ...form,
                  position,
                  secondaryPosition: form.secondaryPosition === position ? null : form.secondaryPosition,
                });
              }}
            >
              {(Object.keys(positionLabels) as Position[]).map((pos) => (
                <option key={pos} value={pos}>
                  {positionLabels[pos]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={labelClass}>
          Second position (optional)
          <select
            className={inputClass}
            value={form.secondaryPosition ?? ""}
            onChange={(e) => setForm({ ...form, secondaryPosition: (e.target.value || null) as Position | null })}
          >
            <option value="">None</option>
            {(Object.keys(positionLabels) as Position[])
              .filter((pos) => pos !== form.position)
              .map((pos) => (
                <option key={pos} value={pos}>
                  {positionLabels[pos]}
                </option>
              ))}
          </select>
          <span className="mt-1 block text-xs text-mist">
            Team balancing and clean-sheet ratings use the main position.
          </span>
        </label>

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

        <fieldset>
          <legend className={labelClass}>Membership</legend>
          <div className="mt-1 flex gap-6">
            {(Object.keys(membershipLabels) as Membership[]).map((value) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-paper-dim">
                <input
                  type="radio"
                  name="membership"
                  value={value}
                  checked={form.membership === value}
                  onChange={() => setForm({ ...form, membership: value })}
                  className="h-4 w-4 accent-paper"
                />
                {membershipLabels[value]}
              </label>
            ))}
          </div>
        </fieldset>

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
