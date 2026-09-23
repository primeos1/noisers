import { useState } from "react";
import { Link } from "react-router-dom";
import { useSquad } from "../../lib/SquadContext";
import { useMatchDay } from "../../lib/MatchDayContext";
import { participantName, scoreOf, type MatchDayEvent } from "../../lib/matchDay";
import Modal from "../../components/admin/Modal";

export default function AdminMatches() {
  const { players } = useSquad();
  const { events, removeEvent } = useMatchDay();
  const [viewing, setViewing] = useState<MatchDayEvent | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MatchDayEvent | null>(null);

  const sorted = [...events].reverse();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-paper-dim">Match day history</p>
          <h1 className="mt-3 font-display text-4xl text-paper md:text-5xl">
            Matches
          </h1>
          <p className="mt-3 max-w-xl text-sm text-paper-dim">
            Every internal match day — title, venue, date and every game
            played, view-only once ended. Start or resume one from{" "}
            <Link to="/admin/matchday" className="text-paper underline underline-offset-4 hover:text-paper-dim">
              Match Day
            </Link>
            .
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-10 text-sm text-paper-dim">
          No match days recorded yet — start one from the Match Day tab.
        </p>
      ) : (
        <div className="mt-10 overflow-x-auto border border-ink-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-line text-xs uppercase tracking-wide text-mist">
                <th className="px-4 py-3 font-normal">Title</th>
                <th className="px-4 py-3 font-normal">Venue</th>
                <th className="px-4 py-3 font-normal">Date</th>
                <th className="px-4 py-3 font-normal">Games</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((event) => (
                <tr key={event.id} className="border-b border-ink-line last:border-b-0">
                  <td className="px-4 py-3 text-paper">{event.title}</td>
                  <td className="px-4 py-3 text-paper-dim">{event.venue}</td>
                  <td className="px-4 py-3 text-paper-dim">{event.date}</td>
                  <td className="px-4 py-3 text-paper-dim">{event.games.length}</td>
                  <td className="px-4 py-3 text-paper-dim">
                    {event.status === "ended" ? "Ended" : "Live"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setViewing(event)}
                        className="text-paper-dim hover:text-paper"
                      >
                        View details
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(event)}
                        className="text-paper-dim hover:text-loss"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <Modal title={viewing.title} onClose={() => setViewing(null)}>
          <div className="space-y-6">
            <p className="text-sm text-mist">
              {viewing.venue} · {viewing.date} · {viewing.status === "ended" ? "Ended" : "Live"}
            </p>

            {viewing.guests.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-mist">Guests</p>
                <p className="mt-2 text-sm text-paper-dim">{viewing.guests.map((g) => g.name).join(", ")}</p>
              </div>
            )}

            {viewing.games.length === 0 ? (
              <p className="text-sm text-mist">No games played.</p>
            ) : (
              viewing.games.map((game, gi) => (
                <div key={game.id} className="space-y-4 border-t border-ink-line pt-4 first:border-t-0 first:pt-0">
                  <p className="font-display text-lg text-paper">
                    Game {gi + 1}: {game.teams[0].name} {scoreOf(game, 0)}–{scoreOf(game, 1)} {game.teams[1].name}
                  </p>

                  <div className="grid gap-6 sm:grid-cols-2">
                    {([0, 1] as const).map((t) => (
                      <div key={t}>
                        <p className="text-xs uppercase tracking-wide text-mist">{game.teams[t].name}</p>
                        <ul className="mt-2 space-y-1 text-sm text-paper-dim">
                          {game.teams[t].players.map((id) => (
                            <li key={String(id)}>{participantName(players, viewing.guests, id)}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-mist">Goals</p>
                    {game.goals.length === 0 ? (
                      <p className="mt-2 text-sm text-mist">No goals logged.</p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm">
                        {game.goals.map((g) => (
                          <li key={g.id} className="flex items-center justify-between border-b border-ink-line pb-2">
                            <span className="text-paper-dim">
                              {g.minute}' — {participantName(players, viewing.guests, g.playerId)}
                              {g.ownGoal && <span className="text-mist"> (o.g.)</span>}
                              {g.assistPlayerId !== undefined && (
                                <span className="text-mist">
                                  {" "}
                                  · assist {participantName(players, viewing.guests, g.assistPlayerId)}
                                </span>
                              )}{" "}
                              <span className="text-mist">({game.teams[g.teamIndex].name})</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-mist">Cards</p>
                    {game.cards.length === 0 ? (
                      <p className="mt-2 text-sm text-mist">No cards logged.</p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm">
                        {game.cards.map((c) => (
                          <li key={c.id} className="flex items-center justify-between border-b border-ink-line pb-2">
                            <span className="text-paper-dim">
                              {c.minute}' —{" "}
                              <span className={c.type === "red" ? "text-loss" : "text-draw"}>
                                {c.type === "red" ? "Red" : "Yellow"}
                              </span>{" "}
                              {participantName(players, viewing.guests, c.playerId)}
                              <span className="text-mist">
                                {" "}
                                · {c.reason} ({game.teams[c.teamIndex].name})
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
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
            <h2 className="font-display text-xl text-paper">Remove match day</h2>
            <p className="mt-2 text-sm text-paper-dim">
              Remove "{confirmDelete.title}"? This can't be undone.
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
                  removeEvent(confirmDelete.id);
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
