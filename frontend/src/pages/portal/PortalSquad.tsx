import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { roughestPlayer, formatCards, type Player } from "../../lib/clubData";
import { useSquad } from "../../lib/SquadContext";
import { useCards } from "../../lib/CardsContext";
import { useMatchDay } from "../../lib/MatchDayContext";
import { formatNaira } from "../../lib/cards";
import { scoreOf } from "../../lib/matchDay";
import { cardCounts, playerGameLog, positions, sortEvents, useMyShirt } from "../../lib/portal";
import { playerInsights } from "../../lib/insights";
import { InsightsTeaser } from "../../components/portal/Insights";
import {
  CardPips,
  Empty,
  Group,
  LiveTag,
  RatingMeter,
  ResultChip,
  Row,
  Avatar,
  PlayerPicture,
} from "../../components/portal/ui";

const groupName = { GK: "Goalkeepers", DEF: "Defenders", MID: "Midfielders", FWD: "Forwards" } as const;

function MyShirt({ player, onChange }: { player: Player; onChange: () => void }) {
  const { cards } = useCards();
  const { events } = useMatchDay();
  const { players } = useSquad();
  const insights = useMemo(() => playerInsights(player, players, events), [player, players, events]);
  const fines = cardCounts(cards, player.number);
  const form = playerGameLog(events, player.number).filter((g) => g.result).slice(0, 5);

  return (
    <section className="mb-6 overflow-hidden rounded-3xl bg-[radial-gradient(120%_90%_at_100%_0%,rgba(168,132,31,0.18),transparent_60%)] bg-ink-raised ring-1 ring-white/5">
      <div className="flex items-center gap-4 p-4 pb-3">
        <PlayerPicture player={player} className="h-28 w-28" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-mist">Your shirt</p>
          <p className="truncate font-display text-2xl font-bold leading-tight text-paper">{player.name}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-4xl font-black leading-none text-draw">{player.rating.toFixed(2)}</span>
            <span className="text-xs text-mist">rating</span>
          </div>
          <RatingMeter rating={player.rating} className="mt-2" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-ink-line/70 px-4 py-3">
        <div className="flex gap-1.5" aria-label="Recent results">
          {form.length ? form.map((g) => <ResultChip key={`${g.event.id}-${g.game.id}`} result={g.result} />) : <span className="text-sm text-mist">No results yet</span>}
        </div>
        <span className={`text-sm font-semibold ${fines.outstanding ? "text-loss" : "text-win"}`}>
          {fines.outstanding ? `${formatNaira(fines.outstanding)} owed` : "No fines owed"}
        </span>
      </div>
      <InsightsTeaser player={player} insights={insights} />
      <div className="grid grid-cols-2 border-t border-ink-line/70 text-sm font-semibold">
        <Link to={`/portal/players/${player.number}`} className="py-3 text-center text-paper transition-colors hover:bg-ink-line/30">
          Open my profile
        </Link>
        <button type="button" onClick={onChange} className="border-l border-ink-line/70 py-3 text-paper-dim transition-colors hover:bg-ink-line/30">
          Not me
        </button>
      </div>
    </section>
  );
}

function PickShirt({ players, onPick }: { players: Player[]; onPick: (n: number) => void }) {
  return (
    <section className="mb-6 rounded-3xl bg-ink-raised p-4">
      <p className="font-display text-2xl font-bold text-paper">Which shirt is yours?</p>
      <p className="mt-1 text-sm text-paper-dim">Tap your number to put your rating, form and fines at the top. It's only saved on this phone.</p>
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {[...players]
          .sort((a, b) => a.number - b.number)
          .map((p) => (
            <button
              key={p.number}
              type="button"
              onClick={() => onPick(p.number)}
              aria-label={`${p.name}, number ${p.number}`}
              className="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-full bg-ink px-3 font-display text-xl font-bold text-paper ring-1 ring-ink-line transition-colors hover:bg-paper hover:text-ink"
            >
              {p.number}
            </button>
          ))}
      </div>
    </section>
  );
}

