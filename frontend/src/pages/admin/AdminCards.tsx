import { useMemo, useState } from "react";
import { useSquad } from "../../lib/SquadContext";
import { useCards } from "../../lib/CardsContext";
import { formatNaira, outstandingFines, type CardRecord, type CardType } from "../../lib/cards";
import { useSettings } from "../../lib/SettingsContext";
import CardFormModal, { type CardMatchLink } from "../../components/admin/CardFormModal";
import { useMatchDay } from "../../lib/MatchDayContext";
import { useValeContent } from "../../lib/ValeContentContext";
import type { MatchDayEvent } from "../../lib/matchDay";

type Filter = "all" | "unpaid" | "paid" | CardType;

/** All of one player's cards, added up into a single row. */
interface CardGroup {
  playerId: number;
  /** Newest first. */
  cards: CardRecord[];
  yellows: number;
  reds: number;
  fine: number;
  paid: boolean;
}

function groupCards(cards: CardRecord[]): CardGroup[] {
  const groups = new Map<number, CardGroup>();
  for (const card of cards) {
    const group = groups.get(card.playerId) ?? { playerId: card.playerId, cards: [], yellows: 0, reds: 0, fine: 0, paid: true };
    group.cards.push(card);
    if (card.type === "red") group.reds += 1;
    else group.yellows += 1;
    group.fine += card.fine;
    group.paid &&= card.paid;
    groups.set(card.playerId, group);
  }
  // Card ids go up as they're logged, so the highest is the latest.
  for (const group of groups.values()) group.cards.sort((a, b) => Number(b.id) - Number(a.id));
  return [...groups.values()];
}

function cardCounts(group: CardGroup) {
  return [
    group.yellows > 0 && `${group.yellows} yellow`,
    group.reds > 0 && `${group.reds} red`,
  ].filter(Boolean).join(", ");
}

/** A yellow and/or red card chip, each with its count when there's more than one. */
function CardChips({ group }: { group: CardGroup }) {
  return (
    <span className="inline-flex shrink-0 gap-1" aria-label={cardCounts(group)}>
      {(["yellow", "red"] as CardType[]).map((type) => {
        const n = type === "red" ? group.reds : group.yellows;
        return n > 0 ? (
          <span
            key={type}
            className={`flex h-9 w-6 items-center justify-center rounded-[4px] font-display text-sm font-bold text-ink ${type === "red" ? "bg-loss" : "bg-draw"}`}
          >
            {n > 1 ? n : null}
          </span>
        ) : null;
      })}
    </span>
  );
}

/** Distinct reasons, and the first and latest dates when they differ. */
function groupDetail(group: CardGroup) {
  const reasons = [...new Set(group.cards.map((c) => c.reason).filter(Boolean))].join(", ");
  const newest = group.cards[0].date;
  const oldest = group.cards[group.cards.length - 1].date;
  return { reasons, dates: newest === oldest ? newest : `${oldest} – ${newest}` };
}

const filters: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Unpaid", value: "unpaid" },
  { label: "Paid", value: "paid" },
  { label: "Yellow", value: "yellow" },
  { label: "Red", value: "red" },
];

