import { useState, type FormEvent } from "react";
import Modal from "./Modal";
import type { Player } from "../../lib/clubData";
import { absenceTypes, todayIso, type Absence, type AbsenceType } from "../../lib/absences";
import type { AbsenceInput } from "../../lib/AbsencesContext";
import { absenceTone } from "../AbsenceBadge";

const inputClass =
  "mt-1 w-full border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper disabled:opacity-40";
const labelClass = "block text-sm text-paper-dim";

const reasonHints: Record<AbsenceType, string> = {
  injury: "e.g. Hamstring strain",
  travel: "e.g. Work trip to Lagos",
  suspension: "e.g. Violent conduct",
  other: "e.g. Exams",
};

/** Quick lengths — the return date they set is inclusive of the start day. */
const quickLengths = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
  { label: "6 weeks", days: 42 },
];

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function AbsenceFormModal({
  players,
  initial,
  presetPlayerId,
  onSubmit,
  onClose,
}: {
  players: Player[];
  initial: Absence | null;
  presetPlayerId?: number;
  onSubmit: (input: AbsenceInput) => Promise<void>;
  onClose: () => void;
}) {
  const sorted = [...players].sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
  const [picked, setPlayerId] = useState<number>(initial?.playerId ?? presetPlayerId ?? 0);
  // Falls back to the first player if the squad loaded after the form opened.
  const playerId = sorted.some((p) => p.id === picked) ? picked : (sorted[0]?.id ?? 0);
  const [type, setType] = useState<AbsenceType>(initial?.type ?? "injury");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [startsOn, setStartsOn] = useState(initial?.startsOn ?? todayIso());
  const [openEnded, setOpenEnded] = useState(initial ? initial.endsOn === null : false);
  const [endsOn, setEndsOn] = useState(initial?.endsOn ?? addDays(todayIso(), 13));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!players.some((p) => p.id === playerId)) return setError("Pick a player.");
    if (!startsOn) return setError("Pick the day they're out from.");
    if (!openEnded && (!endsOn || endsOn < startsOn)) return setError("The return date must be on or after the start.");
    setError("");
    setSaving(true);
    try {
      await onSubmit({ playerId, type, reason: reason.trim(), startsOn, endsOn: openEnded ? null : endsOn });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? "Edit availability" : "Tag a player out"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className={labelClass}>
          Player
          <select className={inputClass} value={playerId} onChange={(e) => setPlayerId(Number(e.target.value))}>
            {sorted.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.number} {p.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className={labelClass}>Why they're out</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {absenceTypes.map((t) => (
              <label
                key={t.id}
                className={`cursor-pointer border px-3 py-2.5 transition-colors ${
                  type === t.id ? absenceTone[t.id] : "border-ink-line text-paper-dim hover:border-paper/40"
                }`}
              >
                <input
                  type="radio"
                  name="absence-type"
                  value={t.id}
                  checked={type === t.id}
                  onChange={() => setType(t.id)}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className="mt-0.5 block text-[0.7rem] leading-snug opacity-80">{t.blurb}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className={labelClass}>
          Details <span className="text-mist">(optional — shown on Noisers)</span>
          <input
            className={inputClass}
            value={reason}
            maxLength={255}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonHints[type]}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Out from
            <input type="date" className={inputClass} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </label>
          <label className={labelClass}>
            Back on
            <input
              type="date"
              className={inputClass}
              value={openEnded ? "" : endsOn}
              min={startsOn}
              disabled={openEnded}
              onChange={(e) => setEndsOn(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quickLengths.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                setOpenEnded(false);
                setEndsOn(addDays(startsOn, q.days - 1));
              }}
              className="rounded-full border border-ink-line px-3 py-1 text-xs text-paper-dim hover:border-paper/60 hover:text-paper"
            >
              {q.label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs text-paper-dim">
            <input
              type="checkbox"
              checked={openEnded}
              onChange={(e) => setOpenEnded(e.target.checked)}
              className="h-4 w-4 accent-paper"
            />
            No return date yet
          </label>
        </div>

        {error && <p className="border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}

        <div className="sheet-actions flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-ink-line px-4 py-2 text-sm text-paper-dim hover:text-paper"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="border border-paper bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-transparent hover:text-paper disabled:opacity-50"
          >
            {saving ? "Saving…" : initial ? "Save" : "Tag player"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
