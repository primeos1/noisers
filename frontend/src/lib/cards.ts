// Disciplinary ledger — sample content shaped like the future API response.
// Fines are fixed by card type and quoted in Naira.

export type CardType = "yellow" | "red";

// Fallback used only until SettingsContext's real (admin-configurable)
// values load — see lib/SettingsContext.tsx.
export const DEFAULT_FINE_AMOUNTS: Record<CardType, number> = {
  yellow: 2000,
  red: 5000,
};

export interface CardRecord {
  id: string;
  playerNumber: number;
  type: CardType;
  reason: string;
  fine: number;
  paid: boolean;
  date: string;
}

export const seedCards: CardRecord[] = [
  { id: "c1", playerNumber: 6, type: "yellow", reason: "Dissent", fine: DEFAULT_FINE_AMOUNTS.yellow, paid: true, date: "Sun 16 Aug" },
  { id: "c2", playerNumber: 22, type: "yellow", reason: "Late challenge", fine: DEFAULT_FINE_AMOUNTS.yellow, paid: false, date: "Sun 30 Aug" },
  { id: "c3", playerNumber: 11, type: "yellow", reason: "Time-wasting", fine: DEFAULT_FINE_AMOUNTS.yellow, paid: false, date: "Sun 13 Sep" },
  { id: "c4", playerNumber: 18, type: "red", reason: "Second yellow", fine: DEFAULT_FINE_AMOUNTS.red, paid: false, date: "Sun 20 Sep" },
];

export function outstandingFines(records: CardRecord[]) {
  return records.filter((c) => !c.paid).reduce((sum, c) => sum + c.fine, 0);
}

export function recentCards(records: CardRecord[], count = 5) {
  return records.slice(-count).reverse();
}

export function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}
