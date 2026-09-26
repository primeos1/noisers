import { Link, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { useSquad } from "../lib/SquadContext";
import { useCards } from "../lib/CardsContext";
import { useMatchDay } from "../lib/MatchDayContext";
import { allGames, scoreOf, type MatchDayGame } from "../lib/matchDay";
import { formatNaira } from "../lib/cards";
import { positionNames } from "../lib/clubData";
import MembershipBadge from "../components/MembershipBadge";

function playedFor(game: MatchDayGame, playerId: number): 0 | 1 | null {
  if (game.teams[0].players.includes(playerId)) return 0;
  if (game.teams[1].players.includes(playerId)) return 1;
  return null;
}

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const { players } = useSquad();
  const { cards } = useCards();
  const { events } = useMatchDay();

  const playerId = Number(id);
  const player = players.find((p) => p.id === playerId);

  if (!player) {
    return (
      <Layout>
        <PageHeader eyebrow="Squad" title="Player not found" />
        <section className="bg-ink">
          <div className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-16">
            <p className="text-sm text-paper-dim">
              We couldn't find that player.{" "}
              <Link to="/squad" className="text-paper underline underline-offset-4">
                Back to the squad
              </Link>
            </p>
          </div>
        </section>
      </Layout>
    );
  }

  const playerCards = cards.filter((c) => c.playerId === playerId);
  const owed = playerCards.filter((c) => !c.paid).reduce((sum, c) => sum + c.fine, 0);

  const games = allGames(events)
    .filter(({ game }) => playedFor(game, playerId) !== null)
    .reverse();

  return (
    <Layout>
      <PageHeader
        eyebrow={positionNames(player)}
        title={player.name}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <span>#{player.number} — rated {player.rating.toFixed(2)}</span>
            <MembershipBadge membership={player.membership} />
          </span>
        }
      />

      <section className="border-b border-ink-line bg-ink">
        <div className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-16">
          <div className="flex flex-col gap-8 md:flex-row">
            <div className="relative aspect-square w-full max-w-xs shrink-0 overflow-hidden border border-ink-line">
              <img
                src={player.photo}
                alt={player.name}
                className="duotone h-full w-full object-cover"
              />
              <div className="duotone-wash pointer-events-none absolute inset-0" />
            </div>

            <div className="grid flex-1 grid-cols-2 gap-px self-start bg-ink-line sm:grid-cols-4">
              {[
                { label: "Apps", value: player.appearances },
                { label: "Goals", value: player.goals },
                { label: "Assists", value: player.assists },
                { label: "Clean sheets", value: player.cleanSheets },
              ].map((stat) => (
                <div key={stat.label} className="bg-ink px-5 py-6">
                  <p className="text-xs uppercase tracking-wide text-mist">{stat.label}</p>
                  <p className="mt-3 font-display text-3xl text-paper">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-ink-line bg-ink">
        <div className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-16">
          <p className="text-sm text-paper-dim">Discipline</p>
          <h2 className="mt-2 font-display text-2xl text-paper md:text-3xl">
            Cards & fines
          </h2>
          {playerCards.length === 0 ? (
            <p className="mt-4 text-sm text-paper-dim">No cards logged this season.</p>
          ) : (
            <>
              <p className="mt-4 text-sm text-paper-dim">
                {owed > 0 ? (
                  <>Owed: <span className="text-loss">{formatNaira(owed)}</span></>
                ) : (
                  <span className="text-win">All fines paid</span>
                )}
              </p>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-ink-line md:rounded-none">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-line text-xs uppercase tracking-wide text-mist">
                      <th className="px-4 py-3 font-normal">Card</th>
                      <th className="px-4 py-3 font-normal">Reason</th>
                      <th className="hidden px-4 py-3 font-normal sm:table-cell">Date</th>
                      <th className="px-4 py-3 font-normal">Fine</th>
                      <th className="px-4 py-3 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...playerCards].reverse().map((card) => (
                      <tr key={card.id} className="border-b border-ink-line last:border-b-0">
                        <td className="px-4 py-3">
                          <span className={card.type === "red" ? "text-loss" : "text-draw"}>
                            {card.type === "red" ? "Red" : "Yellow"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-paper-dim">{card.reason}</td>
                        <td className="hidden px-4 py-3 text-paper-dim sm:table-cell">{card.date}</td>
                        <td className="px-4 py-3 text-paper-dim">{formatNaira(card.fine)}</td>
                        <td className="px-4 py-3">
                          <span className={card.paid ? "text-win" : "text-paper-dim"}>
                            {card.paid ? "Paid" : "Unpaid"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="bg-ink">
        <div className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-16">
          <p className="text-sm text-paper-dim">Match days</p>
          <h2 className="mt-2 font-display text-2xl text-paper md:text-3xl">
            Match history
          </h2>
          {games.length === 0 ? (
            <p className="mt-4 text-sm text-paper-dim">No games logged yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {games.map(({ event, game }) => {
                const side = playedFor(game, playerId);
                if (side === null) return null;
                const goals = game.goals.filter(
                  (g) => g.playerId === playerId && !g.ownGoal,
                ).length;
                const assists = game.goals.filter((g) => g.assistPlayerId === playerId).length;
                const playerCardsInGame = game.cards.filter((c) => c.playerId === playerId);

                return (
                  <div key={game.id} className="border border-ink-line bg-ink-raised p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-paper">
                        {game.teams[0].name} {scoreOf(game, 0)}–{scoreOf(game, 1)} {game.teams[1].name}
                      </span>
                      <span className="text-xs text-mist">
                        {event.title} · {event.date}
                      </span>
                    </div>
                    <p className="mt-2 text-paper-dim">
                      Played for{" "}
                      <span className="text-paper">{game.teams[side].name}</span>
                      {goals > 0 && <> · {goals} goal{goals === 1 ? "" : "s"}</>}
                      {assists > 0 && <> · {assists} assist{assists === 1 ? "" : "s"}</>}
                      {playerCardsInGame.map((c) => (
                        <span key={c.id} className={c.type === "red" ? "text-loss" : "text-draw"}>
                          {" "}
                          · {c.type === "red" ? "Red" : "Yellow"} card
                        </span>
                      ))}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
