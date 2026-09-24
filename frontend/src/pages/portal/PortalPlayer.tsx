import { useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useSquad } from "../../lib/SquadContext";
import { useCards } from "../../lib/CardsContext";
import { useMatchDay } from "../../lib/MatchDayContext";
import { formatNaira } from "../../lib/cards";
import { cardCounts, playerGameLog, positionLabel, useMyShirt } from "../../lib/portal";
import {
  CardPips,
  Empty,
  Figures,
  Group,
  PageTitle,
  RatingMeter,
  ResultChip,
  Row,
  Segmented,
  PlayerPicture,
} from "../../components/portal/ui";

type Tab = "overview" | "games" | "form" | "fines";

function Line({ label, value, tone = "text-paper" }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <Row>
      <span className="flex-1 text-sm text-paper-dim">{label}</span>
      <span className={`font-semibold tabular-nums ${tone}`}>{value}</span>
    </Row>
  );
}

export default function PortalPlayer() {
  const { number } = useParams<{ number: string }>();
  const { players, loading } = useSquad();
  const { cards } = useCards();
  const { events } = useMatchDay();
  const [myShirt, setMyShirt] = useMyShirt();
  const [tab, setTab] = useState<Tab>("overview");

  const playerNumber = Number(number);
  const player = players.find((p) => p.number === playerNumber);

  if (!player) {
    return (
      <>
        <PageTitle title="Player" back="/portal" />
        <Empty>{loading ? "Loading player…" : `Nobody wears number ${number} for Noisers. Pick someone from the Squad tab.`}</Empty>
      </>
    );
  }

  const log = playerGameLog(events, playerNumber);
  const finished = log.filter((g) => g.result !== null);
  const record = {
    W: finished.filter((g) => g.result === "W").length,
    D: finished.filter((g) => g.result === "D").length,
    L: finished.filter((g) => g.result === "L").length,
  };
  const fines = cardCounts(cards, playerNumber);
  const contributions = player.goals + player.assists;
  const isMe = myShirt === playerNumber;

  const matchDays = [...new Map(log.map((g) => [g.event.id, g.event])).values()].map((event) => {
    const games = log.filter((g) => g.event.id === event.id);
    return {
      event,
      goals: games.reduce((s, g) => s + g.goals, 0),
      assists: games.reduce((s, g) => s + g.assists, 0),
    };
  });

  const form = finished.slice(0, 10);

  return (
    <>
      <PageTitle title={player.name} back="/portal" sub={`${positionLabel[player.position]}, number ${player.number}`} />

      <section className="mb-6 rounded-3xl bg-[radial-gradient(120%_90%_at_100%_0%,rgba(168,132,31,0.18),transparent_60%)] bg-ink-raised p-4 ring-1 ring-white/5 sm:p-5">
        <div className="flex items-center gap-4 sm:gap-6">
          <PlayerPicture player={player} className="h-32 w-32 sm:h-40 sm:w-40" />
          <div className="min-w-0 flex-1">
            <span className="text-sm text-mist">Rating</span>
            <p className="font-display text-6xl font-black leading-none tabular-nums text-draw">{player.rating.toFixed(2)}</p>
            <RatingMeter rating={player.rating} className="mt-3" />
          </div>
        </div>
        <div>
          <div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex gap-1.5" aria-label="Last five results">
                {form.length ? form.slice(0, 5).map((g) => <ResultChip key={`${g.event.id}-${g.game.id}`} result={g.result} />) : <span className="text-sm text-mist">No results yet</span>}
              </div>
              <button
                type="button"
                onClick={() => setMyShirt(isMe ? null : playerNumber)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${isMe ? "bg-paper text-ink" : "bg-ink text-paper-dim ring-1 ring-ink-line hover:text-paper"}`}
              >
                {isMe ? "This is you" : "This is me"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <Figures
        items={[
          { label: "Games", value: player.appearances },
          { label: "Goals", value: player.goals, tone: "text-win" },
          { label: "Assists", value: player.assists },
          { label: "Clean sheets", value: player.cleanSheets },
        ]}
      />

      <Segmented<Tab>
        label="Profile section"
        sticky
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Overview" },
          { value: "games", label: "Games" },
          { value: "form", label: "Form" },
          { value: "fines", label: "Fines" },
        ]}
      />

      {tab === "overview" && (
        <div className="md:grid md:grid-cols-2 md:gap-x-5">
          <Group title="Scoring">
            <Line label="Goals" value={player.goals} tone="text-win" />
            <Line label="Assists" value={player.assists} />
            <Line label="Goals plus assists per game" value={player.appearances ? (contributions / player.appearances).toFixed(2) : "–"} />
          </Group>
          <Group title="Results">
            <Line label="Won" value={record.W} tone="text-win" />
            <Line label="Drawn" value={record.D} tone="text-draw" />
            <Line label="Lost" value={record.L} tone="text-loss" />
          </Group>
          <Group title="Discipline" className="md:col-span-2">
            <Row>
              <span className="flex-1 text-sm text-paper-dim">Cards</span>
              {fines.cards.length ? <CardPips yellow={fines.yellow} red={fines.red} /> : <span className="font-semibold text-paper">None</span>}
            </Row>
            <Line label="Fines owed" value={formatNaira(fines.outstanding)} tone={fines.outstanding ? "text-loss" : "text-win"} />
          </Group>
        </div>
      )}

      {tab === "games" &&
        (matchDays.length === 0 ? (
          <Empty>{player.name.split(" ")[0]} hasn't played a match day yet.</Empty>
        ) : (
          matchDays.map((m) => (
            <Group
              key={m.event.id}
              title={<span className="capitalize">{m.event.title}</span>}
              aside={
                <span>
                  {m.goals > 0 && <span className="text-win">{m.goals} goal{m.goals === 1 ? "" : "s"}</span>}
                  {m.goals > 0 && m.assists > 0 && ", "}
                  {m.assists > 0 && `${m.assists} assist${m.assists === 1 ? "" : "s"}`}
                  {m.goals === 0 && m.assists === 0 && <span className="capitalize">{m.event.date}</span>}
                </span>
              }
            >
              {log
                .filter((g) => g.event.id === m.event.id)
                .map((g) => (
                  <Row key={g.game.id} to={`/portal/matches/${g.event.id}`}>
                    <ResultChip result={g.result} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-paper">
                        {g.teamName} <span className="font-display text-lg font-bold tabular-nums">{g.goalsFor}–{g.goalsAgainst}</span>
                      </span>
                      <span className="block text-xs text-mist">Game {g.gameNumber}</span>
                    </span>
                    <CardPips yellow={g.yellows} red={g.reds} />
                    {(g.goals > 0 || g.assists > 0) && (
                      <span className="shrink-0 text-sm font-semibold">
                        {g.goals > 0 && <span className="text-win">{g.goals}G</span>} {g.assists > 0 && <span className="text-paper">{g.assists}A</span>}
                      </span>
                    )}
                  </Row>
                ))}
            </Group>
          ))
        ))}

      {tab === "form" &&
        (form.length === 0 ? (
          <Empty>No finished games yet, so there's no form to show.</Empty>
        ) : (
          <>
            <section className="mb-6 rounded-2xl bg-ink-raised p-4">
              <p className="text-sm text-paper-dim">Last {form.length} games, newest first</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {form.map((g) => (
                  <ResultChip key={`${g.event.id}-${g.game.id}`} result={g.result} size="lg" />
                ))}
              </div>
            </section>
            <Figures
              items={[
                { label: "Won", value: record.W, tone: "text-win" },
                { label: "Drawn", value: record.D, tone: "text-draw" },
                { label: "Lost", value: record.L, tone: "text-loss" },
                { label: "Win rate", value: `${Math.round((record.W / finished.length) * 100)}%` },
              ]}
            />
          </>
        ))}

      {tab === "fines" && (
        <>
          <Figures
            items={[
              { label: "Owed", value: formatNaira(fines.outstanding), tone: fines.outstanding ? "text-loss" : "text-paper" },
              { label: "Paid", value: formatNaira(fines.paid), tone: "text-win" },
            ]}
          />
          {fines.cards.length === 0 ? (
            <Empty>No cards, no fines. Keep it that way.</Empty>
          ) : (
            <Group title="Cards">
              {[...fines.cards].reverse().map((c) => (
                <Row key={c.id}>
                  <span className={`h-5 w-3.5 shrink-0 rounded-[3px] ${c.type === "red" ? "bg-loss" : "bg-draw"}`} aria-label={`${c.type} card`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-paper">{c.reason || `${c.type === "red" ? "Red" : "Yellow"} card`}</span>
                    <span className="block text-xs text-mist">{c.date}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums text-paper">{formatNaira(c.fine)}</span>
                    <span className={`block text-xs ${c.paid ? "text-win" : "text-loss"}`}>{c.paid ? "Paid" : "Not paid"}</span>
                  </span>
                </Row>
              ))}
            </Group>
          )}
        </>
      )}
    </>
  );
}
