import { useMemo } from "react";
import StatTile from "../../components/admin/StatTile";
import AnimatedBarChart from "../../components/charts/AnimatedBarChart";
import StackedBarChart from "../../components/charts/StackedBarChart";
import DonutChart from "../../components/charts/DonutChart";
import { useSquad } from "../../lib/SquadContext";
import { useCards } from "../../lib/CardsContext";
import { topByStat, type Position } from "../../lib/clubData";
import { formatNaira, outstandingFines } from "../../lib/cards";

const POSITION_COLORS: Record<Position, string> = {
  GK: "#3987e5",
  DEF: "#c98500",
  MID: "#199e70",
  FWD: "#d95926",
};

const POSITION_LABEL: Record<Position, string> = {
  GK: "Goalkeepers",
  DEF: "Defenders",
  MID: "Midfielders",
  FWD: "Forwards",
};

const CARD_YELLOW = "var(--color-draw)";
const CARD_RED = "var(--color-loss)";

export default function AdminReports() {
  const { players } = useSquad();
  const { cards } = useCards();

  const totalGoals = players.reduce((sum, p) => sum + p.goals, 0);
  const totalAssists = players.reduce((sum, p) => sum + p.assists, 0);
  const totalCards = cards.length;
  const fines = outstandingFines(cards);

  const topScorers = useMemo(
    () => topByStat(players, "goals", 6).map((p) => ({ label: p.name, value: p.goals, display: `${p.goals} goals` })),
    [players],
  );
  const topAssists = useMemo(
    () => topByStat(players, "assists", 6).map((p) => ({ label: p.name, value: p.assists, display: `${p.assists} assists` })),
    [players],
  );
  const topRated = useMemo(
    () => topByStat(players, "rating", 6).map((p) => ({ label: p.name, value: p.rating, display: p.rating.toFixed(2) })),
    [players],
  );

  const positionData = useMemo(() => {
    const positions: Position[] = ["GK", "DEF", "MID", "FWD"];
    return positions.map((pos) => ({
      label: POSITION_LABEL[pos],
      value: players.filter((p) => p.position === pos).length,
      color: POSITION_COLORS[pos],
    }));
  }, [players]);

  const cardTypeData = useMemo(
    () => [
      { label: "Yellow cards", value: cards.filter((c) => c.type === "yellow").length, color: CARD_YELLOW },
      { label: "Red cards", value: cards.filter((c) => c.type === "red").length, color: CARD_RED },
    ],
    [cards],
  );

  const cardedPlayers = useMemo(() => {
    const byPlayer = new Map<number, { yellow: number; red: number }>();
    for (const c of cards) {
      const entry = byPlayer.get(c.playerNumber) ?? { yellow: 0, red: 0 };
      if (c.type === "yellow") entry.yellow += 1;
      else entry.red += 1;
      byPlayer.set(c.playerNumber, entry);
    }
    return [...byPlayer.entries()]
      .map(([number, counts]) => {
        const player = players.find((p) => p.number === number);
        return {
          label: player ? player.name : `#${number}`,
          segments: [
            { name: "Yellow", value: counts.yellow, color: CARD_YELLOW },
            { name: "Red", value: counts.red, color: CARD_RED },
          ],
        };
      })
      .sort((a, b) => {
        const totalA = a.segments.reduce((s, seg) => s + seg.value, 0);
        const totalB = b.segments.reduce((s, seg) => s + seg.value, 0);
        return totalB - totalA;
      })
      .slice(0, 8);
  }, [cards, players]);

  return (
    <div>
      <p className="animate-hero-in text-sm text-paper-dim">Season report</p>
      <h1 className="animate-hero-in mt-3 font-display text-4xl text-paper md:text-5xl [animation-delay:60ms]">
        Reports
      </h1>
      <p className="animate-hero-in mt-3 max-w-2xl text-sm text-paper-dim [animation-delay:100ms]">
        How the squad is performing this season — goals, assists, positional
        balance and discipline, at a glance.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-px bg-ink-line sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Goals scored" value={totalGoals} />
        <StatTile label="Assists" value={totalAssists} />
        <StatTile label="Cards issued" value={totalCards} />
        <StatTile label="Outstanding fines" value={formatNaira(fines)} />
      </div>

      <div className="mt-12">
        <p className="text-sm text-paper-dim">Attacking output</p>
        <h2 className="mt-2 font-display text-2xl text-paper md:text-3xl">
          Goals, assists & ratings
        </h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <AnimatedBarChart title="Top scorers" data={topScorers} color="var(--color-win)" />
          <AnimatedBarChart title="Top assists" data={topAssists} color="var(--color-paper)" />
          <AnimatedBarChart title="Highest rated" data={topRated} color="var(--color-draw)" />
        </div>
      </div>

      <div className="mt-12">
        <p className="text-sm text-paper-dim">Squad shape</p>
        <h2 className="mt-2 font-display text-2xl text-paper md:text-3xl">
          Squad composition
        </h2>
        <div className="mt-6">
          <DonutChart title="Players by position" data={positionData} centerLabel="Squad" />
        </div>
      </div>

      <div className="mt-12">
        <p className="text-sm text-paper-dim">Discipline</p>
        <h2 className="mt-2 font-display text-2xl text-paper md:text-3xl">
          Cards & carded players
        </h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <StackedBarChart
            title="Most carded players"
            data={cardedPlayers}
            legend={[
              { name: "Yellow", color: CARD_YELLOW },
              { name: "Red", color: CARD_RED },
            ]}
            emptyLabel="No cards logged yet."
          />
          <DonutChart title="Cards by type" data={cardTypeData} centerLabel="Cards" />
        </div>
      </div>
    </div>
  );
}
