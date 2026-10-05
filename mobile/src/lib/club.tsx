import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { ApiError, apiFetch, errorMessage } from "./api";
import { getItem, setItem } from "./storage";
import type { Absence, AbsenceType, Card, CardType, ClubSettings, MatchDayEvent, Player, Position, Membership } from "./types";

// Everything the app shows comes from five public endpoints, loaded together
// and refreshed on pull-to-refresh (and every 30s while a match day is live;
// match days alone every 5s while the admin Match Day screen is open).

// Mirrors PlayerRatings::defaultPositionWeights() on the backend.
const baseWeights = { win: 0.1, loss: 0.1, goal: 0.12, assist: 0.08, goalConceded: 0, save: 0.03, ownGoal: 0.08, yellowCard: 0.05, redCard: 0.15 };

/** The rating-weight fields, restorable as a group from Settings. */
export const DEFAULT_RATING_WEIGHTS = {
  ratingPositions: {
    GK: { ...baseWeights, cleanSheet: 0.15 },
    DEF: { ...baseWeights, cleanSheet: 0.12 },
    MID: { ...baseWeights, cleanSheet: 0.05 },
    FWD: { ...baseWeights, cleanSheet: 0 },
  },
  ratingMaxSwing: 0.5,
} satisfies Partial<ClubSettings>;

// Shown until the real settings load — same as frontend/src/lib/SettingsContext.tsx.
export const DEFAULT_SETTINGS: ClubSettings = {
  yellowCardFine: 2000,
  redCardFine: 5000,
  finesFromMatchDay: true,
  matchTeamSize: 6,
  matchWinGoals: 2,
  matchGameMinutes: 10,
  matchDefaultTeamMode: "random",
  matchDefaultVenue: "",
  ratingsEnabled: true,
  ratingNewPlayer: 6,
  ...DEFAULT_RATING_WEIGHTS,
  valeAutoAwards: true,
};
const LIVE_POLL_MS = 30000;
const MATCH_DAY_POLL_MS = 5000;
// Saves refused because someone else saved first are re-applied this often.
const MAX_CONFLICT_RETRIES = 5;
// Holds a player id. (The old "noisers_my_shirt" key held a shirt number,
// which would now point at the wrong player, so it is left behind.)
const MY_SHIRT_KEY = "noisers_my_player";

export interface NewCard {
  playerId: number;
  type: CardType;
  reason: string;
  fineAmount: number;
  paid: boolean;
}

export interface PlayerInput {
  number: number;
  name: string;
  position: Position;
  secondaryPosition: Position | null;
  membership: Membership;
  rating: number;
  photoUrl: string | null;
}

export interface AbsenceInput {
  playerId: number;
  type: AbsenceType;
  reason: string;
  startsOn: string;
  endsOn: string | null;
}

/** Match day fields the API accepts in a patch (camelCase here, snake_case on the wire). */
export type EventPatch = Partial<
  Pick<MatchDayEvent, "title" | "venue" | "date" | "status" | "presentPlayers" | "guests" | "groups" | "games">
>;

/**
 * A change to a match day: the fields to set, or — better when other admins
 * may be editing too — a function of the latest copy that returns them. A
 * function must be pure: it is re-run whenever the copy under it changes.
 */
export type EventEdit = EventPatch | ((event: MatchDayEvent) => EventPatch);

interface PendingEdit {
  edit: (event: MatchDayEvent) => EventPatch;
  done: (err?: unknown) => void;
  // Re-running an edit on the same copy gives back the same objects, so ids
  // it creates (e.g. the next game) stay put between renders and the save.
  cache?: { base: MatchDayEvent; patch: EventPatch; merged: MatchDayEvent };
}

function runEdit(p: PendingEdit, base: MatchDayEvent) {
  if (p.cache?.base !== base) {
    const patch = p.edit(base);
    p.cache = { base, patch, merged: { ...base, ...patch } };
  }
  return p.cache;
}

