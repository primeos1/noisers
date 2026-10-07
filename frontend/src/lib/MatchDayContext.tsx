import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { apiFetch, ApiError } from "./api";
import type { MatchDayEvent } from "./matchDay";

interface ApiMatchDayEvent {
  id: string;
  title: string;
  venue: string | null;
  date: string;
  createdAt: string | null;
  week?: number;
  presentPlayers: number[];
  guests: MatchDayEvent["guests"];
  groups: MatchDayEvent["groups"];
  games: MatchDayEvent["games"];
  status: MatchDayEvent["status"];
  teamMode?: MatchDayEvent["teamMode"];
  version?: number;
}

function fromApi(e: ApiMatchDayEvent): MatchDayEvent {
  return {
    id: e.id,
    title: e.title,
    venue: e.venue ?? "",
    date: e.date,
    createdAt: e.createdAt ?? "",
    week: e.week,
    presentPlayers: e.presentPlayers ?? [],
    guests: e.guests ?? [],
    groups: e.groups ?? [],
    games: e.games ?? [],
    status: e.status,
    teamMode: e.teamMode ?? null,
    version: e.version ?? 0,
  };
}

function toApiBody(patch: Partial<MatchDayEvent>) {
  const body: Record<string, unknown> = {};
  if (patch.venue !== undefined) body.venue = patch.venue;
  if (patch.date !== undefined) body.date = patch.date;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.presentPlayers !== undefined) body.present_players = patch.presentPlayers;
  if (patch.guests !== undefined) body.guests = patch.guests;
  if (patch.groups !== undefined) body.groups = patch.groups;
  if (patch.games !== undefined) body.games = patch.games;
  if (patch.teamMode !== undefined) body.team_mode = patch.teamMode;
  return body;
}

/**
 * A change to a match day: the fields to set, or — better when other admins
 * may be editing too — a function of the latest copy that returns them. A
 * function must be pure: it is re-run whenever the copy under it changes.
 */
export type EventEdit = Partial<MatchDayEvent> | ((event: MatchDayEvent) => Partial<MatchDayEvent>);

// How often the Match Day screen checks for other admins' changes.
const LIVE_POLL_MS = 4000;
// Saves refused because someone else saved first are re-applied this often.
const MAX_CONFLICT_RETRIES = 5;

interface PendingEdit {
  edit: (event: MatchDayEvent) => Partial<MatchDayEvent>;
  done: (saved: boolean) => void;
  // Re-running an edit on the same copy gives back the same objects, so ids
  // it creates (e.g. the next game) stay put between renders and the save.
  cache?: { base: MatchDayEvent; patch: Partial<MatchDayEvent>; merged: MatchDayEvent };
}

function run(p: PendingEdit, base: MatchDayEvent) {
  if (p.cache?.base !== base) {
    const patch = p.edit(base);
    p.cache = { base, patch, merged: { ...base, ...patch } };
  }
  return p.cache;
}

interface MatchDayContextValue {
  events: MatchDayEvent[];
  loading: boolean;
  error: string;
  addEvent: (event: MatchDayEvent) => void;
  /** Shows the edit at once and saves it in order; resolves true once saved. */
  updateEvent: (id: string, edit: EventEdit) => Promise<boolean>;
  removeEvent: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  /** Poll for other admins' changes until the returned stop function runs. */
  watchLive: () => () => void;
}

const MatchDayContext = createContext<MatchDayContextValue | null>(null);

/**
 * Several admins can record one match day at once. Every edit goes into a
 * per-match-day queue and is saved with the version it was built on; if
 * someone else saved first the server answers 409 with the latest copy, and
 * the edit is re-applied on top of that instead of overwriting it.
 */
