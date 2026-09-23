import { createContext, useContext, type ReactNode } from "react";
import { useLocalStorageState } from "./useLocalStorageState";
import type { MatchDayEvent } from "./matchDay";

interface MatchDayContextValue {
  events: MatchDayEvent[];
  addEvent: (event: MatchDayEvent) => void;
  updateEvent: (id: string, patch: Partial<MatchDayEvent>) => void;
  removeEvent: (id: string) => void;
}

const MatchDayContext = createContext<MatchDayContextValue | null>(null);

export function MatchDayProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useLocalStorageState<MatchDayEvent[]>("noisers_matchday_events", []);

  function addEvent(event: MatchDayEvent) {
    setEvents((prev) => [...prev, event]);
  }

  function updateEvent(id: string, patch: Partial<MatchDayEvent>) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removeEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <MatchDayContext.Provider value={{ events, addEvent, updateEvent, removeEvent }}>
      {children}
    </MatchDayContext.Provider>
  );
}

export function useMatchDay() {
  const ctx = useContext(MatchDayContext);
  if (!ctx) throw new Error("useMatchDay must be used within a MatchDayProvider");
  return ctx;
}
