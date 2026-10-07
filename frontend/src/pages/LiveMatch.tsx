import { useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { Empty, Figures, Group, LiveTag, PositionTag, Row } from "../components/portal/ui";
import { GameCard } from "./portal/PortalMatch";
import { useMatchDay } from "../lib/MatchDayContext";
import { useSquad } from "../lib/SquadContext";
import { useSettings } from "../lib/SettingsContext";
import type { Player, Position } from "../lib/clubData";
import { eventContributions, positions, sortEvents } from "../lib/portal";
import { formatClock, useMatchTimer } from "../lib/useMatchTimer";
import {
  nextFixture,
  participantName,
  scoreOf,
  type MatchDayEvent,
  type MatchDayGame,
  type MatchDayTeam,
  type ParticipantId,
  type TeamMode,
} from "../lib/matchDay";

const modeInfo: Record<TeamMode, { label: string; how: string }> = {
  random: {
    label: "Fully random",
    how: "A straight shuffle — no balancing by rating or position. Everyone was dealt round the teams in turn.",
  },
  rating: {
    label: "Balanced by rating",
    how: "Players were sorted by rating and each one went to the team with the lowest rating total so far, so the strongest and weakest are spread evenly.",
  },
  position: {
    label: "Balanced by position",
    how: "Keepers, defenders, midfielders and forwards were each spread across the teams in turn, by their main position.",
  },
};

interface TeamLine {
  team: MatchDayTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

// The day's table from finished games, ranked the way the club picks the
// day's winners (MatchDayFinalizer::teamTable): most wins, then goal
// difference, then goals scored. Games are matched to teams by name, as in
// the rotation (see nextFixture).
function dayTable(teams: MatchDayTeam[], games: MatchDayGame[]): TeamLine[] {
  const lines = teams.map((team) => ({ team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 }));
  for (const game of games) {
    if (game.status !== "finished") continue;
    ([0, 1] as const).forEach((side) => {
      const line = lines.find((l) => l.team.name === game.teams[side].name);
      if (!line) return;
      const us = scoreOf(game, side);
      const them = scoreOf(game, side === 0 ? 1 : 0);
      line.played++;
      line.goalsFor += us;
      line.goalsAgainst += them;
      if (us > them) line.won++;
      else if (us < them) line.lost++;
      else line.drawn++;
    });
  }
  return lines.sort(
    (a, b) =>
      b.won - a.won ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor ||
      a.team.name.localeCompare(b.team.name),
  );
}

function NowPlaying({ game, number, name }: { game: MatchDayGame; number: number; name: (id: ParticipantId) => string }) {
  const { settings } = useSettings();
  // Read-only: the clock lives on the game record, so it just needs ticking.
  const timer = useMatchTimer(game, () => {}, settings.matchGameMinutes);
  const [a, b] = [scoreOf(game, 0), scoreOf(game, 1)];
  const scorers = (side: 0 | 1) =>
    game.goals
      .filter((g) => g.teamIndex === side)
      .sort((x, y) => x.minute - y.minute)
      .map((g) => `${name(g.playerId)}${g.ownGoal ? " (OG)" : ""} ${g.minute}'`);

  return (
    <div className="overflow-hidden rounded-2xl bg-ink-raised ring-1 ring-loss/30">
      <div className="flex items-center justify-between px-4 pt-4 text-xs text-mist">
        <span>Game {number} · first to {settings.matchWinGoals}</span>
        <span className="flex items-center gap-2">
          <span className="font-display text-lg font-bold tabular-nums text-paper">{formatClock(timer.secondsLeft)}</span>
          <LiveTag />
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4">
        <span className="truncate text-base font-semibold text-paper">{game.teams[0].name}</span>
        <span className="font-display text-6xl font-black leading-none tabular-nums text-paper">
          {a}
          <span className="mx-1.5 text-ink-line">:</span>
          {b}
        </span>
        <span className="truncate text-right text-base font-semibold text-paper">{game.teams[1].name}</span>
      </div>
      {game.goals.length > 0 && (
        <div className="grid grid-cols-2 gap-3 border-t border-ink-line/70 px-4 py-3 text-xs text-mist">
          <ul className="space-y-0.5">{scorers(0).map((s, i) => <li key={i} className="truncate">{s}</li>)}</ul>
          <ul className="space-y-0.5 text-right">{scorers(1).map((s, i) => <li key={i} className="truncate">{s}</li>)}</ul>
        </div>
      )}
      <p className="border-t border-ink-line/70 px-4 py-2.5 text-xs text-mist">
        {timer.running ? `${timer.minute}' — clock running` : timer.isFinished ? "Time's up" : "Clock paused"}
      </p>
    </div>
  );
}

const gdOf = (l: TeamLine) => l.goalsFor - l.goalsAgainst;
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;

/** Every team in the running to win the day, leader first. */
function TeamRace({ table, liveGame, ended }: { table: TeamLine[]; liveGame: MatchDayGame | null; ended: boolean }) {
  const leader = table[0];
  const started = table.some((l) => l.played > 0);
  const level = (l: TeamLine) => l.won === leader.won && gdOf(l) === gdOf(leader);
  const sharedLead = started && table.filter(level).length > 1;
  const maxWins = Math.max(1, ...table.map((l) => l.won));

  // How a team stands in the game being played right now, if it's in it.
  const playing = (name: string) => {
    if (!liveGame) return null;
    const side = liveGame.teams[0].name === name ? 0 : liveGame.teams[1].name === name ? 1 : null;
    if (side === null) return null;
    const us = scoreOf(liveGame, side);
    const them = scoreOf(liveGame, side === 0 ? 1 : 0);
    return us > them ? `Winning ${us}–${them} now` : us < them ? `Losing ${us}–${them} now` : `Level ${us}–${them} now`;
  };

  const note = (l: TeamLine, i: number) => {
    if (!started) return "Yet to play";
    if (i === 0 || level(l)) {
      if (sharedLead) return "Level at the top";
      return ended ? "Won the day" : "In front";
    }
    const wins = leader.won - l.won;
    if (wins > 0) return `${wins} win${wins === 1 ? "" : "s"} behind`;
    return `${gdOf(leader) - gdOf(l)} goal${gdOf(leader) - gdOf(l) === 1 ? "" : "s"} behind on difference`;
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-ink-raised">
      <ol className="divide-y divide-ink-line/70">
        {table.map((l, i) => {
          const front = started && (i === 0 || level(l));
          const live = playing(l.team.name);
          return (
            <li key={l.team.name} className={`px-4 py-3 ${front ? "bg-justice/[0.06]" : ""}`}>
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-base font-bold ${
                    front ? "bg-justice text-ink" : "bg-ink text-mist"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-paper">{l.team.name}</span>
                  <span className={`block truncate text-xs ${front ? "text-justice" : "text-mist"}`}>
                    {note(l, i)}
                    {live && <span className="text-loss"> · {live}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-2xl font-bold leading-none tabular-nums text-paper">
                    {l.won}
                    <span className="ml-0.5 text-xs font-medium text-mist">W</span>
                  </span>
                  <span className="block text-xs tabular-nums text-mist">
                    {l.played} played · GD {signed(gdOf(l))}
                  </span>
                </span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink" aria-hidden="true">
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ${front ? "bg-justice" : "bg-paper-dim/60"}`}
                  style={{ width: `${Math.max(3, (l.won / maxWins) * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
      <p className="border-t border-ink-line/70 px-4 py-2.5 text-xs text-mist">
        Most wins takes it; level teams are split on goal difference. Only finished games count.
      </p>
    </div>
  );
}

function TeamCard({ team, line, players, event }: { team: MatchDayTeam; line?: TeamLine; players: Player[]; event: MatchDayEvent }) {
  const squad = team.players.map((id) => (typeof id === "number" ? players.find((p) => p.id === id) : undefined));
  const rated = squad.filter((p): p is Player => !!p);
  const avg = rated.length ? rated.reduce((s, p) => s + p.rating, 0) / rated.length : null;
  const count = (pos: Position) => rated.filter((p) => p.position === pos).length;

  return (
    <div className="overflow-hidden rounded-2xl bg-ink-raised">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
        <h3 className="font-display text-2xl font-bold text-paper">{team.name}</h3>
        {line && line.played > 0 && (
          <span className="text-xs text-mist">
            {line.won}W {line.drawn}D {line.lost}L
          </span>
        )}
      </div>
      <p className="mt-1 flex flex-wrap gap-x-3 px-4 text-xs text-mist">
        <span>{team.players.length} players</span>
        {avg !== null && <span>Avg rating {avg.toFixed(2)}</span>}
        <span>{positions.map((pos) => `${count(pos)} ${pos}`).join(" · ")}</span>
      </p>
      <ul className="mt-3 divide-y divide-ink-line/70 border-t border-ink-line/70">
        {team.players.map((id, i) => {
          const player = squad[i];
          const label = participantName(players, event.guests, id);
          return (
            <li key={String(id)}>
              {player ? (
                <Link to={`/squad/${player.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-ink-line/25">
                  <span className="min-w-0 flex-1 truncate text-paper">{label}</span>
                  <PositionTag position={player.position} />
                </Link>
              ) : (
                <span className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-paper">{label}</span>
                  <span className="text-xs text-mist">Guest</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The current match day as it happens — the draw, the games and the day's numbers. */
export default function LiveMatch() {
  const { events, loading, watchLive } = useMatchDay();
  const { players } = useSquad();
  const { settings } = useSettings();
  // Keep up with the admins recording it.
  useEffect(() => watchLive(), [watchLive]);

  // The match day under way, or else the last one played.
  const sorted = sortEvents(events);
  const event = sorted.find((e) => e.status === "live") ?? sorted[0];

  if (!event) {
    return (
      <Layout>
        <PageHeader eyebrow="Matchday" title="Live Match" />
        <section className="mx-auto max-w-7xl px-5 py-10 md:px-10">
          <Empty>{loading ? "Loading match day…" : "No match day yet — check back on Wednesday or Sunday."}</Empty>
        </section>
      </Layout>
    );
  }

  const live = event.status === "live";
  const name = (id: ParticipantId) => participantName(players, event.guests, id);
  const teams: MatchDayTeam[] = event.groups.length
    ? event.groups
    : [...new Map(event.games.flatMap((g) => g.teams).map((t) => [t.name, t])).values()];
  const table = dayTable(teams, event.games);
  const liveGame = event.games.find((g) => g.status === "live") ?? null;
  const finished = event.games.filter((g) => g.status === "finished");
  const upNext = live && !liveGame && event.groups.length > 1 ? nextFixture(event.groups, event.games).next : null;

  const squadCount = event.presentPlayers.length;
  const guestCount = event.guests.length;
  const mode = event.teamMode ? modeInfo[event.teamMode] : null;

  const contributions = eventContributions(event, players);
  const leaders = (key: "goals" | "assists" | "saves") =>
    contributions.filter((c) => c[key] > 0).sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name)).slice(0, 5);
  const booked = contributions.filter((c) => c.yellows || c.reds);
  const goals = event.games.reduce((n, g) => n + g.goals.length, 0);
  const cards = event.games.reduce((n, g) => n + g.cards.length, 0);
  const saves = event.games.reduce((n, g) => n + (g.saves ?? []).length, 0);

  return (
    <Layout>
      <PageHeader
        eyebrow={live ? "Happening now" : "Last match day"}
        title="Live Match"
        description={
          <span className="flex flex-wrap items-center gap-2 capitalize">
            <span className="font-semibold text-paper">{event.title}</span>
            {[event.date, event.venue].filter(Boolean).join(" · ")}
            {live ? <LiveTag /> : <span className="text-mist">Full time</span>}
          </span>
        }
      />

      <section className="bg-ink">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:px-10 md:py-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <h2 className="mb-2 px-1 text-sm font-semibold text-paper-dim">{liveGame ? "Now playing" : "Games"}</h2>
            {liveGame ? (
              <NowPlaying game={liveGame} number={event.games.indexOf(liveGame) + 1} name={name} />
            ) : upNext ? (
              <Group>
                <Row>
                  <span className="flex-1 text-sm text-paper-dim">Up next</span>
                  <span className="font-semibold text-paper">
                    {event.groups[upNext[0]].name} <span className="text-mist">v</span> {event.groups[upNext[1]].name}
                  </span>
                </Row>
              </Group>
            ) : event.games.length === 0 ? (
              <Empty>{teams.length ? "Teams are picked — kick-off is coming." : "Teams haven't been picked yet."}</Empty>
            ) : null}

            {table.length > 1 && (
              <div className="mt-6">
                <h2 className="mb-2 px-1 text-sm font-semibold text-paper-dim">
                  {live ? "Race to win the day" : "Winners of the day"}
                </h2>
                <TeamRace table={table} liveGame={liveGame} ended={!live} />
              </div>
            )}

            {finished.length > 0 && (
              <div className="mt-6">
                <h2 className="mb-2 px-1 text-sm font-semibold text-paper-dim">Results</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {[...finished].reverse().map((game) => (
                    <GameCard key={game.id} game={game} number={event.games.indexOf(game) + 1} name={name} />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8">
              <h2 className="mb-2 px-1 text-sm font-semibold text-paper-dim">How the teams were picked</h2>
              <div className="rounded-2xl bg-ink-raised p-4">
                <p className="font-display text-2xl font-bold text-paper">{mode ? mode.label : "Teams drawn by the admins"}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">
                  {mode ? mode.how : "The draw method wasn't recorded for this match day."}
                </p>
                <ul className="mt-3 space-y-1 text-xs leading-relaxed text-mist">
                  <li>
                    {squadCount} squad player{squadCount === 1 ? "" : "s"}
                    {guestCount > 0 && ` and ${guestCount} guest${guestCount === 1 ? "" : "s"}`} turned up, split into{" "}
                    {teams.length} team{teams.length === 1 ? "" : "s"} of up to {settings.matchTeamSize}.
                  </li>
                  <li>Full members were placed first, then guest members, then guests into whatever room was left.</li>
                  <li>Team colours were drawn at random; winner stays on, loser goes to the back of the queue.</li>
                </ul>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="mb-2 px-1 text-sm font-semibold text-paper-dim">Teams</h2>
              {teams.length === 0 ? (
                <Empty>Teams haven't been picked yet.</Empty>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {teams.map((team) => (
                    <TeamCard
                      key={team.name}
                      team={team}
                      line={table.find((l) => l.team.name === team.name)}
                      players={players}
                      event={event}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="min-w-0">
            <h2 className="mb-2 px-1 text-sm font-semibold text-paper-dim">Match day stats</h2>
            <Figures
              items={[
                { label: "Games", value: event.games.length },
                { label: "Goals", value: goals, tone: "text-win" },
                { label: "Saves", value: saves },
                { label: "Cards", value: cards, tone: cards ? "text-draw" : undefined },
              ]}
            />

            {table.length > 0 && (
              <Group title="Day table" aside="Ranked by wins, then goal difference">
                <div className="grid grid-cols-[1fr_repeat(5,2rem)] gap-1 px-4 py-2 text-xs text-mist">
                  <span>Team</span>
                  <span className="text-center">P</span>
                  <span className="text-center">W</span>
                  <span className="text-center">D</span>
                  <span className="text-center">L</span>
                  <span className="text-center">GD</span>
                </div>
                {table.map((l) => (
                  <div key={l.team.name} className="grid grid-cols-[1fr_repeat(5,2rem)] items-center gap-1 px-4 py-2.5 text-sm tabular-nums">
                    <span className="truncate font-semibold text-paper">{l.team.name}</span>
                    <span className="text-center text-paper-dim">{l.played}</span>
                    <span className="text-center font-bold text-paper">{l.won}</span>
                    <span className="text-center text-paper-dim">{l.drawn}</span>
                    <span className="text-center text-paper-dim">{l.lost}</span>
                    <span className="text-center text-paper-dim">{signed(gdOf(l))}</span>
                  </div>
                ))}
              </Group>
            )}

            {(
              [
                ["goals", "Top scorers", "text-win"],
                ["assists", "Assists", "text-paper"],
                ["saves", "Saves", "text-paper"],
              ] as const
            ).map(([key, title, tone]) => {
              const rows = leaders(key);
              return (
                <Group key={key} title={title} aside={rows.length ? undefined : "None yet"}>
                  {rows.length === 0 ? (
                    <Row>
                      <span className="text-sm text-mist">Nothing logged yet.</span>
                    </Row>
                  ) : (
                    rows.map((c) => (
                      <Row key={String(c.id)} to={typeof c.id === "number" ? `/squad/${c.id}` : undefined}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-paper">{c.name}</span>
                          {c.position ? <PositionTag position={c.position} /> : <span className="text-xs text-mist">Guest</span>}
                        </span>
                        <span className={`font-display text-2xl font-bold tabular-nums ${tone}`}>{c[key]}</span>
                      </Row>
                    ))
                  )}
                </Group>
              );
            })}

            {booked.length > 0 && (
              <Group title="Cards">
                {booked.map((c) => (
                  <Row key={String(c.id)}>
                    <span className="min-w-0 flex-1 truncate font-semibold text-paper">{c.name}</span>
                    <span className="flex gap-1">
                      {Array.from({ length: c.yellows }, (_, i) => (
                        <span key={`y${i}`} className="h-4 w-3 rounded-[2px] bg-draw" aria-label="Yellow card" />
                      ))}
                      {Array.from({ length: c.reds }, (_, i) => (
                        <span key={`r${i}`} className="h-4 w-3 rounded-[2px] bg-loss" aria-label="Red card" />
                      ))}
                    </span>
                  </Row>
                ))}
              </Group>
            )}
          </aside>
        </div>
      </section>
    </Layout>
  );
}
