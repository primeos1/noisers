import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { useSquad } from "../lib/SquadContext";
import { useValeContent } from "../lib/ValeContentContext";
import { photos } from "../lib/photos";

export default function TheVale() {
  const { players } = useSquad();
  const { content } = useValeContent();
  const { teamOfTheWeek, playerOfTheWeek, mostImproved: mostImprovedPlayer, weeklyLeaders } = content;
  const lineup = teamOfTheWeek.lineupNumbers
    .map((n) => players.find((p) => p.number === n))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const potw = players.find((p) => p.number === playerOfTheWeek.playerNumber);
  const mip = players.find((p) => p.number === mostImprovedPlayer.playerNumber);
  const topScorer = players.find((p) => p.number === weeklyLeaders.topScorer.playerNumber);
  const topAssist = players.find((p) => p.number === weeklyLeaders.topAssist.playerNumber);
  const cleanSheetLeaders = weeklyLeaders.cleanSheets
    .map((n) => players.find((p) => p.number === n))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <Layout>
      <PageHeader
        eyebrow="Updated every week"
        title="The Vale"
        description="Team of the week, player honours and the stat leaders — refreshed after every set."
      />

      {/* Team of the week */}
      <section className="relative border-b border-ink-line">
        <img
          src={teamOfTheWeek.photo || photos.stadiumCrowd}
          alt="Noisers FC squad celebrating on the pitch"
          className="duotone absolute inset-0 h-full w-full object-cover opacity-40"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-ink/80" />

        <div className="relative mx-auto max-w-7xl px-6 py-16 md:px-10">
          <p className="text-sm text-paper-dim">{teamOfTheWeek.week} · {teamOfTheWeek.dateRange}</p>
          <h2 className="mt-3 font-display text-4xl text-paper md:text-6xl">
            Team of the week
          </h2>
          <p className="mt-4 max-w-xl text-paper-dim">
            {teamOfTheWeek.sessionsWon} of {teamOfTheWeek.sessionsPlayed} match
            days won this week, capped by a {teamOfTheWeek.score} win over{" "}
            {teamOfTheWeek.rivalTeam}.
          </p>

          {lineup.length > 0 && (
            <div className="mt-10 grid grid-cols-2 gap-px bg-ink-line sm:grid-cols-4 lg:grid-cols-8">
              {lineup.map((player) => (
                <div key={player.number} className="bg-ink/70 p-4 backdrop-blur">
                  <div className="relative aspect-square overflow-hidden border border-ink-line">
                    <img
                      src={player.photo}
                      alt={player.name}
                      className="duotone h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <p className="mt-3 font-display text-lg leading-none text-paper">
                    {player.number}
                  </p>
                  <p className="mt-1 text-xs text-paper-dim">{player.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Player spotlights */}
      <section className="border-b border-ink-line bg-ink">
        <div className="mx-auto grid max-w-7xl md:grid-cols-2">
          <div className="flex flex-col gap-6 border-b border-ink-line p-10 sm:flex-row sm:items-start md:border-b-0 md:border-r">
            {potw && (
              <div className="h-28 w-28 shrink-0 overflow-hidden border border-ink-line">
                <img
                  src={potw.photo}
                  alt={potw.name}
                  className="duotone h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            <div>
              <p className="text-sm text-paper-dim">Player of the week</p>
              <h3 className="mt-2 font-display text-3xl text-paper">
                {potw?.name ?? "Coming soon"}
              </h3>
              {potw && (
                <p className="mt-1 text-sm text-mist">
                  #{potw.number} · {potw.position} · Week rating{" "}
                  {playerOfTheWeek.weekRating.toFixed(1)}
                </p>
              )}
              <p className="mt-4 max-w-md text-sm leading-relaxed text-paper-dim">
                {playerOfTheWeek.note}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-6 p-10 sm:flex-row sm:items-start">
            {mip && (
              <div className="h-28 w-28 shrink-0 overflow-hidden border border-ink-line">
                <img
                  src={mip.photo}
                  alt={mip.name}
                  className="duotone h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            <div>
              <p className="text-sm text-paper-dim">Most improved player</p>
              <h3 className="mt-2 font-display text-3xl text-paper">
                {mip?.name ?? "Coming soon"}
              </h3>
              {mip && (
                <p className="mt-1 text-sm text-mist">
                  #{mip.number} · {mip.position} · Rating{" "}
                  {mostImprovedPlayer.previousRating.toFixed(1)} →{" "}
                  {mostImprovedPlayer.currentRating.toFixed(1)}
                </p>
              )}
              <p className="mt-4 max-w-md text-sm leading-relaxed text-paper-dim">
                {mostImprovedPlayer.note}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Weekly stat leaders */}
      <section className="bg-ink">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10">
          <p className="text-sm text-paper-dim">This week's leaders</p>
          <h2 className="mt-3 font-display text-4xl text-paper md:text-5xl">
            Stat leaders
          </h2>

          <div className="mt-10 grid grid-cols-1 gap-px bg-ink-line sm:grid-cols-3">
            <div className="bg-ink p-8">
              <p className="text-xs uppercase tracking-wide text-mist">
                Top scorer
              </p>
              <p className="mt-4 font-display text-4xl text-paper">
                {weeklyLeaders.topScorer.value} goals
              </p>
              <p className="mt-2 text-sm text-paper-dim">
                {topScorer ? `${topScorer.name} · #${topScorer.number}` : "—"}
              </p>
            </div>

            <div className="bg-ink p-8">
              <p className="text-xs uppercase tracking-wide text-mist">
                Top assists
              </p>
              <p className="mt-4 font-display text-4xl text-paper">
                {weeklyLeaders.topAssist.value} assists
              </p>
              <p className="mt-2 text-sm text-paper-dim">
                {topAssist ? `${topAssist.name} · #${topAssist.number}` : "—"}
              </p>
            </div>

            <div className="bg-ink p-8">
              <p className="text-xs uppercase tracking-wide text-mist">
                Clean sheets
              </p>
              <p className="mt-4 font-display text-4xl text-paper">
                {cleanSheetLeaders.length}
              </p>
              <p className="mt-2 text-sm text-paper-dim">
                {cleanSheetLeaders.map((p) => p.name).join(", ") || "—"}
              </p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
