import { useState } from "react";
import type { Player } from "../../lib/clubData";
import { useSquad } from "../../lib/SquadContext";
import { useMatchDay } from "../../lib/MatchDayContext";
import { useCards } from "../../lib/CardsContext";
import { cardCounts, eventGoals, positionLabel, positions, recentActivity, sortEvents } from "../../lib/portal";
import { Link } from "react-router-dom";
import { Avatar, Bar, CardPips, Empty, Figures, Group, PageTitle, Row, Segmented } from "../../components/portal/ui";

type View = "overview" | "leaders" | "positions" | "activity";

const positionBar = { GK: "bg-draw", DEF: "bg-win", MID: "bg-paper-dim", FWD: "bg-loss" } as const;

function Leaderboard({ title, rows, tone, format = String }: { title: string; rows: { player: Player; value: number }[]; tone: string; format?: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  return (
    <Group title={title}>
      {rows.length === 0 ? (
        <Row>
          <span className="text-sm text-mist">Nothing recorded yet.</span>
        </Row>
      ) : (
        rows.map(({ player, value }, i) => (
          <Row key={player.id} to={`/portal/players/${player.id}`}>
            <span className={`w-5 shrink-0 text-center font-display text-lg font-bold ${i === 0 ? "text-paper" : "text-mist"}`}>{i + 1}</span>
            <Avatar player={player} className={`h-9 w-9 ${i === 0 ? "ring-2 ring-justice" : ""}`} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate font-semibold text-paper">{player.name}</span>
                <span className="font-display text-2xl font-bold tabular-nums text-paper">{format(value)}</span>
              </span>
              <span className="mt-1.5 block">
                <Bar value={value} max={max} tone={tone} />
              </span>
            </span>
          </Row>
        ))
      )}
    </Group>
  );
}

const PODIUM = [
  { place: 2, height: "h-24", block: "from-[#e6eaf2]/80 to-ink", ring: "ring-[#c7cbd6]", delay: "120ms" },
  { place: 1, height: "h-32", block: "from-justice to-ink", ring: "ring-justice", delay: "0ms" },
  { place: 3, height: "h-16", block: "from-[#c98a5e]/80 to-ink", ring: "ring-[#c98a5e]", delay: "240ms" },
] as const;

/** Top three on rising blocks, gold in the middle. */
function Podium({ title, rows, unit }: { title: string; rows: { player: Player; value: number }[]; unit: string }) {
  return (
    <Group title={title}>
      <ol className="flex items-end gap-2 px-4 pt-5" aria-label={`${title}: ${rows.map((r, i) => `${i + 1}. ${r.player.name}, ${r.value} ${unit}`).join("; ")}`}>
        {PODIUM.map((step) => {
          const row = rows[step.place - 1];
          if (!row) return <li key={step.place} className="flex-1" aria-hidden="true" />;
          const gold = step.place === 1;
          return (
            <li key={step.place} className="flex min-w-0 flex-1 flex-col items-center" aria-hidden="true">
              <Link to={`/portal/players/${row.player.id}`} className="flex min-w-0 max-w-full flex-col items-center gap-1 pb-2" tabIndex={-1}>
                <Avatar player={row.player} className={`ring-2 ${step.ring} ${gold ? "h-16 w-16" : "h-12 w-12"}`} />
                <span className="max-w-full truncate text-sm font-semibold text-paper">{row.player.name.split(" ")[0]}</span>
                <span className={`font-display text-2xl font-black leading-none tabular-nums ${gold ? "text-justice" : "text-paper"}`}>{row.value}</span>
              </Link>
              <div
                className={`podium-rise flex w-full justify-center rounded-t-lg border-x border-t border-white/10 bg-gradient-to-b pt-1.5 ${step.height} ${step.block}`}
                style={{ animationDelay: step.delay }}
              >
                <span className="font-display text-3xl font-black text-paper/75">{step.place}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </Group>
  );
}

export default function PortalStats() {
  const { players } = useSquad();
  const { events } = useMatchDay();
  const { cards } = useCards();
  const [view, setView] = useState<View>("overview");

  const goals = players.reduce((s, p) => s + p.goals, 0);
  const assists = players.reduce((s, p) => s + p.assists, 0);
  const avg = players.length ? players.reduce((s, p) => s + p.rating, 0) / players.length : 0;

  const top = (key: "goals" | "assists" | "cleanSheets" | "saves" | "rating") =>
    players
      // Clean sheets only count for the back line: keepers and defenders.
      .filter((p) => key !== "cleanSheets" || [p.position, p.secondaryPosition].some((pos) => pos === "GK" || pos === "DEF"))
      .map((p) => ({ player: p, value: p[key] ?? 0 }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

  const rankings = [
    { title: "Top scorers", key: "goals", unit: "goals" },
    { title: "Top assists", key: "assists", unit: "assists" },
    { title: "Most saves", key: "saves", unit: "saves" },
    { title: "Most clean sheets", key: "cleanSheets", unit: "clean sheets" },
  ] as const;

  const booked = players
    .map((p) => ({ player: p, c: cardCounts(cards, p.id) }))
    .filter(({ c }) => c.yellow + c.red > 0)
    .sort((a, b) => b.c.red * 2 + b.c.yellow - (a.c.red * 2 + a.c.yellow))
    .slice(0, 5);

  const byPosition = positions.map((pos) => {
    const group = players.filter((p) => p.position === pos);
    return {
      pos,
      count: group.length,
      goals: group.reduce((s, p) => s + p.goals, 0),
      assists: group.reduce((s, p) => s + p.assists, 0),
      cleanSheets: group.reduce((s, p) => s + p.cleanSheets, 0),
      saves: group.reduce((s, p) => s + p.saves, 0),
      avg: group.length ? group.reduce((s, p) => s + p.rating, 0) / group.length : 0,
    };
  });

  const recentDays = sortEvents(events).slice(0, 8);
  const maxDayGoals = Math.max(...recentDays.map(eventGoals), 0);
  const activity = recentActivity(events, players);

  return (
    <>
      <PageTitle title="Team stats" sub="Every number here comes from match days." />

      <Segmented<View>
        label="Stats view"
        sticky
        value={view}
        onChange={setView}
        options={[
          { value: "overview", label: "Overview" },
          { value: "leaders", label: "Leaders" },
          { value: "positions", label: "Positions" },
          { value: "activity", label: "Activity" },
        ]}
      />

      {view === "overview" && (
        <>
          <div className="md:grid md:grid-cols-2 md:gap-x-5">
            {rankings.map((r) => {
              const rows = top(r.key).slice(0, 3);
              return rows.length ? <Podium key={r.key} title={r.title} rows={rows} unit={r.unit} /> : null;
            })}
          </div>
          <Figures
            items={[
              { label: "Goals", value: goals, tone: "text-win" },
              { label: "Assists", value: assists },
              { label: "Avg rating", value: avg.toFixed(2), tone: "text-draw" },
            ]}
          />

          <Group title="Squad by position" aside={`${players.length} players`}>
            <div className="px-4 py-4">
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
                {byPosition
                  .filter((b) => b.count > 0)
                  .map((b) => (
                    <div key={b.pos} className={positionBar[b.pos]} style={{ flexGrow: b.count }} title={`${positionLabel[b.pos]}: ${b.count}`} />
                  ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
                {byPosition.map((b) => (
                  <span key={b.pos} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-paper-dim">
                      <span className={`h-2 w-2 rounded-full ${positionBar[b.pos]}`} />
                      {positionLabel[b.pos]}
                    </span>
                    <span className="font-semibold text-paper">{b.count}</span>
                  </span>
                ))}
              </div>
            </div>
          </Group>

          <Group title="Goals per match day">
            {recentDays.length === 0 ? (
              <Row>
                <span className="text-sm text-mist">No match days yet.</span>
              </Row>
            ) : (
              recentDays.map((e) => (
                <Row key={e.id} to={`/portal/matches/${e.id}`}>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm text-paper">{e.title}</span>
                      <span className="font-display text-xl font-bold tabular-nums text-win">{eventGoals(e)}</span>
                    </span>
                    <span className="mt-1.5 block">
                      <Bar value={eventGoals(e)} max={maxDayGoals} tone="bg-win" />
                    </span>
                  </span>
                </Row>
              ))
            )}
          </Group>
        </>
      )}

      {view === "leaders" && (
        <div className="md:grid md:grid-cols-2 md:gap-x-5">
          <Leaderboard title="Most goals" rows={top("goals")} tone="bg-win" />
          <Leaderboard title="Most assists" rows={top("assists")} tone="bg-paper" />
          <Leaderboard title="Most saves" rows={top("saves")} tone="bg-travel" />
          <Leaderboard title="Most clean sheets" rows={top("cleanSheets")} tone="bg-win" />
          <Leaderboard title="Highest rated" rows={top("rating")} tone="bg-draw" format={(v) => v.toFixed(2)} />
          <Group title="Most booked">
            {booked.length === 0 ? (
              <Row>
                <span className="text-sm text-mist">No cards shown yet.</span>
              </Row>
            ) : (
              booked.map(({ player, c }) => (
                <Row key={player.id} to={`/portal/players/${player.id}`}>
                  <Avatar player={player} className="h-9 w-9" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-paper">{player.name}</span>
                  <CardPips yellow={c.yellow} red={c.red} />
                  {c.outstanding > 0 && <span className="text-xs text-loss">owes</span>}
                </Row>
              ))
            )}
          </Group>
        </div>
      )}

      {view === "positions" && (
        <div className="md:grid md:grid-cols-2 md:gap-x-5">
          {byPosition.map((b) => (
            <Group key={b.pos} title={positionLabel[b.pos]} aside={`${b.count} player${b.count === 1 ? "" : "s"}`}>
              {/* Forwards don't keep clean sheets; keepers' saves sit with GK. */}
              <div className={`grid px-2 py-4 ${b.pos === "FWD" ? "grid-cols-3" : b.pos === "GK" ? "grid-cols-5" : "grid-cols-4"}`}>
                {[
                  { l: "Goals", v: b.goals, t: "text-win" },
                  { l: "Assists", v: b.assists, t: "text-paper" },
                  ...(b.pos === "FWD" ? [] : [{ l: "Clean sheets", v: b.cleanSheets, t: "text-paper" }]),
                  ...(b.pos === "GK" ? [{ l: "Saves", v: b.saves, t: "text-paper" }] : []),
                  { l: "Avg rating", v: b.count ? b.avg.toFixed(2) : "–", t: "text-draw" },
                ].map((s) => (
                  <div key={s.l} className="px-1 text-center">
                    <p className={`font-display text-2xl font-bold leading-none tabular-nums ${s.t}`}>{s.v}</p>
                    <p className="mt-1.5 text-[0.7rem] leading-tight text-mist">{s.l}</p>
                  </div>
                ))}
              </div>
            </Group>
          ))}
        </div>
      )}

      {view === "activity" &&
        (activity.length === 0 ? (
          <Empty>No goals or cards logged yet. They'll appear here as match days are played.</Empty>
        ) : (
          <Group title="Latest goals and cards">
            {activity.map((a) => (
              <Row key={a.key} to={`/portal/matches/${a.event.id}`}>
                <span className="w-8 shrink-0 text-center font-display text-lg font-bold tabular-nums text-mist">{a.minute}'</span>
                {a.kind === "goal" || a.kind === "own-goal" ? (
                  <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 ${a.kind === "own-goal" ? "text-loss" : "text-win"}`} fill="currentColor" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                ) : (
                  <span className={`h-4 w-3 shrink-0 rounded-[2px] ${a.kind === "red" ? "bg-loss" : "bg-draw"}`} aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-paper">{a.text}</span>
                  <span className="block truncate text-xs text-mist">
                    {a.event.title}, {a.detail}
                  </span>
                </span>
              </Row>
            ))}
          </Group>
        ))}
    </>
  );
}
