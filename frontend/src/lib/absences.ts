// A spell a player is out — injured, travelling, suspended or away for
// another reason — tagged by the committee with the dates it covers.

export type AbsenceType = "injury" | "travel" | "suspension" | "other";
export type AbsenceStatus = "upcoming" | "active" | "ended";

export interface Absence {
  id: string;
  playerId: number;
  type: AbsenceType;
  reason: string;
  /** yyyy-mm-dd */
  startsOn: string;
  /** yyyy-mm-dd, or null while there's no return date. */
  endsOn: string | null;
}

export const absenceTypes: { id: AbsenceType; label: string; short: string; blurb: string }[] = [
  { id: "injury", label: "Injury", short: "Injured", blurb: "Knocks, strains and anything the physio sees" },
  { id: "travel", label: "Travel", short: "Travelling", blurb: "Away for work, family or a holiday" },
  { id: "suspension", label: "Suspension", short: "Suspended", blurb: "Banned by the disciplinary committee" },
  { id: "other", label: "Other", short: "Unavailable", blurb: "Anything else that keeps them out" },
];

export function absenceLabel(type: AbsenceType) {
  return absenceTypes.find((t) => t.id === type)!;
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Relative to today — ISO dates compare correctly as strings. */
export function absenceStatus(a: Pick<Absence, "startsOn" | "endsOn">, today = todayIso()): AbsenceStatus {
  if (a.startsOn > today) return "upcoming";
  return a.endsOn && a.endsOn < today ? "ended" : "active";
}

/** "Sat 4 Oct" */
export function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** "4 Oct – 20 Oct", "from 4 Oct" */
export function absencePeriod(a: Pick<Absence, "startsOn" | "endsOn">) {
  const day = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  return a.endsOn ? `${day(a.startsOn)} – ${day(a.endsOn)}` : `from ${day(a.startsOn)}, no return date`;
}

/** Days until a date, counting today as 0 (negative once passed). */
export function daysUntil(iso: string, today = todayIso()) {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(iso) - toUtc(today)) / 86_400_000);
}

/**
 * The absence that matters for a player right now: the one they're serving,
 * else the next one coming up. Null when they're available.
 */
export function currentAbsence(absences: Absence[], playerId: number, today = todayIso()): Absence | null {
  const mine = absences.filter((a) => a.playerId === playerId);
  const active = mine.find((a) => absenceStatus(a, today) === "active");
  if (active) return active;
  const upcoming = mine
    .filter((a) => absenceStatus(a, today) === "upcoming")
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return upcoming[0] ?? null;
}
