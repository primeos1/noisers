import { Link } from "react-router-dom";
import type { Player } from "../../lib/clubData";
import { ordinal, type Badge, type PlayerInsights } from "../../lib/insights";
import { Avatar, Bar, Figures, Group, Row } from "./ui";

function signed(n: number) {
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(2)}`;
}

function moveTone(n: number) {
  return n > 0 ? "text-win" : n < 0 ? "text-loss" : "text-paper-dim";
}

/** The player's rating over their rated match days, as a small line. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points.map((v, i) => `${(i / (points.length - 1)) * 100},${28 - ((v - min) / span) * 24}`);
  const [lastX, lastY] = coords[coords.length - 1].split(",");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-16 w-full text-draw" aria-hidden="true">
      <polyline points={coords.join(" ")} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r={2.2} fill="currentColor" />
    </svg>
  );
}

function StatLine({ label, value, sub, tone = "text-paper" }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <Row>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-paper-dim">{label}</span>
        {sub && <span className="block text-xs text-mist">{sub}</span>}
      </span>
      <span className={`shrink-0 font-display text-2xl font-bold tabular-nums ${tone}`}>{value}</span>
    </Row>
  );
}

function PersonLine({ label, player, detail }: { label: string; player: Player; detail: string }) {
  return (
    <Row to={`/portal/players/${player.id}`}>
      <Avatar player={player} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-mist">{label}</span>
        <span className="block truncate font-semibold text-paper">{player.name}</span>
      </span>
      <span className="shrink-0 text-right text-sm text-paper-dim">{detail}</span>
    </Row>
  );
}

function BadgeTile({ badge }: { badge: Badge }) {
  return (
    <div className={`rounded-2xl p-3 ring-1 ${badge.earned ? "bg-draw/10 ring-draw/40" : "bg-ink ring-ink-line"}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${badge.earned ? "bg-draw text-ink" : "bg-ink-line text-mist"}`} aria-hidden="true">
          {badge.earned ? "★" : "?"}
        </span>
        <span className={`truncate text-sm font-semibold ${badge.earned ? "text-paper" : "text-paper-dim"}`}>{badge.title}</span>
      </div>
      <p className="mt-1.5 text-xs leading-snug text-mist">
        {badge.earned ? "Unlocked · " : "Locked · "}
        {badge.description}
      </p>
    </div>
  );
}

/** Everything on the profile's Insights tab. */
export function InsightsPanel({ player, insights: i }: { player: Player; insights: PlayerInsights }) {
  const first = player.name.split(" ")[0];
  const earned = i.badges.filter((b) => b.earned).length;

  return (
    <>
      <Figures
        items={[
          { label: `Rating rank of ${i.squadSize}`, value: ordinal(i.rank.rating), tone: "text-draw" },
          { label: "Goals rank", value: player.goals ? ordinal(i.rank.goals) : "–", tone: "text-win" },
          { label: "Assists rank", value: player.assists ? ordinal(i.rank.assists) : "–" },
        ]}
      />

      <section className="mb-6 rounded-2xl bg-ink-raised p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-paper-dim">Rating journey</h2>
          <span className="text-xs text-mist">Peak {i.peakRating.toFixed(2)}</span>
        </div>
        {i.lastMove ? (
          <p className="mt-2 text-sm text-paper-dim">
            <span className={`font-display text-3xl font-bold tabular-nums ${moveTone(i.lastMove.delta)}`}>{signed(i.lastMove.delta)}</span>{" "}
            {i.lastMove.event ? <>after <span className="capitalize text-paper">{i.lastMove.event.title}</span></> : "at the last match day"}
          </p>
        ) : (
          <p className="mt-2 text-sm text-mist">The line starts after {first}'s first rated match day.</p>
        )}
        <div className="mt-3">
          <Sparkline points={i.ratingJourney} />
        </div>
      </section>

      <div className="md:grid md:grid-cols-2 md:gap-x-5">
        <Group title="Streaks">
          <StatLine label="Unbeaten run" sub="Games without a loss" value={i.unbeatenRun} tone={i.unbeatenRun >= 3 ? "text-win" : "text-paper"} />
          <StatLine label="Winning streak" sub={`Best ever: ${i.longestWinRun}`} value={i.winRun} tone={i.winRun >= 3 ? "text-win" : "text-paper"} />
          <StatLine label="Scoring streak" sub="Match days in a row with a goal" value={i.scoringRun} />
          <StatLine label="Clean record" sub="Games since the last card" value={i.bookingFreeGames} />
        </Group>

        <Group title="Records">
          <StatLine label="Win rate" value={i.winRate === null ? "–" : `${Math.round(i.winRate * 100)}%`} />
          <StatLine
            label="Best match day"
            sub={i.bestDay ? i.bestDay.event.title : "Still waiting for one"}
            value={i.bestDay ? `${i.bestDay.goals}G ${i.bestDay.assists}A` : "–"}
            tone="text-win"
          />
          <StatLine label="Earliest goal" sub="Minutes into a game" value={i.earliestGoal === null ? "–" : `${i.earliestGoal}'`} />
        </Group>
      </div>

      {(i.bestPartner || i.connection || i.nemesis) && (
        <Group title="Chemistry">
          {i.bestPartner && (
            <PersonLine
              label="Best teammate"
              player={i.bestPartner.player}
              detail={`${Math.round((i.bestPartner.wins / i.bestPartner.games) * 100)}% wins in ${i.bestPartner.games}`}
            />
          )}
          {i.connection && (
            <PersonLine label="Goal connection" player={i.connection.player} detail={`${i.connection.count} goal${i.connection.count === 1 ? "" : "s"} together`} />
          )}
          {i.nemesis && <PersonLine label="Nemesis" player={i.nemesis.player} detail={`beat ${first} ${i.nemesis.losses} times`} />}
        </Group>
      )}

      {i.milestones.length > 0 && (
        <Group title="Next milestones">
          {i.milestones.map((m) => (
            <Row key={m.label}>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-paper">{m.label}</span>
                  <span className="text-mist">{m.target - m.current} to go</span>
                </span>
                <span className="mt-2 block">
                  <Bar value={m.current} max={m.target} tone="bg-win" />
                </span>
              </span>
            </Row>
          ))}
        </Group>
      )}

      <section className="mb-6">
        <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
          <h2 className="text-sm font-semibold text-paper-dim">Badges</h2>
          <span className="text-xs text-mist">
            {earned} of {i.badges.length} unlocked
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[...i.badges]
            .sort((a, b) => Number(b.earned) - Number(a.earned))
            .map((b) => (
              <BadgeTile key={b.id} badge={b} />
            ))}
        </div>
      </section>
    </>
  );
}

