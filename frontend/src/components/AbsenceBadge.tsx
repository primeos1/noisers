import { absenceLabel, absenceStatus, shortDate, type Absence, type AbsenceType } from "../lib/absences";

/** Text and border colour per kind of absence. */
export const absenceTone: Record<AbsenceType, string> = {
  injury: "border-loss/60 bg-loss/15 text-loss",
  travel: "border-travel/60 bg-travel/15 text-travel",
  suspension: "border-justice/60 bg-justice/15 text-justice",
  other: "border-mist/60 bg-mist/15 text-paper-dim",
};

/** "back Tue 20 Oct", "from Wed 28 Oct", "no return date" */
export function absenceWhen(absence: Absence) {
  if (absenceStatus(absence) === "upcoming") return `from ${shortDate(absence.startsOn)}`;
  return absence.endsOn ? `back ${shortDate(absence.endsOn)}` : "no return date";
}

// Small pill flagging a player who's out (or about to be): "Injured · back Tue 20 Oct".
export default function AbsenceBadge({
  absence,
  compact = false,
  className = "",
}: {
  absence: Absence;
  /** Just the kind ("Injured"), for tight spots like photo overlays. */
  compact?: boolean;
  className?: string;
}) {
  const upcoming = absenceStatus(absence) === "upcoming";
  const { short } = absenceLabel(absence.type);
  return (
    <span
      title={[absence.reason, absenceWhen(absence)].filter(Boolean).join(" · ")}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${absenceTone[absence.type]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${upcoming ? "opacity-50" : "absence-blip"}`} aria-hidden="true" />
      {compact ? short : `${upcoming ? "Out" : short} · ${absenceWhen(absence)}`}
    </span>
  );
}
