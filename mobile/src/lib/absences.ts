// Labels and date helpers for player absences — ported from
// frontend/src/lib/absences.ts so the app and the site describe them alike.

import type { Ionicons } from "@expo/vector-icons";
import type { Absence, AbsenceStatus, AbsenceType } from "./types";
import { colors } from "../theme";

export const absenceTypes: { id: AbsenceType; label: string; short: string; blurb: string; tone: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "injury", label: "Injury", short: "Injured", blurb: "Knocks, strains and anything the physio sees", tone: colors.loss, icon: "medkit" },
  { id: "travel", label: "Travel", short: "Travelling", blurb: "Away for work, family or a holiday", tone: colors.travel, icon: "airplane" },
  { id: "suspension", label: "Suspension", short: "Suspended", blurb: "Banned by the disciplinary committee", tone: colors.justice, icon: "hand-left" },
  { id: "other", label: "Other", short: "Unavailable", blurb: "Anything else that keeps them out", tone: colors.mist, icon: "remove-circle" },
];

export function absenceLabel(type: AbsenceType) {
  return absenceTypes.find((t) => t.id === type) ?? absenceTypes[3];
}

export function todayIso(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Relative to today — ISO dates compare correctly as strings. */
export function absenceStatus(a: Pick<Absence, "startsOn" | "endsOn">, today = todayIso()): AbsenceStatus {
  if (a.startsOn > today) return "upcoming";
  return a.endsOn && a.endsOn < today ? "ended" : "active";
}

function day(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "4 Oct – 20 Oct", "from 4 Oct, no return date" */
export function absencePeriod(a: Pick<Absence, "startsOn" | "endsOn">) {
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

/** "Back in 3 days", "Back tomorrow", "Out from Sat" */
export function returnHint(a: Pick<Absence, "startsOn" | "endsOn">) {
  const today = todayIso();
  if (a.startsOn > today) {
    const n = daysUntil(a.startsOn, today);
    return n === 1 ? "Out from tomorrow" : `Out in ${n} days`;
  }
  if (!a.endsOn) return "No return date";
  const n = daysUntil(a.endsOn, today) + 1;
  return n <= 0 ? "Back now" : n === 1 ? "Back tomorrow" : `Back in ${n} days`;
}

/**
 * The absence that matters for a player right now: the one they're serving,
 * else the next one coming up. Null when they're available.
 */
export function currentAbsence(absences: Absence[], playerId: number, today = todayIso()): Absence | null {
  const mine = absences.filter((a) => a.playerId === playerId);
  const active = mine.find((a) => absenceStatus(a, today) === "active");
  if (active) return active;
  const upcoming = mine.filter((a) => absenceStatus(a, today) === "upcoming").sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return upcoming[0] ?? null;
}
