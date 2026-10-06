import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { useSquad } from "../lib/SquadContext";
import { useMatchDay } from "../lib/MatchDayContext";
import { useValeContent } from "../lib/ValeContentContext";
import { apiFetch } from "../lib/api";
import { photos } from "../lib/photos";
import { formatCards, keepsCleanSheets, positionCodes, roughestPlayer } from "../lib/clubData";
import { CrownIcon } from "../components/icons";

/** "First win", "Won 3 times" — how often this player has been player of the week. */
const winsLabel = (n: number) => (n === 1 ? "First win" : `Won ${n} times`);

interface TeamOfWeekData {
  title: string;
  dateRange: string;
  sessionsWon: number;
  sessionsPlayed: number;
  rivalTeam: string;
  score: string;
  lineupPlayerIds: number[];
  /** The side at the bottom of the table — null when only one side played. */
  flopTeam: { name: string; won: number; played: number; gd: number; lineupPlayerIds: number[] } | null;
  /** This match day's flop player — null only when no squad player finished a game. */
  flopPlayer?: { playerId: number; note: string } | null;
}

export default function TheVale() {
  const { players } = useSquad();
  const { events } = useMatchDay();
  const { content } = useValeContent();
  const { playerOfTheWeek, mostImproved: mostImprovedPlayer, flopOfTheWeek, weeklyLeaders } = content;

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
  const topSaves = players.find((p) => p.id === weeklyLeaders.topSaves.playerId);
  const flopLineup = (team?.flopTeam?.lineupPlayerIds ?? [])
    .map((n) => players.find((p) => p.id === n))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  // The latest match day keeps the saved (or hand-picked) flop; an older one,
  // or a saved award left empty, uses the flop worked out for that day.
  const savedFlop = selectedEventId === pastMatchDays[0]?.id && flopOfTheWeek.playerId ? flopOfTheWeek : null;
  const flopPick = savedFlop ?? team?.flopPlayer ?? null;
  const flop = flopPick ? players.find((p) => p.id === flopPick.playerId) : undefined;
  const badBoys = weeklyLeaders.badBoys
    .map((b) => ({ ...b, player: players.find((p) => p.id === b.playerId) }))
    .filter((b): b is typeof b & { player: NonNullable<typeof b.player> } => Boolean(b.player));
  const leagueBadBoy = roughestPlayer(players);
  const cleanSheetTeam = weeklyLeaders.cleanSheetTeam;
  // Forwards don't keep clean sheets, even on the side that did.
  const cleanSheetLeaders = weeklyLeaders.cleanSheets
    .map((n) => players.find((p) => p.id === n))
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && keepsCleanSheets(p!));

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

              {team.flopTeam && (
                <div className="mt-10 border border-loss/40 bg-ink/70 p-6 backdrop-blur">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm text-loss">Flop team of the week</p>
                    <p className="text-xs text-mist">
                      Won {team.flopTeam.won} of {team.flopTeam.played} · goal difference{" "}
                      {team.flopTeam.gd > 0 ? `+${team.flopTeam.gd}` : team.flopTeam.gd}
                    </p>
                  </div>
                  <h3 className="mt-2 font-display text-3xl text-paper">{team.flopTeam.name}</h3>
                  {flopLineup.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                      {flopLineup.map((player) => (
                        <li key={player.id} className="flex items-center gap-2 text-sm text-paper-dim">
                          <img
                            src={player.photo}
                            alt=""
                            className="duotone h-8 w-8 border border-ink-line object-cover"
                            loading="lazy"
                          />
                          {player.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Player spotlights */}
      <section className="border-b border-ink-line bg-ink">
        <div className="mx-auto grid max-w-7xl gap-px bg-ink-line md:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-6 bg-ink p-10 sm:flex-row sm:items-start">
            {potw && (
              <div className="relative mt-6 shrink-0 self-start">
                <div className="h-28 w-28 overflow-hidden border border-justice">
                  <img
                    src={potw.photo}
                    alt={potw.name}
                    className="duotone h-full w-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
                <CrownIcon className="absolute -top-8 left-1/2 h-12 w-12 -translate-x-1/2 -rotate-12 text-justice drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-paper-dim">Player of the week</p>
                {potw && playerOfTheWeek.timesWon > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-justice/60 bg-justice/15 px-2 py-0.5 text-xs font-semibold text-justice">
                    <CrownIcon className="h-3.5 w-3.5" />
                    {winsLabel(playerOfTheWeek.timesWon)}
                  </span>
                )}
              </div>
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

          <div className="flex flex-col gap-6 bg-ink p-10 sm:flex-row sm:items-start">
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

          <div className="flex flex-col gap-6 bg-ink p-10 sm:flex-row sm:items-start md:col-span-2 lg:col-span-1">
            {flop && (
              <div className="h-28 w-28 shrink-0 overflow-hidden border border-loss/60">
                <img
                  src={flop.photo}
                  alt={flop.name}
                  className="duotone h-full w-full object-cover grayscale"
                  loading="lazy"
                />
              </div>
            )}
            <div>
              <p className="text-sm text-loss">Flop player of the week</p>
              <h3 className="mt-2 font-display text-3xl text-paper">
                {flop?.name ?? "Nobody this week"}
              </h3>
              {flop && (
                <p className="mt-1 text-sm text-mist">
                  #{flop.number} · {positionCodes(flop)}
                </p>
              )}
              <p className="mt-4 max-w-md text-sm leading-relaxed text-paper-dim">
                {flopPick?.note}
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

          <div className="mt-10 grid grid-cols-1 gap-px bg-ink-line sm:grid-cols-2 lg:grid-cols-3">
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
                Top saves
              </p>
              <p className="mt-4 font-display text-4xl text-paper">
                {weeklyLeaders.topSaves.value} save{weeklyLeaders.topSaves.value === 1 ? "" : "s"}
              </p>
              <p className="mt-2 text-sm text-paper-dim">
                {topSaves ? `${topSaves.name} · #${topSaves.number}` : "—"}
              </p>
            </div>

            <div className="bg-ink p-8">
              <p className="text-xs uppercase tracking-wide text-mist">
                Clean sheets
              </p>
              <p className="mt-4 font-display text-4xl text-paper">
                {cleanSheetTeam.name ? cleanSheetTeam.name : "—"}
              </p>
              <p className="mt-2 text-sm text-paper">
                {cleanSheetTeam.value} clean sheet{cleanSheetTeam.value === 1 ? "" : "s"}
              </p>
              {cleanSheetLeaders.length > 0 && (
                <p className="mt-1 text-sm text-paper-dim">
                  {cleanSheetLeaders.map((p) => p.name).join(", ")}
                </p>
              )}
            </div>

            <div className="bg-ink p-8">
              <p className="text-xs uppercase tracking-wide text-mist">
                Bad boys of the week
              </p>
              {badBoys.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {badBoys.map(({ player, yellowCards, redCards }) => (
                    <li key={player.id} className="flex items-center gap-3">
                      <img
                        src={player.photo}
                        alt=""
                        className="duotone h-10 w-10 shrink-0 border border-ink-line object-cover"
                        loading="lazy"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-paper">{player.name}</span>
                        <span className="block text-xs text-paper-dim">{formatCards(yellowCards, redCards)}</span>
                      </span>
                      <span className="flex gap-1" aria-hidden="true">
                        {Array.from({ length: yellowCards }, (_, i) => (
                          <span key={`y${i}`} className="h-4 w-3 bg-draw" />
                        ))}
                        {Array.from({ length: redCards }, (_, i) => (
                          <span key={`r${i}`} className="h-4 w-3 bg-loss" />
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-paper-dim">No bookings — clean week</p>
              )}
            </div>

            <div className="bg-ink p-8">
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs uppercase tracking-wide text-mist">
                  Bad boy of the league
                </p>
                {leagueBadBoy && (
                  <img
                    src={leagueBadBoy.photo}
                    alt={leagueBadBoy.name}
                    className="duotone -mt-2 h-16 w-16 shrink-0 border border-ink-line object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <p className="mt-4 font-display text-4xl text-paper">
                {leagueBadBoy ? leagueBadBoy.yellowCards + leagueBadBoy.redCards : 0} cards
              </p>
              <p className="mt-2 text-sm text-paper-dim">
                {leagueBadBoy
                  ? `${leagueBadBoy.name} · #${leagueBadBoy.number} · ${formatCards(leagueBadBoy.yellowCards, leagueBadBoy.redCards)} this season`
                  : "Nobody booked yet this season"}
              </p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