export default function PortalSquad() {
  const { players, loading } = useSquad();
  const { cards } = useCards();
  const { events } = useMatchDay();
  const [myShirt, setMyShirt] = useMyShirt();
  const [query, setQuery] = useState("");

  const me = players.find((p) => p.number === myShirt);
  const latest = sortEvents(events)[0];
  const roughest = roughestPlayer(players);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => players.filter((p) => !q || p.name.toLowerCase().includes(q) || String(p.number).includes(q)),
    [players, q],
  );

  return (
    <>
      <h1 className="sr-only">Squad</h1>

      {me ? <MyShirt player={me} onChange={() => setMyShirt(null)} /> : players.length > 0 && <PickShirt players={players} onPick={setMyShirt} />}

      {latest && (
        <Group title="Latest match day" aside={latest.status === "live" ? <LiveTag /> : <span className="capitalize">{latest.date}</span>}>
          <Row to={`/portal/matches/${latest.id}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl font-bold capitalize text-paper">{latest.title}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {latest.games.length === 0 ? (
                  <span className="text-sm text-mist">No games yet</span>
                ) : (
                  latest.games.map((g) => (
                    <span key={g.id} className="rounded-lg bg-ink px-2 py-1 font-display text-sm font-semibold tabular-nums text-paper-dim">
                      {g.teams[0].name} {scoreOf(g, 0)}–{scoreOf(g, 1)} {g.teams[1].name}
                    </span>
                  ))
                )}
              </div>
            </div>
          </Row>
        </Group>
      )}

      {roughest && (
        <Group title="Roughest player" aside="Most cards this season">
          <Row to={`/portal/players/${roughest.number}`}>
            <Avatar player={roughest} className="h-12 w-12" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-paper">{roughest.name}</span>
              <span className="block text-xs text-mist">{formatCards(roughest.yellowCards, roughest.redCards)}</span>
            </span>
            <CardPips yellow={roughest.yellowCards} red={roughest.redCards} />
          </Row>
        </Group>
      )}

      <label className="relative mb-6 block">
        <span className="sr-only">Find a player</span>
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a player by name or number"
          className="w-full rounded-full bg-ink-raised py-3 pl-11 pr-4 text-base text-paper placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-paper/50"
        />
      </label>

      {visible.length === 0 ? (
        <Empty>{loading ? "Loading the squad…" : `No one matches "${query}". Try a surname or a shirt number.`}</Empty>
      ) : (
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-5">
          {positions.map((pos) => {
            const group = visible.filter((p) => p.position === pos).sort((a, b) => a.number - b.number);
            if (group.length === 0) return null;
            return (
              <Group key={pos} title={groupName[pos]} aside={group.length}>
                {group.map((p) => {
                  const c = cardCounts(cards, p.number);
                  return (
                    <Row key={p.number} to={`/portal/players/${p.number}`}>
                      <span className="w-9 shrink-0 text-right font-display text-[1.7rem] font-black leading-none tabular-nums text-paper-dim">{p.number}</span>
                      <Avatar player={p} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-semibold text-paper">{p.name}</span>
                          {p.number === myShirt && <span className="shrink-0 rounded-full bg-paper/10 px-1.5 text-[0.65rem] text-paper-dim">You</span>}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-mist">
                          {p.appearances} game{p.appearances === 1 ? "" : "s"}, {p.goals} goal{p.goals === 1 ? "" : "s"}
                          <CardPips yellow={c.yellow} red={c.red} />
                        </span>
                      </span>
                      <span className="shrink-0 font-display text-2xl font-bold tabular-nums text-draw">{p.rating.toFixed(2)}</span>
                    </Row>
                  );
                })}
              </Group>
            );
          })}
        </div>
      )}
    </>
  );
}
