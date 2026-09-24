import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, ApiError } from "./api";
import type { MatchDayEvent } from "./matchDay";

interface ApiMatchDayEvent {
  id: string;
  title: string;
  venue: string | null;
  date: string;
  createdAt: string | null;
  presentPlayers: number[];
  guests: MatchDayEvent["guests"];
  groups: MatchDayEvent["groups"];
  games: MatchDayEvent["games"];
  status: MatchDayEvent["status"];
}

function fromApi(e: ApiMatchDayEvent): MatchDayEvent {
  return {
    id: e.id,
    title: e.title,
    venue: e.venue ?? "",
    date: e.date,
    createdAt: e.createdAt ?? "",
    presentPlayers: e.presentPlayers ?? [],
    guests: e.guests ?? [],
    groups: e.groups ?? [],
    games: e.games ?? [],
    status: e.status,
  };
}

function toApiBody(patch: Partial<MatchDayEvent>) {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.venue !== undefined) body.venue = patch.venue;
  if (patch.date !== undefined) body.date = patch.date;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.presentPlayers !== undefined) body.present_players = patch.presentPlayers;
  if (patch.guests !== undefined) body.guests = patch.guests;
  if (patch.groups !== undefined) body.groups = patch.groups;
  if (patch.games !== undefined) body.games = patch.games;
  return body;
}

interface MatchDayContextValue {
  events: MatchDayEvent[];
  loading: boolean;
  error: string;
  addEvent: (event: MatchDayEvent) => void;
  updateEvent: (id: string, patch: Partial<MatchDayEvent>) => Promise<boolean>;
  removeEvent: (id: string) => void;
}

const MatchDayContext = createContext<MatchDayContextValue | null>(null);

export function MatchDayProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<MatchDayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ data: ApiMatchDayEvent[] }>("/match-day-events")
      .then((res) => setEvents(res.data.map(fromApi)))
      .catch(() => {
        // API unreachable — app still works with an empty history.
      })
      .finally(() => setLoading(false));
  }, []);

  function addEvent(event: MatchDayEvent) {
    setError("");
    setEvents((prev) => [...prev, event]);
    apiFetch<{ data: ApiMatchDayEvent }>("/match-day-events", {
      method: "POST",
      body: JSON.stringify({ id: event.id, ...toApiBody(event) }),
    })
      .then((res) => {
        const created = fromApi(res.data);
        setEvents((prev) => prev.map((e) => (e.id === event.id ? created : e)));
      })
      .catch((err) => {
        setEvents((prev) => prev.filter((e) => e.id !== event.id));
        setError(err instanceof ApiError ? err.message : "Couldn't create that match day.");
      });
  }

  function updateEvent(id: string, patch: Partial<MatchDayEvent>) {
    setError("");
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    // Resolves true once saved, so callers can reload data derived from it.
    return apiFetch<{ data: ApiMatchDayEvent }>(`/match-day-events/${id}`, {
      method: "PUT",
      body: JSON.stringify(toApiBody(patch)),
    })
      .then(() => true)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Couldn't save that change — it may not have persisted.");
        return false;
      });
  }

  function removeEvent(id: string) {
    setError("");
    const previous = events;
    setEvents((prev) => prev.filter((e) => e.id !== id));
    apiFetch(`/match-day-events/${id}`, { method: "DELETE" }).catch((err) => {
      setEvents(previous);
      setError(err instanceof ApiError ? err.message : "Couldn't remove that match day.");
    });
  }

  return (
    <MatchDayContext.Provider value={{ events, loading, error, addEvent, updateEvent, removeEvent }}>
      {children}
    </MatchDayContext.Provider>
  );
}

export function useMatchDay() {
  const ctx = useContext(MatchDayContext);
  if (!ctx) throw new Error("useMatchDay must be used within a MatchDayProvider");
  return ctx;
}