interface ClubContextValue {
  players: Player[];
  cards: Card[];
  events: MatchDayEvent[];
  settings: ClubSettings;
  /** Every logged absence, newest first — see lib/absences.ts. */
  absences: Absence[];
  /** True until the first load finishes (successfully or not). */
  loading: boolean;
  /** Set when the last refresh couldn't reach the API. */
  error: string;
  refresh: () => Promise<void>;
  myShirt: number | null;
  setMyShirt: (playerId: number | null) => void;
  addCard: (card: NewCard) => Promise<void>;
  setCardPaid: (id: number, paid: boolean) => Promise<void>;
  removeCard: (id: number) => Promise<void>;
  addPlayer: (player: PlayerInput) => Promise<Player>;
  updatePlayer: (id: number, player: PlayerInput) => Promise<void>;
  removePlayer: (id: number) => Promise<void>;
  /** Swap in a player the server just returned (e.g. after a profile edit). */
  replacePlayer: (player: Player) => void;
  addEvent: (event: MatchDayEvent) => Promise<void>;
  /** Shows the edit at once and saves it in order; rejects if the save fails. */
  updateEvent: (id: string, edit: EventEdit) => Promise<void>;
  /** Poll match days every few seconds until the returned stop function runs. */
  watchLive: () => () => void;
  removeEvent: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<ClubSettings>) => Promise<void>;
  addAbsence: (input: AbsenceInput) => Promise<void>;
  updateAbsence: (id: number, input: AbsenceInput) => Promise<void>;
  removeAbsence: (id: number) => Promise<void>;
}

const ClubContext = createContext<ClubContextValue | null>(null);

