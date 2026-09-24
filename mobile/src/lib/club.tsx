import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { apiFetch, errorMessage } from "./api";
import { getItem, setItem } from "./storage";
import type { Card, CardType, ClubSettings, MatchDayEvent, Player, Position } from "./types";

// Everything the app shows comes from four public endpoints, loaded together
// and refreshed on pull-to-refresh (and every 30s while a match day is live).

/** The rating-weight fields, restorable as a group from Settings. */
export const DEFAULT_RATING_WEIGHTS = {
  ratingWin: 0.1,
  ratingLoss: 0.1,
  ratingGoal: 0.12,
  ratingAssist: 0.08,
  ratingOwnGoal: 0.08,
  ratingCleanSheetGk: 0.15,
  ratingCleanSheetDef: 0.12,
  ratingCleanSheetMid: 0.05,
  ratingCleanSheetFwd: 0,
  ratingYellowCard: 0.05,
  ratingRedCard: 0.15,
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
const MY_SHIRT_KEY = "noisers_my_shirt";

export interface NewCard {
  playerNumber: number;
  type: CardType;
  reason: string;
  fineAmount: number;
  paid: boolean;
}

export interface PlayerInput {
  number: number;
  name: string;
  position: Position;
  rating: number;
  photoUrl: string | null;
}

/** Match day fields the API accepts in a patch (camelCase here, snake_case on the wire). */
export type EventPatch = Partial<
  Pick<MatchDayEvent, "title" | "venue" | "date" | "status" | "presentPlayers" | "guests" | "groups" | "games">
>;

interface ClubContextValue {
  players: Player[];
  cards: Card[];
  events: MatchDayEvent[];
  settings: ClubSettings;
  /** True until the first load finishes (successfully or not). */
  loading: boolean;
  /** Set when the last refresh couldn't reach the API. */
  error: string;
  refresh: () => Promise<void>;
  myShirt: number | null;
  setMyShirt: (number: number | null) => void;
  addCard: (card: NewCard) => Promise<void>;
  setCardPaid: (id: number, paid: boolean) => Promise<void>;
  removeCard: (id: number) => Promise<void>;
  addPlayer: (player: PlayerInput) => Promise<void>;
  updatePlayer: (number: number, player: PlayerInput) => Promise<void>;
  removePlayer: (number: number) => Promise<void>;
  addEvent: (event: MatchDayEvent) => Promise<void>;
  /** Applies the patch at once and saves it; rolls back and rethrows if the save fails. */
  updateEvent: (id: string, patch: EventPatch) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<ClubSettings>) => Promise<void>;
}

const ClubContext = createContext<ClubContextValue | null>(null);

export function ClubProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [events, setEvents] = useState<MatchDayEvent[]>([]);
  const [settings, setSettings] = useState<ClubSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [myShirt, setMyShirtState] = useState<number | null>(null);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const refresh = useCallback(async () => {
    const [p, c, e, s] = await Promise.allSettled([
      apiFetch<{ data: Player[] }>("/players?active_only=false"),
      apiFetch<{ data: Card[] }>("/cards"),
      apiFetch<{ data: MatchDayEvent[] }>("/match-day-events"),
      apiFetch<{ data: ClubSettings }>("/settings"),
    ]);
    if (p.status === "fulfilled") setPlayers(p.value.data);
    if (c.status === "fulfilled") setCards(c.value.data);
    if (e.status === "fulfilled") setEvents(e.value.data.map(normaliseEvent));
    if (s.status === "fulfilled") setSettings({ ...DEFAULT_SETTINGS, ...s.value.data });

    const failed = [p, c, e, s].find((r) => r.status === "rejected");
    setError(failed ? errorMessage(failed.reason, "Couldn't load the latest club data.") : "");
    setLoading(false);
  }, []);

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

  function setMyShirt(number: number | null) {
    setMyShirtState(number);
    setItem(MY_SHIRT_KEY, number === null ? null : String(number));
  }

  async function addCard(card: NewCard) {
    const res = await apiFetch<{ data: Card }>("/cards", {
      method: "POST",
      body: {
        player_number: card.playerNumber,
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
  }

  async function addPlayer(player: PlayerInput) {
    const res = await apiFetch<{ data: Player }>("/players", { method: "POST", body: playerBody(player) });
    setPlayers((prev) => [...prev, res.data]);
  }

  async function updatePlayer(number: number, player: PlayerInput) {
    const res = await apiFetch<{ data: Player }>(`/players/${number}`, { method: "PUT", body: playerBody(player) });
    setPlayers((prev) => prev.map((p) => (p.number === number ? res.data : p)));
  }

  async function removePlayer(number: number) {
    await apiFetch(`/players/${number}`, { method: "DELETE" });
    setPlayers((prev) => prev.filter((p) => p.number !== number));
  }

  async function addEvent(event: MatchDayEvent) {
    const res = await apiFetch<{ data: MatchDayEvent }>("/match-day-events", {
      method: "POST",
      body: { id: event.id, ...eventBody(event) },
    });
    setEvents((prev) => [...prev, normaliseEvent(res.data)]);
  }

  // Match day edits are applied optimistically — the pitch-side screen has to
  // feel instant. Every patch carries whole arrays built on the latest local
  // state, so a failed save is fixed by the next one; like the web, it isn't
  // rolled back (that would also undo later edits made on top of it).
  async function updateEvent(id: string, patch: EventPatch) {
    const next = eventsRef.current.map((e) => (e.id === id ? { ...e, ...patch } : e));
    eventsRef.current = next;
    setEvents(next);
    await apiFetch(`/match-day-events/${id}`, { method: "PUT", body: eventBody(patch) });
  }

  // Deleting also rolls back the day's cards, ratings and The Vale on the
  // server, so reload everything afterwards.
  async function removeEvent(id: string) {
    await apiFetch(`/match-day-events/${id}`, { method: "DELETE" });
    setEvents((prev) => prev.filter((e) => e.id !== id));
    refresh();
  }

  async function updateSettings(patch: Partial<ClubSettings>) {
    const body = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), v]));
    const res = await apiFetch<{ data: ClubSettings }>("/settings", { method: "PUT", body });
    setSettings({ ...DEFAULT_SETTINGS, ...res.data });
  }

  return (
    <ClubContext
      value={{
        players,
        cards,
        events,
        settings,
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
        addEvent,
        updateEvent,
        removeEvent,
        updateSettings,
      }}
    >
      {children}
    </ClubContext>
  );
}

function playerBody(p: PlayerInput) {
  return { number: p.number, name: p.name.trim(), position: p.position, rating: p.rating, photo_url: p.photoUrl || null };
}

function eventBody(patch: EventPatch) {
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
