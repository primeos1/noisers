import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMatchDay } from "../../lib/MatchDayContext";
import { useSquad } from "../../lib/SquadContext";
import { useSettings } from "../../lib/SettingsContext";
import { formatNaira } from "../../lib/cards";
import { eventContributions, eventGoals, eventParticipants } from "../../lib/portal";
import { participantName, scoreOf, type MatchDayGame, type MatchDayTeam, type ParticipantId } from "../../lib/matchDay";
import { CardPips, Empty, Figures, Group, LiveTag, PageTitle, PositionTag, Row } from "../../components/portal/ui";

function GameCard({ game, number, name }: { game: MatchDayGame; number: number; name: (id: ParticipantId) => string }) {
  const [open, setOpen] = useState(false);
  const [a, b] = [scoreOf(game, 0), scoreOf(game, 1)];
  const timeline = [
    ...game.goals.map((g) => ({
      key: g.id,
      minute: g.minute,
      team: g.teamIndex,
      kind: g.ownGoal ? ("og" as const) : ("goal" as const),
      text: name(g.playerId),
      sub: g.ownGoal ? "Own goal" : g.assistPlayerId != null ? `Assist from ${name(g.assistPlayerId)}` : "",
    })),
    ...game.cards.map((c) => ({
      key: c.id,
      minute: c.minute,
      team: c.teamIndex,
      kind: c.type,
      text: name(c.playerId),
      sub: c.reason,
    })),
  ].sort((x, y) => x.minute - y.minute);

  return (
    <div className="overflow-hidden rounded-2xl bg-ink-raised">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="block w-full px-4 pb-3 pt-3 text-left transition-colors hover:bg-ink-line/20"
      >
        <div className="flex items-center justify-between text-xs text-mist">
          <span>Game {number}</span>
          {game.status === "live" ? <LiveTag /> : <span>Full time</span>}
        </div>
        <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span className={`truncate text-[0.95rem] font-semibold ${a > b ? "text-paper" : "text-paper-dim"}`}>{game.teams[0].name}</span>
          <span className="font-display text-5xl font-black leading-none tabular-nums text-paper">
            {a}
            <span className="mx-1 text-ink-line">:</span>
            {b}
          </span>
          <span className={`truncate text-right text-[0.95rem] font-semibold ${b > a ? "text-paper" : "text-paper-dim"}`}>{game.teams[1].name}</span>
        </div>
        <div className="mt-2 flex items-center justify-center gap-1 text-xs text-mist">
          {timeline.length ? `${open ? "Hide" : "Show"} ${timeline.length} event${timeline.length === 1 ? "" : "s"}` : "No goals or cards"}
          {timeline.length > 0 && (
            <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>
      </button>
      {open && timeline.length > 0 && (
        <ol className="border-t border-ink-line/70 px-4 py-2">
          {timeline.map((t) => (
            <li key={t.key} className={`flex items-center gap-3 py-2 ${t.team === 1 ? "flex-row-reverse text-right" : ""}`}>
              <span className="w-8 shrink-0 text-center font-display text-lg font-bold tabular-nums text-mist">{t.minute}'</span>
              {t.kind === "goal" || t.kind === "og" ? (
                <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 ${t.kind === "og" ? "text-loss" : "text-win"}`} fill="currentColor" aria-label={t.kind === "og" ? "Own goal" : "Goal"}>
                  <circle cx="12" cy="12" r="9" />
                </svg>
              ) : (
                <span className={`h-4 w-3 shrink-0 rounded-[2px] ${t.kind === "red" ? "bg-loss" : "bg-draw"}`} aria-label={`${t.kind} card`} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-paper">{t.text}</span>
                {t.sub && <span className="block truncate text-xs text-mist">{t.sub}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function PortalMatch() {
  const { id } = useParams<{ id: string }>();
  const { events, loading } = useMatchDay();
  const { players } = useSquad();
  const { settings } = useSettings();

  const event = events.find((e) => e.id === id);

  if (!event) {
    return (
      <>
        <PageTitle title="Match sheet" back="/portal/history" />
        <Empty>{loading ? "Loading match day…" : "This match day doesn't exist any more. Pick another one from History."}</Empty>
      </>
    );
  }

  const name = (pid: ParticipantId) => participantName(players, event.guests, pid);
  const allCards = event.games.flatMap((g) => g.cards);
  const yellows = allCards.filter((c) => c.type === "yellow").length;
  const reds = allCards.filter((c) => c.type === "red").length;
  const fines = yellows * settings.yellowCardFine + reds * settings.redCardFine;
  const contributions = eventContributions(event, players);
  const involved = contributions.filter((c) => c.goals || c.assists || c.yellows || c.reds);
  const alsoPlayed = contributions.filter((c) => !involved.includes(c));

  const rosters: MatchDayTeam[] = event.groups.length
    ? event.groups
    : [...new Map(event.games.flatMap((g) => g.teams).map((t) => [t.name, t])).values()];

  return (
    <>
      <PageTitle
        title={<span className="capitalize">{event.title}</span>}
        back="/portal/history"
        sub={
          <span className="flex flex-wrap items-center gap-2 capitalize">
            {[event.date, event.venue].filter(Boolean).join(", ")}
            {event.status === "live" && <LiveTag />}
          </span>
        }
      />

      <Figures
        items={[
          { label: "Games", value: event.games.length },
          { label: "Goals", value: eventGoals(event), tone: "text-win" },
          { label: "Players", value: eventParticipants(event) },
        ]}
      />

      <section className="mb-6">
        <h2 className="mb-2 px-1 text-sm font-semibold text-paper-dim">Games</h2>
        {event.games.length === 0 ? (
          <Empty>No games have kicked off yet.</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {event.games.map((game, i) => (
              <GameCard key={game.id} game={game} number={i + 1} name={name} />
            ))}
          </div>
        )}
      </section>

      <Group title="Goals, assists and cards" aside={involved.length ? undefined : "None yet"}>
        {involved.length === 0 ? (
          <Row>
            <span className="text-sm text-mist">Nobody has scored, assisted or been booked yet.</span>
          </Row>
        ) : (
          involved.map((c) => {
            const fine = c.yellows * settings.yellowCardFine + c.reds * settings.redCardFine;
            return (
              <Row key={String(c.id)} to={typeof c.id === "number" ? `/portal/players/${c.id}` : undefined}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-paper">{c.name}</span>
                  <span className="mt-0.5 flex items-center gap-2">
                    {c.position ? <PositionTag position={c.position} /> : <span className="text-xs text-mist">Guest</span>}
                    {fine > 0 && <span className="text-xs text-loss">{formatNaira(fine)} fine</span>}
                  </span>
                </span>
                <CardPips yellow={c.yellows} red={c.reds} />
                <span className="flex shrink-0 gap-3 font-display text-xl font-bold tabular-nums">
                  {c.goals > 0 && <span className="text-win">{c.goals}<span className="ml-0.5 text-xs font-medium text-mist">G</span></span>}
                  {c.assists > 0 && <span className="text-paper">{c.assists}<span className="ml-0.5 text-xs font-medium text-mist">A</span></span>}
                </span>
              </Row>
            );
          })
        )}
      </Group>
      {alsoPlayed.length > 0 && (
        <p className="-mt-3 mb-6 px-1 text-xs leading-relaxed text-mist">Also played: {alsoPlayed.map((c) => c.name).join(", ")}</p>
      )}

      {fines > 0 && (
      <Group title="Card fines" aside={formatNaira(fines)}>
        <Row>
          <span className="h-4 w-3 rounded-[2px] bg-draw" aria-hidden="true" />
          <span className="flex-1 text-sm text-paper-dim">{yellows} yellow at {formatNaira(settings.yellowCardFine)}</span>
          <span className="font-semibold text-paper">{formatNaira(yellows * settings.yellowCardFine)}</span>
        </Row>
        <Row>
          <span className="h-4 w-3 rounded-[2px] bg-loss" aria-hidden="true" />
          <span className="flex-1 text-sm text-paper-dim">{reds} red at {formatNaira(settings.redCardFine)}</span>
          <span className="font-semibold text-paper">{formatNaira(reds * settings.redCardFine)}</span>
        </Row>
      </Group>
      )}

      <section className="mb-6">
        <h2 className="mb-2 px-1 text-sm font-semibold text-paper-dim">Teams</h2>
        {rosters.length === 0 ? (
          <Empty>Teams haven't been picked yet.</Empty>
        ) : (
          <div className="space-y-2">
            {rosters.map((team) => (
              <details key={team.name} className="group overflow-hidden rounded-2xl bg-ink-raised">
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 [&::-webkit-details-marker]:hidden">
                  <span className="font-display text-xl font-bold text-paper">{team.name}</span>
                  <span className="flex items-center gap-2 text-sm text-mist">
                    {team.players.length} players
                    <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </summary>
                <ul className="divide-y divide-ink-line/70 border-t border-ink-line/70">
                  {team.players.map((pid) => (
                    <li key={String(pid)} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className="w-7 text-right font-display text-lg font-bold text-mist">{typeof pid === "number" ? pid : ""}</span>
                      <span className="flex-1 text-paper">{name(pid)}</span>
                      {typeof pid !== "number" && <span className="text-xs text-mist">Guest</span>}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
