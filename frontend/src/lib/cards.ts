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
  playerId: number;
  type: CardType;
  reason: string;
  fine: number;
  paid: boolean;
  date: string;
  /** "YYYY-MM-DD" — sent to the API when adding a card; `date` is its display label. */
  occurredOn?: string;
}

export function outstandingFines(records: CardRecord[]) {
  return records.filter((c) => !c.paid).reduce((sum, c) => sum + c.fine, 0);
}

export function recentCards(records: CardRecord[], count = 5) {
  return records.slice(-count).reverse();
}

export function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}