export function MatchDayProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<MatchDayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [watchers, setWatchers] = useState(0);

  // The last copy the server confirmed, plus edits not yet saved on top.
  const serverRef = useRef<MatchDayEvent[]>([]);
  const pendingRef = useRef(new Map<string, PendingEdit[]>());
  const savingRef = useRef(new Set<string>());
  const creatingRef = useRef(new Set<string>());
  const fetchingRef = useRef(false);

  function publish() {
    setEvents(
      serverRef.current.map((e) => (pendingRef.current.get(e.id) ?? []).reduce((acc, p) => run(p, acc).merged, e)),
    );
  }

  // Never step back to an older copy — a poll can land after a save.
  function storeServer(event: MatchDayEvent) {
    const list = serverRef.current;
    const i = list.findIndex((e) => e.id === event.id);
    if (i === -1) serverRef.current = [...list, event];
    else if ((event.version ?? 0) >= (list[i].version ?? 0)) serverRef.current = list.map((e, j) => (j === i ? event : e));
  }

  function refresh() {
    if (fetchingRef.current) return Promise.resolve();
    fetchingRef.current = true;
    return apiFetch<{ data: ApiMatchDayEvent[] }>("/match-day-events")
      .then((res) => {
        const known = new Map(serverRef.current.map((e) => [e.id, e]));
        const incoming = res.data.map((raw) => {
          const e = fromApi(raw);
          const mine = known.get(e.id);
          return mine && (mine.version ?? 0) > (e.version ?? 0) ? mine : e;
        });
        // Still being created — the list just doesn't have it yet.
        const creating = serverRef.current.filter((e) => creatingRef.current.has(e.id) && !incoming.some((x) => x.id === e.id));
        serverRef.current = [...incoming, ...creating];
        publish();
      })
      .catch(() => {
        // API unreachable — app still works with an empty history.
      })
      .finally(() => {
        fetchingRef.current = false;
      });
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const hasLive = events.some((e) => e.status === "live");
  useEffect(() => {
    if (!watchers || !hasLive) return;
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(tick, LIVE_POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [watchers, hasLive]);

  const watchLive = useCallback(() => {
    setWatchers((n) => n + 1);
    return () => setWatchers((n) => n - 1);
  }, []);

  function dropPending(id: string) {
    for (const p of pendingRef.current.get(id) ?? []) p.done(false);
    pendingRef.current.delete(id);
  }

  async function flush(id: string) {
    if (savingRef.current.has(id) || creatingRef.current.has(id)) return;
    savingRef.current.add(id);
    let conflicts = 0;
    try {
      for (;;) {
        const queue = pendingRef.current.get(id);
        const head = queue?.[0];
        if (!queue || !head) break;
        const base = serverRef.current.find((e) => e.id === id);
        if (!base) {
          dropPending(id);
          break;
        }
        const finish = (saved: boolean) => {
          queue.shift();
          head.done(saved);
          conflicts = 0;
          publish();
        };

        const body = toApiBody(run(head, base).patch);
        if (Object.keys(body).length === 0) {
          finish(true);
          continue;
        }
        try {
          const res = await apiFetch<{ data: ApiMatchDayEvent }>(`/match-day-events/${id}`, {
            method: "PUT",
            body: JSON.stringify({ ...body, version: base.version }),
          });
          storeServer(fromApi(res.data));
          finish(true);
        } catch (err) {
          if (err instanceof ApiError && err.status === 409 && conflicts < MAX_CONFLICT_RETRIES) {
            // Someone else saved first — build this edit again on their copy.
            conflicts += 1;
            const latest = (err.body as { data?: ApiMatchDayEvent } | null)?.data;
            if (latest) storeServer(fromApi(latest));
            else await refresh();
            publish();
            continue;
          }
          setError(err instanceof ApiError ? err.message : "Couldn't save that change — it may not have persisted.");
          finish(false);
        }
      }
    } finally {
      savingRef.current.delete(id);
    }
  }

  function addEvent(event: MatchDayEvent) {
    setError("");
    creatingRef.current.add(event.id);
    storeServer(event);
    publish();
    apiFetch<{ data: ApiMatchDayEvent }>("/match-day-events", {
      method: "POST",
      body: JSON.stringify({ id: event.id, ...toApiBody(event) }),
    })
      .then((res) => {
        creatingRef.current.delete(event.id);
        storeServer(fromApi(res.data));
        publish();
        // Edits made while it was being created go out now.
        flush(event.id);
      })
      .catch((err) => {
        creatingRef.current.delete(event.id);
        serverRef.current = serverRef.current.filter((e) => e.id !== event.id);
        dropPending(event.id);
        publish();
        setError(err instanceof ApiError ? err.message : "Couldn't create that match day.");
      });
  }

  function updateEvent(id: string, edit: EventEdit) {
    setError("");
    return new Promise<boolean>((resolve) => {
      const queue = pendingRef.current.get(id) ?? [];
      queue.push({ edit: typeof edit === "function" ? edit : () => edit, done: resolve });
      pendingRef.current.set(id, queue);
      publish();
      flush(id);
    });
  }

  // Waits for the server (deleting also rolls back cards, ratings and The
  // Vale), and resolves true once done so callers can reload that data.
  // The match days after it are renumbered, so reload them too.
  function removeEvent(id: string) {
    setError("");
    return apiFetch(`/match-day-events/${id}`, { method: "DELETE" })
      .then(() => {
        serverRef.current = serverRef.current.filter((e) => e.id !== id);
        dropPending(id);
        publish();
        refresh();
        return true;
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Couldn't delete that match day.");
        return false;
      });
  }

  return (
    <MatchDayContext.Provider value={{ events, loading, error, addEvent, updateEvent, removeEvent, refresh, watchLive }}>
      {children}
    </MatchDayContext.Provider>
  );
}

export function useMatchDay() {
  const ctx = useContext(MatchDayContext);
  if (!ctx) throw new Error("useMatchDay must be used within a MatchDayProvider");
  return ctx;
}
