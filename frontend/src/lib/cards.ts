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
  /** How much of the fine has been handed over so far. */
  amountPaid: number;
  paid: boolean;
  date: string;
  /** "YYYY-MM-DD" — sent to the API when adding a card; `date` is its display label. */
  occurredOn?: string;
}

/** What's still owed on one card. */
export function owedOn(card: CardRecord) {
  return card.paid ? 0 : Math.max(card.fine - card.amountPaid, 0);
}

export function outstandingFines(records: CardRecord[]) {
  return records.reduce((sum, c) => sum + owedOn(c), 0);
}

export function collectedFines(records: CardRecord[]) {
  return records.reduce((sum, c) => sum + c.fine - owedOn(c), 0);
}

/** "Paid", "Unpaid", or "₦1,000 of ₦2,000 paid" for a part-paid fine. */
export function paymentStatus(card: CardRecord, unpaid = "Unpaid") {
  if (card.paid) return "Paid";
  if (card.amountPaid > 0) return `${formatNaira(card.amountPaid)} of ${formatNaira(card.fine)} paid`;
  return unpaid;
}

export function recentCards(records: CardRecord[], count = 5) {
  return records.slice(-count).reverse();
}

export function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}
