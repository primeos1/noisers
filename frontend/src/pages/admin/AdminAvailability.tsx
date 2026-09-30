import { useState } from "react";
import { Link } from "react-router-dom";
import { useSquad } from "../../lib/SquadContext";
import { useAbsences } from "../../lib/AbsencesContext";
import {
  absenceLabel,
  absencePeriod,
  absenceStatus,
  absenceTypes,
  daysUntil,
  shortDate,
  todayIso,
  type Absence,
  type AbsenceStatus,
  type AbsenceType,
} from "../../lib/absences";
import AbsenceFormModal from "../../components/admin/AbsenceFormModal";
import AbsenceBadge from "../../components/AbsenceBadge";

const sections: { status: AbsenceStatus; title: string; empty: string }[] = [
  { status: "active", title: "Out now", empty: "Everyone's available. Full squad to pick from." },
  { status: "upcoming", title: "Coming up", empty: "Nobody's tagged out for a future date." },
  { status: "ended", title: "Back in the squad", empty: "No past absences yet." },
];

/** How far through an absence we are, 0–1 (null with no return date). */
function progress(a: Absence) {
  if (!a.endsOn) return null;
  const total = daysUntil(a.endsOn, a.startsOn) + 1;
  const done = daysUntil(todayIso(), a.startsOn) + 1;
  return Math.min(1, Math.max(0, done / total));
}

function countdown(a: Absence, status: AbsenceStatus) {
  if (status === "upcoming") {
    const d = daysUntil(a.startsOn);
    return d === 1 ? "Out tomorrow" : `Out in ${d} days`;
  }
  if (status === "ended") return a.endsOn ? `Last day out ${shortDate(a.endsOn)}` : "Back";
  if (!a.endsOn) return "No return date yet";
  const d = daysUntil(a.endsOn);
  return d === 0 ? "Last day out" : `${d} day${d === 1 ? "" : "s"} to go`;
}

const barTone: Record<AbsenceType, string> = {
  injury: "bg-loss",
  travel: "bg-travel",
  suspension: "bg-justice",
  other: "bg-mist",
};

