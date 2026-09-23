import { useMemo, useState } from "react";
import { useSquad } from "../../lib/SquadContext";
import { useCards } from "../../lib/CardsContext";
import { formatNaira, outstandingFines, type CardRecord, type CardType } from "../../lib/cards";
import { useSettings } from "../../lib/SettingsContext";
import CardFormModal from "../../components/admin/CardFormModal";

type Filter = "all" | "unpaid" | "paid" | CardType;

const filters: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Unpaid", value: "unpaid" },
  { label: "Paid", value: "paid" },
  { label: "Yellow", value: "yellow" },
  { label: "Red", value: "red" },
];

export default function AdminCards() {
  const { players } = useSquad();
  const { cards, addCard, removeCard, togglePaid } = useCards();
  const { settings } = useSettings();
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CardRecord | null>(null);

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

      <div className="mt-10 grid grid-cols-2 gap-px bg-ink-line lg:grid-cols-4">
        {[
          { label: "Outstanding", value: formatNaira(outstanding), accent: "text-loss" },
          { label: "Collected", value: formatNaira(collected), accent: "text-win" },
          { label: "Yellow cards", value: yellowCount, accent: "text-draw" },
          { label: "Red cards", value: redCount, accent: "text-loss" },
        ].map((tile, i) => (
          <div
            key={tile.label}
            className="animate-hero-in bg-ink-raised px-6 py-6"
            style={{ animationDelay: `${120 + i * 60}ms` }}
          >
            <p className="text-xs uppercase tracking-wide text-mist">{tile.label}</p>
            <p className={`mt-3 font-display text-4xl leading-none ${tile.accent}`}>
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`border px-4 py-2 text-sm transition-colors ${
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
        <div className="mt-6 overflow-x-auto border border-ink-line">
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
              {visible.map((card, i) => {
                const player = players.find((p) => p.number === card.playerNumber);
                return (
                  <tr
                    key={card.id}
                    className="animate-hero-in border-b border-ink-line transition-colors last:border-b-0 hover:bg-ink-raised"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {player && (
                          <img src={player.photo} alt="" className="duotone h-9 w-9 object-cover" />
                        )}
                        <div>
                          <p className="text-paper">{player ? player.name : `#${card.playerNumber}`}</p>
                          {player && <p className="text-xs text-mist">#{player.number}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            card.type === "red" ? "bg-loss" : "bg-draw"
                          }`}
                        />
                        <span className={card.type === "red" ? "text-loss" : "text-draw"}>
                          {card.type === "red" ? "Red" : "Yellow"}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-paper-dim">{card.reason}</td>
                    <td className="px-4 py-3 text-paper-dim">{card.date}</td>
                    <td className="px-4 py-3 tabular-nums text-paper-dim">{formatNaira(card.fine)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => togglePaid(card.id)}
                        aria-pressed={card.paid}
                        className={`relative inline-flex h-7 w-14 items-center border transition-colors ${
                          card.paid ? "border-win bg-win/20" : "border-ink-line bg-ink"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform bg-paper transition-transform duration-300 ease-out ${
                            card.paid ? "translate-x-8" : "translate-x-1"
                          }`}
                        />
                        <span
                          className={`pointer-events-none absolute inset-0 flex items-center text-[10px] font-medium uppercase tracking-wide ${
                            card.paid ? "justify-start pl-2 text-win" : "justify-end pr-2 text-mist"
                          }`}
                        >
                          {card.paid ? "Paid" : "Owes"}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(card)}
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
      )}

      {adding && (
        <CardFormModal
          players={players}
          onClose={() => setAdding(false)}
          onSubmit={(card) => {
            addCard(card);
            setAdding(false);
          }}
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/90 p-4 backdrop-blur"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm border border-ink-line bg-ink-raised p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl text-paper">Remove card</h2>
            <p className="mt-2 text-sm text-paper-dim">
              Remove this {confirmDelete.type} card ({confirmDelete.reason})? This
              can't be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
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
                  removeCard(confirmDelete.id);
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