export function ClubProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [events, setEvents] = useState<MatchDayEvent[]>([]);
  const [settings, setSettings] = useState<ClubSettings>(DEFAULT_SETTINGS);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [myShirt, setMyShirtState] = useState<number | null>(null);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  // Several admins can record one match day at once. Every edit goes into a
  // per-match-day queue and is saved with the version it was built on; if
  // someone else saved first the server answers 409 with the latest copy,
  // and the edit is re-applied on top of that instead of overwriting it.
  // serverRef is the last copy the server confirmed; `events` adds the
  // edits not yet saved on top.
  const serverRef = useRef<MatchDayEvent[]>([]);
  const pendingRef = useRef(new Map<string, PendingEdit[]>());
  const savingRef = useRef(new Set<string>());
  const [watchers, setWatchers] = useState(0);

  const publishEvents = useCallback(() => {
    setEvents(serverRef.current.map((e) => (pendingRef.current.get(e.id) ?? []).reduce((acc, p) => runEdit(p, acc).merged, e)));
  }, []);

  // Never step back to an older copy — a poll can land after a save.
  const storeEvents = useCallback(
    (incoming: MatchDayEvent[]) => {
      const known = new Map(serverRef.current.map((e) => [e.id, e]));
      serverRef.current = incoming.map((raw) => {
        const e = normaliseEvent(raw);
        const mine = known.get(e.id);
        return mine && (mine.version ?? 0) > (e.version ?? 0) ? mine : e;
      });
      publishEvents();
    },
    [publishEvents],
  );

  function storeEvent(raw: MatchDayEvent) {
    const event = normaliseEvent(raw);
    const list = serverRef.current;
    const i = list.findIndex((e) => e.id === event.id);
    if (i === -1) serverRef.current = [...list, event];
    else if ((event.version ?? 0) >= (list[i].version ?? 0)) serverRef.current = list.map((e, j) => (j === i ? event : e));
  }

  const refresh = useCallback(async () => {
    const [p, c, e, s, a] = await Promise.allSettled([
      apiFetch<{ data: Player[] }>("/players?active_only=false"),
      apiFetch<{ data: Card[] }>("/cards"),
      apiFetch<{ data: MatchDayEvent[] }>("/match-day-events"),
      apiFetch<{ data: ClubSettings }>("/settings"),
      apiFetch<{ data: Absence[] }>("/player-absences"),
    ]);
    if (p.status === "fulfilled") setPlayers(p.value.data);
    if (c.status === "fulfilled") setCards(c.value.data);
    if (e.status === "fulfilled") storeEvents(e.value.data);
    if (s.status === "fulfilled") setSettings({ ...DEFAULT_SETTINGS, ...s.value.data });
    if (a.status === "fulfilled") setAbsences(a.value.data);

    const failed = [p, c, e, s, a].find((r) => r.status === "rejected");
    setError(failed ? errorMessage(failed.reason, "Couldn't load the latest club data.") : "");
    setLoading(false);
  }, [storeEvents]);

  const refreshEvents = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: MatchDayEvent[] }>("/match-day-events");
      storeEvents(res.data);
    } catch {
      // Offline for a moment — the next poll tries again.
    }
  }, [storeEvents]);

  useEffect(() => {
    refresh();
    getItem(MY_SHIRT_KEY).then((v) => {
      if (v !== null && !Number.isNaN(Number(v))) setMyShirtState(Number(v));
    });
  }, [refresh]);

  // Keep scores moving while a match day is being played.
  const hasLive = events.some((e) => e.status === "live");
  useEffect(() => {
    if (!hasLive) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") refresh();
    }, LIVE_POLL_MS);
    return () => clearInterval(timer);
  }, [hasLive, refresh]);

  // Keep up with other admins while the Match Day screen is open.
  useEffect(() => {
    if (!watchers || !hasLive) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") refreshEvents();
    }, MATCH_DAY_POLL_MS);
    return () => clearInterval(timer);
  }, [watchers, hasLive, refreshEvents]);

  const watchLive = useCallback(() => {
    setWatchers((n) => n + 1);
    return () => setWatchers((n) => n - 1);
  }, []);

  function setMyShirt(playerId: number | null) {
    setMyShirtState(playerId);
    setItem(MY_SHIRT_KEY, playerId === null ? null : String(playerId));
  }

  async function addCard(card: NewCard) {
    const res = await apiFetch<{ data: Card }>("/cards", {
      method: "POST",
      body: {
        player_id: card.playerId,
        type: card.type,
        reason: card.reason || null,
        fine_amount: card.fineAmount,
        paid: card.paid,
        occurred_on: new Date().toISOString().slice(0, 10),
      },
    });
    setCards((prev) => [res.data, ...prev]);
  }

  async function setCardPaid(id: number, paid: boolean) {
    const previous = cardsRef.current;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, paid } : c)));
    try {
      const res = await apiFetch<{ data: Card }>(`/cards/${id}`, { method: "PUT", body: { paid } });
      setCards((prev) => prev.map((c) => (c.id === id ? res.data : c)));
    } catch (err) {
      setCards(previous);
      throw err;
    }
  }

  async function removeCard(id: number) {
    await apiFetch(`/cards/${id}`, { method: "DELETE" });
    setCards((prev) => prev.filter((c) => c.id !== id));
    // A match day card also comes off its game on the server, which can
    // move stats, ratings and The Vale — reload them.
    refresh();
  }

  async function addPlayer(player: PlayerInput) {
    const res = await apiFetch<{ data: Player }>("/players", { method: "POST", body: playerBody(player) });
    setPlayers((prev) => [...prev, res.data]);
    return res.data;
  }

  async function updatePlayer(id: number, player: PlayerInput) {
    const res = await apiFetch<{ data: Player }>(`/players/${id}`, { method: "PUT", body: playerBody(player) });
    setPlayers((prev) => prev.map((p) => (p.id === id ? res.data : p)));
  }

  async function removePlayer(id: number) {
    await apiFetch(`/players/${id}`, { method: "DELETE" });
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  async function addEvent(event: MatchDayEvent) {
    const res = await apiFetch<{ data: MatchDayEvent }>("/match-day-events", {
      method: "POST",
      body: { id: event.id, ...eventBody(event) },
    });
    storeEvent(res.data);
    publishEvents();
  }

  // Match day edits show at once — the pitch-side screen has to feel
  // instant — and are saved one at a time per match day.
  function updateEvent(id: string, edit: EventEdit) {
    return new Promise<void>((resolve, reject) => {
      const queue = pendingRef.current.get(id) ?? [];
      queue.push({ edit: typeof edit === "function" ? edit : () => edit, done: (err) => (err === undefined ? resolve() : reject(err)) });
      pendingRef.current.set(id, queue);
      publishEvents();
      flushEvent(id);
    });
  }

  async function flushEvent(id: string) {
    if (savingRef.current.has(id)) return;
    savingRef.current.add(id);
    let conflicts = 0;
    try {
      for (;;) {
        const queue = pendingRef.current.get(id);
        const head = queue?.[0];
        if (!queue || !head) break;
        const base = serverRef.current.find((e) => e.id === id);
        const finish = (err?: unknown) => {
          queue.shift();
          head.done(err);
          conflicts = 0;
          publishEvents();
        };
        if (!base) {
          finish(new ApiError("That match day no longer exists.", 404));
          continue;
        }

        const body = eventBody(runEdit(head, base).patch);
        if (Object.keys(body).length === 0) {
          finish();
          continue;
        }
        try {
          const res = await apiFetch<{ data: MatchDayEvent }>(`/match-day-events/${id}`, {
            method: "PUT",
            body: { ...body, version: base.version },
          });
          storeEvent(res.data);
          finish();
        } catch (err) {
          if (err instanceof ApiError && err.status === 409 && conflicts < MAX_CONFLICT_RETRIES) {
            // Someone else saved first — build this edit again on their copy.
            conflicts += 1;
            const latest = (err.body as { data?: MatchDayEvent } | null)?.data;
            if (latest) storeEvent(latest);
            else await refreshEvents();
            publishEvents();
            continue;
          }
          finish(err);
        }
      }
    } finally {
      savingRef.current.delete(id);
    }
  }

  // Deleting also rolls back the day's cards, ratings and The Vale on the
  // server, so reload everything afterwards.
  async function removeEvent(id: string) {
    await apiFetch(`/match-day-events/${id}`, { method: "DELETE" });
    serverRef.current = serverRef.current.filter((e) => e.id !== id);
    for (const p of pendingRef.current.get(id) ?? []) p.done(new ApiError("That match day was deleted.", 404));
    pendingRef.current.delete(id);
    publishEvents();
    refresh();
  }

  function replacePlayer(player: Player) {
    setPlayers((prev) => prev.map((p) => (p.id === player.id ? player : p)));
  }

  async function updateSettings(patch: Partial<ClubSettings>) {
    const body = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), v]));
    const res = await apiFetch<{ data: ClubSettings }>("/settings", { method: "PUT", body });
    setSettings({ ...DEFAULT_SETTINGS, ...res.data });
  }

  // Absences feed the Noisers blog and team picking, so they save first.
  async function addAbsence(input: AbsenceInput) {
    const res = await apiFetch<{ data: Absence }>("/player-absences", { method: "POST", body: absenceBody(input) });
    setAbsences((prev) => [res.data, ...prev]);
  }

  async function updateAbsence(id: number, input: AbsenceInput) {
    const res = await apiFetch<{ data: Absence }>(`/player-absences/${id}`, { method: "PUT", body: absenceBody(input) });
    setAbsences((prev) => prev.map((x) => (x.id === id ? res.data : x)));
  }

  async function removeAbsence(id: number) {
    await apiFetch(`/player-absences/${id}`, { method: "DELETE" });
    setAbsences((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <ClubContext
      value={{
        players,
        cards,
        events,
        settings,
        absences,
        loading,
        error,
        refresh,
        myShirt,
        setMyShirt,
        addCard,
        setCardPaid,
        removeCard,
        addPlayer,
        updatePlayer,
        removePlayer,
        replacePlayer,
        addEvent,
        updateEvent,
        watchLive,
        removeEvent,
        updateSettings,
        addAbsence,
        updateAbsence,
        removeAbsence,
      }}
    >
      {children}
    </ClubContext>
  );
}

function playerBody(p: PlayerInput) {
  return {
    number: p.number,
    name: p.name.trim(),
    position: p.position,
    secondary_position: p.secondaryPosition,
    membership: p.membership,
    rating: p.rating,
    photo_url: p.photoUrl || null,
  };
}

function absenceBody(a: AbsenceInput) {
  return {
    player_id: a.playerId,
    type: a.type,
    reason: a.reason.trim() || null,
    starts_on: a.startsOn,
    ends_on: a.endsOn || null,
  };
}

function eventBody(patch: EventPatch) {
  const body: Record<string, unknown> = {};
  if (patch.venue !== undefined) body.venue = patch.venue;
  if (patch.date !== undefined) body.date = patch.date;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.presentPlayers !== undefined) body.present_players = patch.presentPlayers;
  if (patch.guests !== undefined) body.guests = patch.guests;
  if (patch.groups !== undefined) body.groups = patch.groups;
  if (patch.games !== undefined) body.games = patch.games;
  return body;
}

function normaliseEvent(e: MatchDayEvent): MatchDayEvent {
  return {
    ...e,
    presentPlayers: e.presentPlayers ?? [],
    guests: e.guests ?? [],
    groups: e.groups ?? [],
    games: e.games ?? [],
  };
}

export function useClub() {
  const ctx = use(ClubContext);
  if (!ctx) throw new Error("useClub must be used within a ClubProvider");
  return ctx;
}
