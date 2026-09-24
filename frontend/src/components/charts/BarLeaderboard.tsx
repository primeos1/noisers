import type { Player } from "../../lib/clubData";

export default function BarLeaderboard({
  title,
  players,
  statKey,
  suffix,
}: {
  title: string;
  players: Player[];
  statKey: "goals" | "assists" | "cleanSheets" | "rating";
  suffix: string;
}) {
  const max = Math.max(...players.map((p) => p[statKey]), 1);

  return (
    <div className="border border-ink-line bg-ink-raised p-6">
      <h3 className="font-display text-xl text-paper">{title}</h3>
      <ul className="mt-5 space-y-4">
        {players.map((player) => {
          const value = player[statKey];
          const width = Math.max((value / max) * 100, 4);
          return (
            <li key={player.number}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-paper">{player.name}</span>
                <span className="text-paper-dim">
                  {typeof value === "number" && statKey === "rating" ? value.toFixed(2) : value}
                  {suffix}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full bg-ink">
                <div
                  className="h-full rounded-r bg-paper"
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
