import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import TrendChart from "../components/charts/TrendChart";
import BarLeaderboard from "../components/charts/BarLeaderboard";
import { useSquad } from "../lib/SquadContext";
import { useMatchDay } from "../lib/MatchDayContext";
import { allGames, scoreOf } from "../lib/matchDay";
import { topByStat } from "../lib/clubData";
import { outstandingFines, formatNaira } from "../lib/cards";
import { useCards } from "../lib/CardsContext";

export default function Performance() {
  const { players } = useSquad();
  const { events } = useMatchDay();
  const games = allGames(events);
  const { cards } = useCards();

  const totalGoals = players.reduce((sum, p) => sum + p.goals, 0);
  const totalAssists = players.reduce((sum, p) => sum + p.assists, 0);
  const totalCleanSheets = players.reduce((sum, p) => sum + p.cleanSheets, 0);
  const avgRating = players.length
    ? players.reduce((sum, p) => sum + p.rating, 0) / players.length
    : 0;

  const recentGames = games.slice(-8).reverse();

  const trend = games.map(({ event, game }) => ({
    label: event.date,
    value: scoreOf(game, 0) + scoreOf(game, 1),
    detail: `${game.teams[0].name} ${scoreOf(game, 0)}–${scoreOf(game, 1)} ${game.teams[1].name}`,
  }));

  const yellow = cards.filter((c) => c.type === "yellow").length;
  const red = cards.filter((c) => c.type === "red").length;
  const fines = outstandingFines(cards);

  return (
    <Layout>
      <PageHeader
        eyebrow="Season overview"
        title="Performance"
        description="Match day activity, goals trend and the squad's leaderboards — the coach's view of the season so far."
      />

      <section className="border-b border-ink-line bg-ink">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10">
          <div className="grid grid-cols-2 gap-px bg-ink-line lg:grid-cols-4">
            <div className="bg-ink px-6 py-8">
              <p className="text-xs uppercase tracking-wide text-mist">Goals scored</p>
              <p className="mt-3 font-display text-5xl text-paper">{totalGoals}</p>
            </div>
            <div className="bg-ink px-6 py-8">
              <p className="text-xs uppercase tracking-wide text-mist">Assists</p>
              <p className="mt-3 font-display text-5xl text-paper">{totalAssists}</p>
            </div>
            <div className="bg-ink px-6 py-8">
              <p className="text-xs uppercase tracking-wide text-mist">Clean sheets</p>
              <p className="mt-3 font-display text-5xl text-paper">{totalCleanSheets}</p>
            </div>
            <div className="bg-ink px-6 py-8">
              <p className="text-xs uppercase tracking-wide text-mist">Squad avg. rating</p>
              <p className="mt-3 font-display text-5xl text-paper">{avgRating.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-ink-line bg-ink">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10">
          <p className="text-sm text-paper-dim">Last {recentGames.length} games</p>
          <h2 className="mt-3 font-display text-4xl text-paper md:text-5xl">
            Recent match days
          </h2>
          {recentGames.length === 0 ? (
            <p className="mt-6 text-sm text-paper-dim">No match days logged yet.</p>
          ) : (
            <div className="mt-8 flex flex-wrap gap-3">
              {recentGames.map(({ event, game }) => (
                <div key={game.id} className="border border-ink-line bg-ink-raised px-5 py-4">
                  <p className="font-display text-2xl text-paper">
                    {scoreOf(game, 0)}–{scoreOf(game, 1)}
                  </p>
                  <p className="mt-1 text-xs text-paper-dim">
                    {game.teams[0].name} v {game.teams[1].name}
                  </p>
                  <p className="mt-1 text-xs text-mist">{event.date}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-ink-line bg-ink">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10">
          <p className="text-sm text-paper-dim">This season</p>
          <h2 className="mt-3 font-display text-4xl text-paper md:text-5xl">
            Goals per match day
          </h2>
          <div className="mt-8 border border-ink-line bg-ink-raised p-6">
            <TrendChart points={trend} />
          </div>
        </div>
      </section>

      <section className="border-b border-ink-line bg-ink">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10">
          <p className="text-sm text-paper-dim">Leaderboards</p>
          <h2 className="mt-3 font-display text-4xl text-paper md:text-5xl">
            Squad leaders
          </h2>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <BarLeaderboard title="Top scorers" players={topByStat(players, "goals", 5)} statKey="goals" suffix=" goals" />
            <BarLeaderboard title="Top assists" players={topByStat(players, "assists", 5)} statKey="assists" suffix=" assists" />
            <BarLeaderboard title="Most clean sheets" players={topByStat(players, "cleanSheets", 5)} statKey="cleanSheets" suffix="" />
            <BarLeaderboard title="Highest rated" players={topByStat(players, "rating", 5)} statKey="rating" suffix="" />
          </div>
        </div>
      </section>

      <section className="bg-ink">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10">
          <p className="text-sm text-paper-dim">Discipline</p>
          <h2 className="mt-3 font-display text-4xl text-paper md:text-5xl">
            Cards & fines
          </h2>

          <div className="mt-8 grid grid-cols-1 gap-px bg-ink-line sm:grid-cols-3">
            <div className="bg-ink p-8">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 bg-draw" />
                <p className="text-xs uppercase tracking-wide text-mist">Yellow cards</p>
              </div>
              <p className="mt-4 font-display text-4xl text-paper">{yellow}</p>
            </div>
            <div className="bg-ink p-8">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 bg-loss" />
                <p className="text-xs uppercase tracking-wide text-mist">Red cards</p>
              </div>
              <p className="mt-4 font-display text-4xl text-paper">{red}</p>
            </div>
            <div className="bg-ink p-8">
              <p className="text-xs uppercase tracking-wide text-mist">Outstanding fines</p>
              <p className="mt-4 font-display text-4xl text-paper">{formatNaira(fines)}</p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
