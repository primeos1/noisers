import { createContext, useContext, type ReactNode } from "react";
import { seedCards, type CardRecord } from "./cards";
import { useLocalStorageState } from "./useLocalStorageState";

interface CardsContextValue {
  cards: CardRecord[];
  addCard: (card: CardRecord) => void;
  updateCard: (id: string, patch: Partial<CardRecord>) => void;
  removeCard: (id: string) => void;
  togglePaid: (id: string) => void;
}

const CardsContext = createContext<CardsContextValue | null>(null);

export function CardsProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useLocalStorageState<CardRecord[]>("noisers_cards", seedCards);

  function addCard(card: CardRecord) {
    setCards((prev) => [...prev, card]);
  }

  function updateCard(id: string, patch: Partial<CardRecord>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  function togglePaid(id: string) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, paid: !c.paid } : c)));
  }

  return (
    <CardsContext.Provider value={{ cards, addCard, updateCard, removeCard, togglePaid }}>
      {children}
    </CardsContext.Provider>
  );
}

export function useCards() {
  const ctx = useContext(CardsContext);
  if (!ctx) throw new Error("useCards must be used within a CardsProvider");
  return ctx;
}
