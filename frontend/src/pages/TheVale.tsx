import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { useSquad } from "../lib/SquadContext";
import { useMatchDay } from "../lib/MatchDayContext";
import { useValeContent } from "../lib/ValeContentContext";
import { apiFetch } from "../lib/api";
import { photos } from "../lib/photos";
import { formatCards, positionCodes } from "../lib/clubData";

interface TeamOfWeekData {
  title: string;
  dateRange: string;
  sessionsWon: number;
  sessionsPlayed: number;
  rivalTeam: string;
  score: string;
  lineupPlayerIds: number[];
}

export default function TheVale() {
  const { players } = useSquad();
  const { events } = useMatchDay();
  const { content } = useValeContent();
  const { playerOfTheWeek, mostImproved: mostImprovedPlayer, weeklyLeaders } = content;

  // Every ended match day that actually finished a game — most recent first —
  // so a visitor can look back at an older week's team instead of only ever
  // seeing the latest.
  const pastMatchDays = useMemo(
    () =>
      [...events]
        .filter((e) => e.status === "ended" && e.games.some((g) => g.status === "finished"))
        .reverse(),
    [events],
  );

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamOfWeekData | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);

  useEffect(() => {
    if (selectedEventId === null && pastMatchDays.length > 0) {
      setSelectedEventId(pastMatchDays[0].id);
    }
  }, [pastMatchDays, selectedEventId]);

  useEffect(() => {
    if (!selectedEventId) return;
    setTeamLoading(true);
    apiFetch<{ data: TeamOfWeekData | null }>(`/match-day-events/${selectedEventId}/team-of-week`)
      .then((res) => setTeam(res.data))
      .catch(() => setTeam(null))
      .finally(() => setTeamLoading(false));
  }, [selectedEventId]);

  const lineup = (team?.lineupPlayerIds ?? [])
    .map((n) => players.find((p) => p.id === n))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const potw = players.find((p) => p.id === playerOfTheWeek.playerId);
  const mip = players.find((p) => p.id === mostImprovedPlayer.playerId);
  const topScorer = players.find((p) => p.id === weeklyLeaders.topScorer.playerId);
  const topAssist = players.find((p) => p.id === weeklyLeaders.topAssist.playerId);
  const roughest = players.find((p) => p.id === weeklyLeaders.roughest.playerId);
  const cleanSheetLeaders = weeklyLeaders.cleanSheets
    .map((n) => players.find((p) => p.id === n))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <Layout>
      <PageHeader
        eyebrow="Updated every match day"
        title="The Vale"
        description="Team of the week, player honours and the stat leaders — refreshed the moment a match day ends."
      />

      {/* Team of the week */}
      <section className="relative border-b border-ink-line">
        <img
          src={photos.stadiumCrowd}
          alt="Noisers FC squad celebrating on the pitch"
          className="duotone absolute inset-0 h-full w-full object-cover opacity-40"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-ink/80" />

        <div className="relative mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-paper-dim">Team of the week</p>
              <h2 className="mt-3 font-display text-4xl text-paper md:text-6xl">
                {team?.title ?? "No match day results yet"}
              </h2>
            </div>

            {pastMatchDays.length > 1 && (
              <label className="text-sm text-paper-dim">
                Match day
                <select
                  value={selectedEventId ?? ""}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="mt-1 block border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper"
                >
                  {pastMatchDays.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} — {e.date}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {team && !teamLoading && (
            <>
              <p className="mt-4 max-w-xl text-paper-dim">
                {team.dateRange} · {team.sessionsWon} of {team.sessionsPlayed} match
                days won, capped by a {team.score} win over {team.rivalTeam}.
              </p>

              {lineup.length > 0 && (
                <div className="mt-10 grid grid-cols-2 gap-px bg-ink-line sm:grid-cols-4 lg:grid-cols-8">
                  {lineup.map((player) => (
                    <div key={player.id} className="bg-ink/70 p-4 backdrop-blur">
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
            </>
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
                  #{potw.number} · {positionCodes(potw)} · Week rating{" "}
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
                  #{mip.number} · {positionCodes(mip)} · Rating{" "}
                  {mostImprovedPlayer.previousRating.toFixed(2)} →{" "}
                  {mostImprovedPlayer.currentRating.toFixed(2)}
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
        <div className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-16">
          <p className="text-sm text-paper-dim">This week's leaders</p>
          <h2 className="mt-3 font-display text-4xl text-paper md:text-5xl">
            Stat leaders
          </h2>

          <div className="mt-10 grid grid-cols-1 gap-px bg-ink-line sm:grid-cols-2 lg:grid-cols-4">
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

            <div className="bg-ink p-8">
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs uppercase tracking-wide text-mist">
                  Roughest player
                </p>
                {roughest && (
                  <img
                    src={roughest.photo}
                    alt={roughest.name}
                    className="duotone -mt-2 h-16 w-16 shrink-0 border border-ink-line object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <p className="mt-4 font-display text-4xl text-paper">
                {roughest ? weeklyLeaders.roughest.yellowCards + weeklyLeaders.roughest.redCards : 0} cards
              </p>
              <p className="mt-2 text-sm text-paper-dim">
                {roughest
                  ? `${roughest.name} · #${roughest.number} · ${formatCards(weeklyLeaders.roughest.yellowCards, weeklyLeaders.roughest.redCards)}`
                  : "No bookings — clean week"}
              </p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