/** A few headline insights for the "Your shirt" card on the portal home. */
export function InsightsTeaser({ player, insights: i }: { player: Player; insights: PlayerInsights }) {
  const earned = i.badges.filter((b) => b.earned).length;
  const next = i.milestones[0];
  const chips = [
    i.lastMove && { label: "Last match day", value: signed(i.lastMove.delta), tone: moveTone(i.lastMove.delta) },
    { label: `In squad of ${i.squadSize}`, value: ordinal(i.rank.rating), tone: "text-draw" },
    { label: "Unbeaten run", value: String(i.unbeatenRun), tone: i.unbeatenRun >= 3 ? "text-win" : "text-paper" },
    { label: "Badges", value: `${earned}/${i.badges.length}`, tone: "text-paper" },
  ].filter((c): c is { label: string; value: string; tone: string } => Boolean(c));

  return (
    <Link to={`/portal/players/${player.id}?tab=insights`} className="block border-t border-ink-line/70 px-4 py-3 transition-colors hover:bg-ink-line/20">
      <div className="grid grid-cols-4 gap-2 text-center">
        {chips.slice(0, 4).map((c) => (
          <div key={c.label}>
            <p className={`font-display text-xl font-bold leading-none tabular-nums ${c.tone}`}>{c.value}</p>
            <p className="mt-1 text-[0.65rem] leading-tight text-mist">{c.label}</p>
          </div>
        ))}
      </div>
      {next && (
        <p className="mt-3 text-center text-xs text-paper-dim">
          {next.target - next.current} away from <span className="text-paper">{next.label}</span> · see all your insights →
        </p>
      )}
    </Link>
  );
}
