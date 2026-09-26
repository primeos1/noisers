import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { seedCards, type CardRecord, type CardType } from "./cards";
import { apiFetch, ApiError } from "./api";
import { useAuth } from "./AuthContext";

interface ApiCard {
  id: number;
  playerId: number;
  type: CardType;
  reason: string | null;
  fineAmount: number;
  paid: boolean;
  occurredOn: string | null;
  createdAt: string | null;
}

function formatDate(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function fromApi(c: ApiCard): CardRecord {
  return {
    id: String(c.id),
    playerId: c.playerId,
    type: c.type,
    reason: c.reason ?? "",
    fine: c.fineAmount,
    paid: c.paid,
    date: formatDate(c.occurredOn ?? c.createdAt),
  };
}

interface CardsContextValue {
  cards: CardRecord[];
  loading: boolean;
  error: string;
  addCard: (card: CardRecord) => void;
  updateCard: (id: string, patch: Partial<CardRecord>) => void;
  removeCard: (id: string) => void;
  togglePaid: (id: string) => void;
  refresh: () => Promise<void>;
}

const CardsContext = createContext<CardsContextValue | null>(null);

export function CardsProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<CardRecord[]>(seedCards);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  const { user } = useAuth();

  function refresh() {
    return apiFetch<{ data: ApiCard[] }>("/cards")
      .then((res) => setCards(res.data.map(fromApi)))
      .catch(() => {
        // API unreachable (or signed out) — keep the current cards.
      });
  }

  // /cards needs a staff token, so reload once an admin signs in — otherwise
  // the page keeps showing the seed cards from before login.
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [user?.role]);

  function addCard(card: CardRecord) {
    setError("");
    apiFetch<{ data: ApiCard }>("/cards", {
      method: "POST",
      body: JSON.stringify({
        player_id: card.playerId,
        type: card.type,
        reason: card.reason,
        fine_amount: card.fine,
        paid: card.paid,
      }),
    })
      .then((res) => setCards((prev) => [...prev, fromApi(res.data)]))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't add that card."));
  }

  function updateCard(id: string, patch: Partial<CardRecord>) {
    setError("");
    const previous = cardsRef.current;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    apiFetch<{ data: ApiCard }>(`/cards/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...(patch.type !== undefined && { type: patch.type }),
        ...(patch.reason !== undefined && { reason: patch.reason }),
        ...(patch.fine !== undefined && { fine_amount: patch.fine }),
        ...(patch.paid !== undefined && { paid: patch.paid }),
      }),
    })
      .then((res) => {
        const updated = fromApi(res.data);
        setCards((prev) => prev.map((c) => (c.id === id ? updated : c)));
      })
      .catch((err) => {
        setCards(previous);
        setError(err instanceof ApiError ? err.message : "Couldn't save that card.");
      });
  }

  function removeCard(id: string) {
    setError("");
    const previous = cardsRef.current;
    setCards((prev) => prev.filter((c) => c.id !== id));
    apiFetch(`/cards/${id}`, { method: "DELETE" }).catch((err) => {
      setCards(previous);
      setError(err instanceof ApiError ? err.message : "Couldn't remove that card.");
    });
  }

  function togglePaid(id: string) {
    const card = cardsRef.current.find((c) => c.id === id);
    if (!card) return;
    updateCard(id, { paid: !card.paid });
  }

  return (
    <CardsContext.Provider value={{ cards, loading, error, addCard, updateCard, removeCard, togglePaid, refresh }}>
      {children}
    </CardsContext.Provider>
  );
}

export function useCards() {
  const ctx = useContext(CardsContext);
  if (!ctx) throw new Error("useCards must be used within a CardsProvider");
  return ctx;
}