export default function AdminAvailability() {
  const { players } = useSquad();
  const { absences, addAbsence, updateAbsence, removeAbsence } = useAbsences();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Absence | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Absence | null>(null);
  const [filter, setFilter] = useState<AbsenceType | "all">("all");
  const [error, setError] = useState("");

  const today = todayIso();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const player = (id: number) => players.find((p) => p.id === id);
  const visible = absences.filter((a) => (filter === "all" || a.type === filter) && player(a.playerId));
  const outNow = absences.filter((a) => absenceStatus(a, today) === "active");

  async function markBack(a: Absence) {
    setError("");
    try {
      await updateAbsence(a.id, { endsOn: yesterday });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-paper-dim">Injuries, travel & suspensions</p>
          <h1 className="mt-3 font-display text-4xl text-paper md:text-5xl">Availability</h1>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="border border-paper bg-paper px-5 py-2.5 text-sm font-medium text-ink hover:bg-transparent hover:text-paper"
        >
          + Tag a player out
        </button>
      </div>

      <p className="mt-4 max-w-2xl text-sm text-paper-dim">
        Tagged players show as out on the squad pages and the Match Day roster, and Noisers writes a story about each
        one — plus a welcome back when they return.
      </p>

      {/* At-a-glance tally of who's out right now, by kind. */}
      <div className="mt-6 grid grid-cols-2 gap-px bg-ink-line sm:grid-cols-4">
        {absenceTypes.map((t) => {
          const n = outNow.filter((a) => a.type === t.id).length;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(filter === t.id ? "all" : t.id)}
              aria-pressed={filter === t.id}
              className={`bg-ink px-4 py-4 text-left transition-colors hover:bg-ink-raised ${filter === t.id ? "bg-ink-raised" : ""}`}
            >
              <p className="text-xs uppercase tracking-wide text-mist">{t.short} now</p>
              <p className="mt-2 flex items-center gap-2 font-display text-3xl text-paper">
                <span className={`h-2.5 w-2.5 rounded-full ${barTone[t.id]}`} aria-hidden="true" />
                {n}
              </p>
            </button>
          );
        })}
      </div>
      {filter !== "all" && (
        <button type="button" onClick={() => setFilter("all")} className="mt-3 text-sm text-paper-dim hover:text-paper">
          Showing {absenceLabel(filter).label.toLowerCase()} only · Show all
        </button>
      )}

      {error && <p className="mt-6 border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">{error}</p>}

      {sections.map((section) => {
        const rows = visible
          .filter((a) => absenceStatus(a, today) === section.status)
          .sort((a, b) =>
            section.status === "ended"
              ? (b.endsOn ?? "").localeCompare(a.endsOn ?? "")
              : section.status === "upcoming"
                ? a.startsOn.localeCompare(b.startsOn)
                : (a.endsOn ?? "9999").localeCompare(b.endsOn ?? "9999"),
          )
          .slice(0, section.status === "ended" ? 12 : undefined);
        return (
          <section key={section.status} className="mt-10">
            <h2 className="font-display text-2xl text-paper">
              {section.title} <span className="text-mist">{rows.length || ""}</span>
            </h2>
            {rows.length === 0 ? (
              <p className="mt-3 text-sm text-mist">{section.empty}</p>
            ) : (
              <ul className="mt-4 divide-y divide-ink-line overflow-hidden rounded-2xl border border-ink-line bg-ink-raised md:rounded-none">
                {rows.map((a) => {
                  const p = player(a.playerId)!;
                  const pct = section.status === "active" ? progress(a) : null;
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                      <Link to={`/squad/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <img
                          src={p.photo}
                          alt=""
                          className={`h-11 w-11 shrink-0 rounded-full object-cover ${section.status === "ended" ? "duotone opacity-60" : "duotone"}`}
                        />
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-[0.95rem] text-paper">
                            <span className="truncate">{p.name}</span>
                            {section.status === "ended" ? (
                              <span className="text-xs text-mist">{absenceLabel(a.type).label}</span>
                            ) : (
                              <AbsenceBadge absence={a} compact />
                            )}
                          </p>
                          <p className="truncate text-xs text-mist">
                            {a.reason ? `${a.reason} · ` : ""}
                            {absencePeriod(a)}
                          </p>
                        </div>
                      </Link>

                      <div className="flex w-full items-center gap-3 sm:w-56">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-paper-dim">{countdown(a, section.status)}</p>
                          {pct !== null && (
                            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-line">
                              <div
                                className={`absence-bar h-full rounded-full ${barTone[a.type]}`}
                                style={{ width: `${Math.round(pct * 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1.5">
                        {section.status === "active" && yesterday >= a.startsOn && (
                          <button
                            type="button"
                            onClick={() => markBack(a)}
                            className="rounded-full bg-win/15 px-3 py-1.5 text-xs font-semibold text-win"
                          >
                            Back now
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditing(a)}
                          className="rounded-full bg-paper/10 px-3 py-1.5 text-xs font-semibold text-paper"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(a)}
                          className="rounded-full px-3 py-1.5 text-xs text-loss"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {adding && (
        <AbsenceFormModal
          players={players}
          initial={null}
          onClose={() => setAdding(false)}
          onSubmit={async (input) => {
            await addAbsence(input);
            setAdding(false);
          }}
        />
      )}

      {editing && (
        <AbsenceFormModal
          players={players}
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (input) => {
            await updateAbsence(editing.id, input);
            setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <div className="sheet-backdrop" onClick={() => setConfirmDelete(null)}>
          <div role="dialog" aria-modal="true" className="sheet md:max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl text-paper">Remove this absence</h2>
            <p className="mt-2 text-sm text-paper-dim">
              Take {player(confirmDelete.playerId)?.name}'s {absenceLabel(confirmDelete.type).label.toLowerCase()} off
              the record? Its Noisers story goes too. To say they're back, use Edit or Back now instead.
            </p>
            <div className="sheet-actions mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="border border-ink-line px-4 py-2 text-sm text-paper-dim hover:text-paper"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = confirmDelete;
                  setConfirmDelete(null);
                  removeAbsence(target.id).catch((err) => setError(err.message));
                }}
                className="border border-loss bg-loss px-4 py-2 text-sm font-medium text-paper hover:bg-transparent hover:text-loss"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