export default function AdminCards() {
  const { players, refresh: refreshSquad } = useSquad();
  const { cards, addCard, removeCard, updateCard, refresh: refreshCards, error: cardsError } = useCards();
  const { events, updateEvent, refresh: refreshMatchDays, error: matchDayError } = useMatchDay();
  const { refresh: refreshVale } = useValeContent();
  const { settings } = useSettings();
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CardGroup | null>(null);

  // A card missed during a match day goes into that game's record; the
  // server then logs its fine and updates stats, ratings and The Vale.
  async function addToMatchDay(card: CardRecord, link: CardMatchLink) {
    const event = events.find((e) => e.id === link.eventId);
    if (!event) return;
    const cardId = `c${Date.now()}`;
    // Built on the latest copy, in case someone is editing that match day too.
    const edit = (latest: MatchDayEvent) => ({
      games: latest.games.map((g) =>
        g.id !== link.gameId
          ? g
          : {
              ...g,
              cards: [
                ...g.cards,
                {
                  id: cardId,
                  teamIndex: g.teams[1].players.includes(card.playerId) ? (1 as const) : (0 as const),
                  playerId: card.playerId,
                  type: card.type,
                  reason: card.reason,
                  minute: 0,
                },
              ],
            },
      ),
    });
    if (await updateEvent(event.id, edit)) {
      refreshCards();
      refreshSquad();
      refreshVale();
    }
  }

  const sorted = useMemo(() => [...cards].reverse(), [cards]);

  const visible = useMemo(() => {
    switch (filter) {
      case "unpaid":
        return sorted.filter((c) => !c.paid);
      case "paid":
        return sorted.filter((c) => c.paid);
      case "yellow":
      case "red":
        return sorted.filter((c) => c.type === filter);
      default:
        return sorted;
    }
  }, [sorted, filter]);

  const groups = useMemo(() => groupCards(visible), [visible]);

  // A partly paid group gets marked fully paid; a fully paid one goes back to owing.
  function toggleGroupPaid(group: CardGroup) {
    const paid = !group.paid;
    for (const card of group.cards) if (card.paid !== paid) updateCard(card.id, { paid });
  }

  const outstanding = outstandingFines(cards);
  const collected = cards.filter((c) => c.paid).reduce((sum, c) => sum + c.fine, 0);
  const yellowCount = cards.filter((c) => c.type === "yellow").length;
  const redCount = cards.filter((c) => c.type === "red").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="animate-hero-in">
          <p className="text-sm text-paper-dim">Discipline</p>
          <h1 className="mt-3 font-display text-4xl text-paper md:text-5xl">
            Cards
          </h1>
          <p className="mt-3 max-w-xl text-sm text-paper-dim">
            Every yellow and red card logged this season, and whether the
            fine's been paid. Yellow cards are {formatNaira(settings.yellowCardFine)}, red
            cards {formatNaira(settings.redCardFine)}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="animate-hero-in border border-paper bg-paper px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-transparent hover:text-paper [animation-delay:80ms]"
        >
          + Add card
        </button>
      </div>

      {(cardsError || matchDayError) && (
        <p className="mt-4 text-sm text-loss">{cardsError || matchDayError}</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-ink-line md:mt-10 md:rounded-none lg:grid-cols-4">
        {[
          { label: "Outstanding", value: formatNaira(outstanding), accent: "text-loss" },
          { label: "Collected", value: formatNaira(collected), accent: "text-win" },
          { label: "Yellow cards", value: yellowCount, accent: "text-draw" },
          { label: "Red cards", value: redCount, accent: "text-loss" },
        ].map((tile, i) => (
          <div
            key={tile.label}
            className="animate-hero-in bg-ink-raised px-4 py-5 md:px-6 md:py-6"
            style={{ animationDelay: `${120 + i * 60}ms` }}
          >
            <p className="text-xs uppercase tracking-wide text-mist">{tile.label}</p>
            <p className={`mt-3 font-display text-3xl leading-none md:text-4xl ${tile.accent}`}>
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:mt-10 md:flex-wrap md:px-0">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors md:rounded-none ${
              filter === f.value
                ? "border-paper bg-paper text-ink"
                : "border-ink-line text-paper-dim hover:border-paper/60 hover:text-paper"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 text-sm text-paper-dim">No cards match this filter.</p>
      ) : (
        <>
        {/* Phones: card list */}
        <ul className="mt-4 divide-y divide-ink-line overflow-hidden rounded-2xl border border-ink-line bg-ink-raised md:hidden">
          {groups.map((group) => {
            const player = players.find((p) => p.id === group.playerId);
            const { reasons, dates } = groupDetail(group);
            return (
              <li key={group.playerId} className="flex items-center gap-3 px-4 py-3">
                <CardChips group={group} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.95rem] text-paper">
                    {player ? player.name : "Former player"}
                  </p>
                  <p className="truncate text-xs text-mist">{[reasons, dates].filter(Boolean).join(" · ")}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <span className="tabular-nums text-paper-dim">{formatNaira(group.fine)}</span>
                    <button type="button" onClick={() => setConfirmDelete(group)} className="text-loss">
                      Remove
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleGroupPaid(group)}
                  aria-pressed={group.paid}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ${
                    group.paid ? "bg-win/20 text-win" : "bg-loss/15 text-loss"
                  }`}
                >
                  {group.paid ? "Paid" : "Owes"}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 hidden overflow-x-auto border border-ink-line md:block">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-line text-xs uppercase tracking-wide text-mist">
                <th className="px-4 py-3 font-normal">Player</th>
                <th className="px-4 py-3 font-normal">Card</th>
                <th className="px-4 py-3 font-normal">Reason</th>
                <th className="px-4 py-3 font-normal">Date</th>
                <th className="px-4 py-3 font-normal">Fine</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal" />
              </tr>
            </thead>
            <tbody>
              {groups.map((group, i) => {
                const player = players.find((p) => p.id === group.playerId);
                const { reasons, dates } = groupDetail(group);
                return (
                  <tr
                    key={group.playerId}
                    className="animate-hero-in border-b border-ink-line transition-colors last:border-b-0 hover:bg-ink-raised"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {player && (
                          <img src={player.photo} alt="" className="duotone h-9 w-9 object-cover" />
                        )}
                        <div>
                          <p className="text-paper">{player ? player.name : "Former player"}</p>
                          {player && <p className="text-xs text-mist">#{player.number}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-3">
                        {group.yellows > 0 && (
                          <span className="inline-flex items-center gap-2 text-draw">
                            <span className="h-2.5 w-2.5 rounded-full bg-draw" />
                            {group.yellows > 1 ? `${group.yellows} × Yellow` : "Yellow"}
                          </span>
                        )}
                        {group.reds > 0 && (
                          <span className="inline-flex items-center gap-2 text-loss">
                            <span className="h-2.5 w-2.5 rounded-full bg-loss" />
                            {group.reds > 1 ? `${group.reds} × Red` : "Red"}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-paper-dim">{reasons}</td>
                    <td className="px-4 py-3 text-paper-dim">{dates}</td>
                    <td className="px-4 py-3 tabular-nums text-paper-dim">{formatNaira(group.fine)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleGroupPaid(group)}
                        aria-pressed={group.paid}
                        className={`relative inline-flex h-7 w-14 items-center border transition-colors ${
                          group.paid ? "border-win bg-win/20" : "border-ink-line bg-ink"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform bg-paper transition-transform duration-300 ease-out ${
                            group.paid ? "translate-x-8" : "translate-x-1"
                          }`}
                        />
                        <span
                          className={`pointer-events-none absolute inset-0 flex items-center text-[10px] font-medium uppercase tracking-wide ${
                            group.paid ? "justify-start pl-2 text-win" : "justify-end pr-2 text-mist"
                          }`}
                        >
                          {group.paid ? "Paid" : "Owes"}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(group)}
                          className="text-paper-dim hover:text-loss"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {adding && (
        <CardFormModal
          players={players}
          onClose={() => setAdding(false)}
          onSubmit={(card, link) => {
            if (link) addToMatchDay(card, link);
            else addCard(card);
            setAdding(false);
          }}
        />
      )}

      {confirmDelete && (
        <div
          className="sheet-backdrop"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            role="dialog" aria-modal="true" className="sheet md:max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl text-paper">Remove card</h2>
            <p className="mt-2 text-sm text-paper-dim">
              {confirmDelete.cards.length > 1
                ? `Remove the latest of these ${confirmDelete.cards.length} cards, the ${confirmDelete.cards[0].type} on ${confirmDelete.cards[0].date}${confirmDelete.cards[0].reason ? ` (${confirmDelete.cards[0].reason})` : ""}?`
                : `Remove this ${confirmDelete.cards[0].type} card (${confirmDelete.cards[0].reason})?`}{" "}
              This can't be undone.
            </p>
            <div className="sheet-actions mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="border border-ink-line px-4 py-2 text-sm text-paper-dim hover:text-paper"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  // A match day card also comes off its game, which can move stats and ratings.
                  removeCard(confirmDelete.cards[0].id).then((ok) => {
                    if (!ok) return;
                    refreshMatchDays();
                    refreshSquad();
                    refreshVale();
                  });
                  setConfirmDelete(null);
                }}
                className="border border-loss bg-loss px-4 py-2 text-sm font-medium text-paper hover:bg-transparent hover:text-loss"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
