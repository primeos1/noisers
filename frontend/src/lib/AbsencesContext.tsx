import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, ApiError } from "./api";
import { currentAbsence, type Absence, type AbsenceType } from "./absences";

interface ApiAbsence {
  id: number;
  playerId: number;
  type: AbsenceType;
  reason: string | null;
  startsOn: string;
  endsOn: string | null;
}

function fromApi(a: ApiAbsence): Absence {
  return {
    id: String(a.id),
    playerId: a.playerId,
    type: a.type,
    reason: a.reason ?? "",
    startsOn: a.startsOn,
    endsOn: a.endsOn,
  };
}

export type AbsenceInput = Omit<Absence, "id">;

function toApiBody(input: Partial<AbsenceInput>) {
  const body: Record<string, unknown> = {};
  if (input.playerId !== undefined) body.player_id = input.playerId;
  if (input.type !== undefined) body.type = input.type;
  if (input.reason !== undefined) body.reason = input.reason.trim() || null;
  if (input.startsOn !== undefined) body.starts_on = input.startsOn;
  if (input.endsOn !== undefined) body.ends_on = input.endsOn || null;
  return body;
}

interface AbsencesContextValue {
  absences: Absence[];
  loading: boolean;
  /** What's keeping a player out now (or next), if anything. */
  absenceFor: (playerId: number) => Absence | null;
  addAbsence: (input: AbsenceInput) => Promise<void>;
  updateAbsence: (id: string, patch: Partial<AbsenceInput>) => Promise<void>;
  removeAbsence: (id: string) => Promise<void>;
}

const AbsencesContext = createContext<AbsencesContextValue | null>(null);

function message(err: unknown, fallback: string) {
  return new Error(err instanceof ApiError ? err.message : fallback);
}

export function AbsencesProvider({ children }: { children: ReactNode }) {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: ApiAbsence[] }>("/player-absences")
      .then((res) => setAbsences(res.data.map(fromApi)))
      .catch(() => {
        // API unreachable — everyone shows as available.
      })
      .finally(() => setLoading(false));
  }, []);

  async function addAbsence(input: AbsenceInput) {
    try {
      const res = await apiFetch<{ data: ApiAbsence }>("/player-absences", {
        method: "POST",
        body: JSON.stringify(toApiBody(input)),
      });
      setAbsences((prev) => [fromApi(res.data), ...prev]);
    } catch (err) {
      throw message(err, "Couldn't save that.");
    }
  }

  async function updateAbsence(id: string, patch: Partial<AbsenceInput>) {
    try {
      const res = await apiFetch<{ data: ApiAbsence }>(`/player-absences/${id}`, {
        method: "PUT",
        body: JSON.stringify(toApiBody(patch)),
      });
      setAbsences((prev) => prev.map((a) => (a.id === id ? fromApi(res.data) : a)));
    } catch (err) {
      throw message(err, "Couldn't save that.");
    }
  }

  async function removeAbsence(id: string) {
    try {
      await apiFetch(`/player-absences/${id}`, { method: "DELETE" });
      setAbsences((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      throw message(err, "Couldn't remove that.");
    }
  }

  return (
    <AbsencesContext.Provider
      value={{
        absences,
        loading,
        absenceFor: (playerId) => currentAbsence(absences, playerId),
        addAbsence,
        updateAbsence,
        removeAbsence,
      }}
    >
      {children}
    </AbsencesContext.Provider>
  );
}

export function useAbsences() {
  const ctx = useContext(AbsencesContext);
  if (!ctx) throw new Error("useAbsences must be used within an AbsencesProvider");
  return ctx;
}
