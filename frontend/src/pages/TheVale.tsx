import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { useSquad } from "../lib/SquadContext";
import { useMatchDay } from "../lib/MatchDayContext";
import { DEFAULT_VALE_CONTENT, fromApi as valeFromApi, useValeContent, type ApiValeContent } from "../lib/ValeContentContext";
import { apiFetch } from "../lib/api";
import { photos } from "../lib/photos";
import { formatCards, keepsCleanSheets, positionCodes, roughestPlayer, type Player } from "../lib/clubData";
import { CrownIcon } from "../components/icons";
import type { MatchDayEvent } from "../lib/matchDay";

/** "First win", "Won 3 times" — how often this player has been player of the week. */
const winsLabel = (n: number) => (n === 1 ? "First win" : `Won ${n} times`);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "2 goals · 1 assist" — what earned a team-of-the-week pick their place. */
function pickLine(p: TeamOfWeekPick) {
  const parts = [
    p.goals > 0 && plural(p.goals, "goal"),
    p.assists > 0 && plural(p.assists, "assist"),
    p.cleanSheets > 0 && plural(p.cleanSheets, "clean sheet"),
    p.saves > 0 && plural(p.saves, "save"),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : plural(p.appearances, "game");
}

/** "Week 3" — every two match days make a week. */
const weekLabel = (week?: number) => (week ? `Week ${week}` : null);

interface TeamOfWeekPick {
  playerId: number;
  position: "GK" | "DEF" | "MID" | "FWD";
  goals: number;
  assists: number;
  cleanSheets: number;
  saves: number;
  appearances: number;
}

/** One match day's own awards, from that day's ratings alone. */
interface MatchDayAwards {
  id: string;
  title: string;
  date: string;
  /** The day's best keeper, two defenders, midfielder and two forwards, in that order. */
  lineup: TeamOfWeekPick[];
  playerOfMatchDay: TeamOfWeekPick | null;
  /** Most cards that day, ties going to more reds — null when nobody was booked. */
  badBoy?: { playerId: number; yellowCards: number; redCards: number } | null;
}

interface TeamOfWeekData {
  /** "Week of 28 Sep". */
  title: string;
  /** The week's match day dates, e.g. "Wed 30 Sept & Sun 4 Oct". */
  dateRange: string;
  /** Every match day of the week that was compared (its two match days). */
  weekMatchDays?: { id: string; title: string; date: string }[];
  /** The week's best keeper, two defenders, midfielder and two forwards, in that order. */
  lineup: TeamOfWeekPick[];
  lineupPlayerIds: number[];
  /** Whether both match days have ended — until then there's no team or player of the week. */
  complete?: boolean;
  /** The week's highest-rated player, with both match days' points added up. */
  playerOfWeek?: TeamOfWeekPick | null;
  /** The team and player of each of the week's match days, oldest first. */
  matchDays?: MatchDayAwards[];
  /** The side at the bottom of the table — null when only one side played. */
  flopTeam: { name: string; won: number; played: number; gd: number; lineupPlayerIds: number[] } | null;
  /** This match day's flop player — null only when no squad player finished a game. */
  flopPlayer?: { playerId: number; note: string } | null;
  /** Every other award as worked out for this match day. */
  awards?: ApiValeContent;
}

const SHAPE: { row: string[] }[] = [{ row: ["FWD", "FWD"] }, { row: ["MID"] }, { row: ["DEF", "DEF"] }, { row: ["GK"] }];

/**
 * In place of the team of the week until both its match days have ended —
 * like a gameweek still being played: a stamped headline, a ticker, the
 * two-day tracker and six empty shirts on the pitch.
 */
function WeekInProgress({ week, events }: { week: number; events: MatchDayEvent[] }) {
  const days = events
    .filter((e) => e.week === week)
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  const slots = [0, 1].map((i) => {
    const day = days[i];
    const title = day?.title ?? `Matchday ${(week - 1) * 2 + i + 1}`;
    const state = !day ? "next" : day.status === "ended" ? "done" : day.status === "live" ? "live" : "next";
    return { title, state, date: day?.date };
  });
  const played = slots.filter((d) => d.state === "done").length;
  const next = slots.find((d) => d.state !== "done");
  const live = next?.state === "live";

  // A different line each week, the same one on every visit.
  const lines = [
    `Half the story's written. ${next?.title ?? "The next match day"} decides who makes the six.`,
    "One match day down, one to go — every shirt is still up for grabs.",
    `The bibs are still in the wash. Nobody's in until ${next?.title ?? "the next match day"} is done.`,
    `Six places, a whole squad chasing them. ${next?.title ?? "The next match day"} settles it.`,
  ];
  const line = live
    ? `${next!.title} is being played right now — every goal, save and clean sheet can change the six.`
    : lines[week % lines.length];
  const tick = ["Not complete yet", `Week ${week}`, `${played} of 2 match days done`, "Team of the week loading", "Player of the week TBC"];

  return (
    <div className="vw-wip mt-8" role="status" aria-label={`Week ${week}: team of the week not complete yet, ${played} of 2 match days done`}>
      <div className="vw-ticker" aria-hidden="true">
        {[0, 1].map((k) => (
          <div key={k} className="vw-ticker-track">
            {[...tick, ...tick].map((t, i) => (
              <span key={i}>{t} ★</span>
            ))}
          </div>
        ))}
      </div>

      <div className="px-4 py-8 sm:px-8 md:py-12">
        <h3 className="vw-title">
          <span style={{ "--i": 0 } as CSSProperties}>Team of</span>
          <span style={{ "--i": 1 } as CSSProperties}>the week</span>
        </h3>
        <p className="vw-stamp mt-5">Not complete yet</p>

        <p className="mt-6 max-w-xl text-lg font-semibold leading-snug text-paper md:text-xl">{line}</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {slots.map((d) => (
            <div key={d.title} className="vw-day" data-state={d.state}>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-paper-dim">
                {d.state === "done" ? "✓ Done" : d.state === "live" ? (
                  <>
                    <span className="vw-dot" aria-hidden="true" /> Live now
                  </>
                ) : "Still to play"}
              </p>
              <p className="mt-1 font-display text-2xl font-extrabold leading-none text-paper md:text-3xl">{d.title}</p>
              {d.date && <p className="mt-1 text-xs text-mist">{d.date}</p>}
            </div>
          ))}
        </div>

        <div className="vw-pitch mt-6" aria-hidden="true">
          {SHAPE.map(({ row }, r) => (
            <div key={r} className="vw-row">
              {row.map((pos, i) => (
                <div key={i} className="vw-slot" style={{ "--i": r * 2 + i } as CSSProperties}>
                  <span className="vw-shirt">?</span>
                  <span className="text-[0.65rem] font-bold tracking-widest text-mist">{pos}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm text-paper-dim">
          The team and player of the week are picked the moment both of the week's match days have ended.
        </p>
      </div>
    </div>
  );
}

/**
 * A finished week's team of the week, in the same style as WeekInProgress:
 * the headline, a "complete" stamp, both match days ticked off and the six
 * on the pitch in formation, the player of the week crowned.
 */
function WeekComplete({
  week,
  events,
  lineup,
  playerOfWeek,
  players,
}: {
  week: number;
  events: MatchDayEvent[];
  lineup: { pick: TeamOfWeekPick; player: Player }[];
  playerOfWeek: Player | undefined;
  players: Player[];
}) {
  const days = events
    .filter((e) => e.week === week && e.status === "ended")
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  const rows = SHAPE.map(({ row }) => lineup.filter(({ pick }) => pick.position === row[0]));
  const star = playerOfWeek && players.find((p) => p.id === playerOfWeek.id);

  // A different line each week, the same one on every visit.
  const lines = [
    "Both match days done, the ratings are in — these six earned their place.",
    "Full time on the week. Six names, no arguments.",
    "The bibs are washed and the verdict is final. Here's the week's best six.",
    "Two match days, one team. Frame it, screenshot it, send it to the group chat.",
  ];
  const tick = [
    "Complete",
    `Week ${week}`,
    "Team of the week",
    ...(star ? [`Player of the week: ${star.name}`] : []),
    ...lineup.map(({ pick, player }) => `${pick.position} ${player.name}`),
  ];

  return (
    <div className="vw-wip vw-done mt-8" aria-label={`Week ${week}: team of the week`}>
      <div className="vw-ticker" aria-hidden="true">
        {[0, 1].map((k) => (
          <div key={k} className="vw-ticker-track">
            {[...tick, ...tick].map((t, i) => (
              <span key={i}>{t} ★</span>
            ))}
          </div>
        ))}
      </div>

      <div className="px-4 py-8 sm:px-8 md:py-12">
        <h3 className="vw-title">
          <span style={{ "--i": 0 } as CSSProperties}>Team of</span>
          <span style={{ "--i": 1 } as CSSProperties}>the week</span>
        </h3>
        <p className="vw-stamp mt-5">Week {week} · Complete</p>

        <p className="mt-6 max-w-xl text-lg font-semibold leading-snug text-paper md:text-xl">{lines[week % lines.length]}</p>

        {days.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {days.slice(0, 2).map((d) => (
              <div key={d.id} className="vw-day" data-state="done">
                <p className="text-xs font-bold uppercase tracking-wider text-paper-dim">✓ Done</p>
                <p className="mt-1 font-display text-2xl font-extrabold leading-none text-paper md:text-3xl">{d.title}</p>
                <p className="mt-1 text-xs text-mist">{d.date}</p>
              </div>
            ))}
          </div>
        )}

        {lineup.length > 0 && (
          <div className="vw-pitch mt-6">
            {rows.map((row, r) => (
              <div key={r} className="vw-row">
                {row.map(({ pick, player }, i) => {
                  const crowned = star?.id === player.id;
                  return (
                    <Link
                      key={player.id}
                      to={`/squad/${player.id}`}
                      className={`vw-slot vw-pick ${crowned ? "vw-crowned" : ""}`}
                      style={{ "--i": r * 2 + i } as CSSProperties}
                      aria-label={`${pick.position}: ${player.name}${crowned ? ", player of the week" : ""}, ${pickLine(pick)}`}
                    >
                      {crowned && <CrownIcon className="vw-crown" />}
                      <span className="vw-shirt">
                        <img src={player.photo} alt="" loading="lazy" />
                      </span>
                      <span className="vw-name">{player.name}</span>
                      <span className="text-[0.6rem] font-bold tracking-widest text-mist">
                        {pick.position} · {pickLine(pick)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {star && (
          <p className="mt-4 text-sm text-paper-dim">
            <CrownIcon className="mr-1 inline h-4 w-4 -translate-y-px text-justice" />
            Player of the week: <span className="font-semibold text-paper">{star.name}</span>
          </p>
        )}
      </div>
    </div>
  );
}

/** A match day's team and player of the match day, under the week's six. */
function MatchDayCard({ day, players }: { day: MatchDayAwards; players: Player[] }) {
  const star = day.playerOfMatchDay ? players.find((p) => p.id === day.playerOfMatchDay!.playerId) : undefined;
  const bad = day.badBoy ? players.find((p) => p.id === day.badBoy!.playerId) : undefined;
  const picks = day.lineup
    .map((pick) => ({ pick, player: players.find((p) => p.id === pick.playerId) }))
    .filter((x): x is typeof x & { player: Player } => Boolean(x.player));

  return (
    <div className="bg-ink/70 p-6 backdrop-blur">
      <p className="text-sm text-paper-dim">
        {day.title} · {day.date}
      </p>
      {star && (
        <div className="mt-4 flex items-center gap-4">
          <img src={star.photo} alt="" className="duotone h-14 w-14 shrink-0 border border-justice object-cover object-top" loading="lazy" />
          <div className="min-w-0">
            <p className="text-xs text-justice">Player of the match day</p>
            <p className="truncate font-display text-2xl leading-tight text-paper">{star.name}</p>
            <p className="text-xs text-mist">{pickLine(day.playerOfMatchDay!)}</p>
          </div>
        </div>
      )}
      {bad && day.badBoy ? (
        <div className="mt-4 flex items-center gap-4">
          <img src={bad.photo} alt="" className="duotone h-14 w-14 shrink-0 border border-loss object-cover object-top grayscale" loading="lazy" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-loss">Bad boy of the day</p>
            <p className="truncate font-display text-2xl leading-tight text-paper">{bad.name}</p>
            <p className="text-xs text-mist">{formatCards(day.badBoy.yellowCards, day.badBoy.redCards)}</p>
          </div>
          <span className="flex shrink-0 gap-1" aria-hidden="true">
            {Array.from({ length: day.badBoy.yellowCards }, (_, i) => (
              <span key={`y${i}`} className="h-5 w-3.5 bg-draw" />
            ))}
            {Array.from({ length: day.badBoy.redCards }, (_, i) => (
              <span key={`r${i}`} className="h-5 w-3.5 bg-loss" />
            ))}
          </span>
        </div>
      ) : (
        <p className="mt-4 text-xs text-mist">Bad boy of the day: nobody booked — angels, the lot of them.</p>
      )}
      {picks.length > 0 && (
        <>
          <p className="mt-5 text-xs text-mist">Team of the match day</p>
          <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {picks.map(({ pick, player }) => (
              <li key={player.id} className="flex min-w-0 items-center gap-2 text-sm text-paper-dim">
                <span className="w-8 shrink-0 text-xs text-mist">{pick.position}</span>
                <img src={player.photo} alt="" className="duotone h-8 w-8 shrink-0 border border-ink-line object-cover" loading="lazy" />
                <span className="truncate">{player.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function TheVale() {
  const { players } = useSquad();
  const { events } = useMatchDay();
  const { content } = useValeContent();

  // Every ended match day that actually finished a game, one per week (the
  // latest of its two match days) — most recent first — so a visitor
  // can look back at an older week's team instead of only ever seeing the latest.
  const pastMatchDays = useMemo(() => {
    const seen = new Set<string>();
    return [...events]
      .filter((e) => e.status === "ended" && e.games.some((g) => g.status === "finished"))
      .reverse()
      .filter((e) => {
        const week = e.week ? `week-${e.week}` : e.id;
        if (seen.has(week)) return false;
        seen.add(week);
        return true;
      });
  }, [events]);

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

  // The saved Vale (with any committee hand-picks) belongs to the match day
  // it was written for; any other match day shows the awards worked out for it.
  const selectedEvent = pastMatchDays.find((e) => e.id === selectedEventId);
  const showsSaved =
    !selectedEvent ||
    (content.teamOfTheWeek.week === selectedEvent.title && content.teamOfTheWeek.dateRange === selectedEvent.date);
  const awards = showsSaved
    ? content
    : team?.awards && !teamLoading
      ? valeFromApi(team.awards)
      : DEFAULT_VALE_CONTENT;
  const { playerOfTheWeek, mostImproved: mostImprovedPlayer, flopOfTheWeek, weeklyLeaders } = awards;

  const lineup = (team?.lineup ?? [])
    .map((pick) => ({ pick, player: players.find((p) => p.id === pick.playerId) }))
    .filter((x): x is typeof x & { player: NonNullable<typeof x.player> } => Boolean(x.player));
  const potw = players.find((p) => p.id === playerOfTheWeek.playerId);
  const mip = players.find((p) => p.id === mostImprovedPlayer.playerId);
  const topScorer = players.find((p) => p.id === weeklyLeaders.topScorer.playerId);
  const topAssist = players.find((p) => p.id === weeklyLeaders.topAssist.playerId);
  const topSaves = players.find((p) => p.id === weeklyLeaders.topSaves.playerId);
  const flopLineup = (team?.flopTeam?.lineupPlayerIds ?? [])
    .map((n) => players.find((p) => p.id === n))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  // A flop award left empty falls back to the one worked out for that day.
  const flopPick = (flopOfTheWeek.playerId ? flopOfTheWeek : null) ?? team?.flopPlayer ?? null;
  const flop = flopPick ? players.find((p) => p.id === flopPick.playerId) : undefined;
  const leagueBadBoy = roughestPlayer(players);
  const cleanSheetTeam = weeklyLeaders.cleanSheetTeam;
  // Midfielders and forwards don't keep clean sheets, even on the side that did.
  const cleanSheetLeaders = weeklyLeaders.cleanSheets
    .map((n) => players.find((p) => p.id === n))
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && keepsCleanSheets(p!));

  return (
    <Layout>
      <PageHeader
        eyebrow="Updated every match day"
        title="The Vale"
        description="Team and player of the week and of every match day, player honours and the stat leaders — refreshed the moment a match day ends."
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
                Week
                <select
                  value={selectedEventId ?? ""}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="mt-1 block border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper"
                >
                  {pastMatchDays.map((e) => (
                    <option key={e.id} value={e.id}>
                      {weekLabel(e.week) ?? `${e.title} — ${e.date}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {team && !teamLoading && (
            <>
              {team.complete === false && selectedEvent?.week ? (
                <WeekInProgress week={selectedEvent.week} events={events} />
              ) : selectedEvent?.week ? (
                <WeekComplete
                  week={selectedEvent.week}
                  events={events}
                  lineup={lineup}
                  playerOfWeek={players.find((p) => p.id === team.playerOfWeek?.playerId)}
                  players={players}
                />
              ) : (
                <p className="mt-4 max-w-xl text-paper-dim">
                  {team.dateRange} · The week's best keeper, two defenders, midfielder and two forwards, rated across both match days.
                </p>
              )}

              {(team.matchDays?.length ?? 0) > 0 && (
                <div className="mt-10 grid gap-px bg-ink-line md:grid-cols-2">
                  {team.matchDays!.map((day) => (
                    <MatchDayCard key={day.id} day={day} players={players} />
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
                {potw?.name ?? (team?.complete === false ? "After both match days" : "Coming soon")}
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
