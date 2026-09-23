import { Link } from "react-router-dom";
import StatTile from "../../components/admin/StatTile";
import { useSquad } from "../../lib/SquadContext";
import { useMatchDay } from "../../lib/MatchDayContext";
import { scoreOf } from "../../lib/matchDay";
import { topByStat } from "../../lib/clubData";
import { outstandingFines, recentCards, formatNaira } from "../../lib/cards";
import { useCards } from "../../lib/CardsContext";

export default function AdminHome() {
  const { players } = useSquad();
  const { events } = useMatchDay();
  const { cards } = useCards();

  const lastEvent = events[events.length - 1];
  const lastEventWithGame = [...events].reverse().find((e) => e.games.length > 0);
  const lastGame = lastEventWithGame ? lastEventWithGame.games[lastEventWithGame.games.length - 1] : undefined;
  const [topScorer] = topByStat(players, "goals", 1);
  const fines = outstandingFines(cards);
  const recent = recentCards(cards, 5);

  return (
    <div>
      <p className="text-sm text-paper-dim">Season at a glance</p>
      <h1 className="mt-3 font-display text-4xl text-paper md:text-5xl">
        Dashboard
      </h1>

      <div className="mt-10 grid grid-cols-1 gap-px bg-ink-line sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Match days played"
          value={events.length}
          hint={lastEvent ? `Last one "${lastEvent.title}" · ${lastEvent.date}` : "None recorded yet"}
        />
        <StatTile
          label="Last result"
          value={lastGame ? `${scoreOf(lastGame, 0)}–${scoreOf(lastGame, 1)}` : "—"}
          hint={lastGame ? `${lastGame.teams[0].name} vs ${lastGame.teams[1].name}` : undefined}
        />
        <StatTile
          label="Top scorer"
          value={topScorer ? topScorer.name : "—"}
          hint={topScorer ? `${topScorer.goals} goals` : undefined}
        />
        <StatTile
          label="Outstanding fines"
          value={formatNaira(fines)}
          hint={`${cards.filter((c) => !c.paid).length} unpaid card${cards.filter((c) => !c.paid).length === 1 ? "" : "s"}`}
        />
      </div>

      <div className="mt-12 grid gap-px bg-ink-line md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-ink p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-paper">Manage squad</h2>
            <Link to="/admin/squad" className="text-sm text-paper-dim hover:text-paper">
              Open →
            </Link>
          </div>
          <p className="mt-2 text-sm text-paper-dim">
            {players.length} players registered. Add, edit or remove a player.
          </p>
        </div>

        <div className="bg-ink p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-paper">Manage matches</h2>
            <Link to="/admin/matches" className="text-sm text-paper-dim hover:text-paper">
              Open →
            </Link>
          </div>
          <p className="mt-2 text-sm text-paper-dim">
            {events.length} match days logged. View history or start a new one.
          </p>
        </div>

        <div className="bg-ink p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-paper">Manage cards</h2>
            <Link to="/admin/cards" className="text-sm text-paper-dim hover:text-paper">
              Open →
            </Link>
          </div>
          <p className="mt-2 text-sm text-paper-dim">
            {cards.length} cards logged. Log a new one or mark a fine paid.
          </p>
        </div>

        <div className="bg-ink p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-paper">Settings</h2>
            <Link to="/admin/settings" className="text-sm text-paper-dim hover:text-paper">
              Open →
            </Link>
          </div>
          <p className="mt-2 text-sm text-paper-dim">
            Card fines, match day defaults and the player portal passcode.
          </p>
        </div>
      </div>

      <div className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-paper">Recent cards</h2>
          <Link to="/admin/cards" className="text-sm text-paper-dim hover:text-paper">
            View all →
          </Link>
        </div>
        <div className="mt-4 border border-ink-line">
          {recent.length === 0 ? (
            <p className="p-6 text-sm text-paper-dim">No cards logged.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-line text-xs uppercase tracking-wide text-mist">
                  <th className="px-4 py-3 font-normal">Player</th>
                  <th className="px-4 py-3 font-normal">Card</th>
                  <th className="px-4 py-3 font-normal">Reason</th>
                  <th className="px-4 py-3 font-normal">Fine</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((card) => {
                  const player = players.find((p) => p.number === card.playerNumber);
                  return (
                    <tr key={card.id} className="border-b border-ink-line last:border-b-0">
                      <td className="px-4 py-3 text-paper">
                        {player ? player.name : `#${card.playerNumber}`}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            card.type === "red" ? "text-loss" : "text-draw"
                          }
                        >
                          {card.type === "red" ? "Red" : "Yellow"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-paper-dim">{card.reason}</td>
                      <td className="px-4 py-3 text-paper-dim">{formatNaira(card.fine)}</td>
                      <td className="px-4 py-3">
                        <span className={card.paid ? "text-win" : "text-paper-dim"}>
                          {card.paid ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
