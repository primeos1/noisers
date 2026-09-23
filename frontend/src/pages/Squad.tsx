import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { getSquadHonours, type Position } from "../lib/clubData";
import { useSquad } from "../lib/SquadContext";

const positionLabel: Record<Position, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

const filters: { label: string; value: Position | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Goalkeepers", value: "GK" },
  { label: "Defenders", value: "DEF" },
  { label: "Midfielders", value: "MID" },
  { label: "Forwards", value: "FWD" },
];

export default function Squad() {
  const { players } = useSquad();
  const [filter, setFilter] = useState<Position | "ALL">("ALL");

  const visible = useMemo(
    () => (filter === "ALL" ? players : players.filter((p) => p.position === filter)),
    [players, filter],
  );

  const squadHonours = useMemo(() => getSquadHonours(players), [players]);

  return (
    <Layout>
      <PageHeader
        eyebrow="This season"
        title="The squad"
        description="Every player's rating, goals, assists and clean sheets — logged set by set, position by position."
      />

      <section className="border-b border-ink-line bg-ink">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-paper-dim">Squad honours</p>
              <h2 className="mt-3 font-display text-4xl text-paper md:text-5xl">
                Best in position
              </h2>
            </div>
            <Link
              to="/performance"
              className="border border-paper/40 px-5 py-2.5 text-sm text-paper transition-colors hover:border-paper"
            >
              View performance dashboard →
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-px bg-ink-line lg:grid-cols-4">
            {squadHonours.map((honour) => (
              <div key={honour.title} className="bg-ink px-6 py-8">
                <div className="relative h-20 w-20 overflow-hidden border border-ink-line">
                  <img
                    src={honour.player.photo}
                    alt={honour.player.name}
                    className="duotone h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <p className="mt-5 text-xs uppercase tracking-wide text-mist">
                  {honour.title}
                </p>
                <p className="mt-1 font-display text-2xl leading-tight text-paper">
                  {honour.player.name}
                </p>
                <p className="mt-2 text-sm text-paper-dim">
                  <span className="text-paper">{honour.value}</span>{" "}
                  {honour.statLabel}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10">
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`border px-4 py-2 text-sm transition-colors ${
                  filter === f.value
                    ? "border-paper bg-paper text-ink"
                    : "border-ink-line text-paper-dim hover:border-paper/60 hover:text-paper"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-2 gap-px bg-ink-line sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((player) => (
              <Link
                to={`/squad/${player.number}`}
                key={player.number}
                className="group flex flex-col bg-ink transition-colors hover:bg-ink-raised"
              >
                <div className="relative aspect-square overflow-hidden border-b border-ink-line">
                  <img
                    src={player.photo}
                    alt={player.name}
                    loading="lazy"
                    className="duotone h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="duotone-wash pointer-events-none absolute inset-0" />
                  <span className="absolute left-3 top-3 font-display text-3xl leading-none text-paper drop-shadow">
                    {player.number}
                  </span>
                  <span className="absolute right-3 top-3 border border-paper/40 bg-ink/70 px-2 py-1 text-xs text-paper backdrop-blur">
                    {player.rating.toFixed(1)}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs uppercase tracking-wide text-mist">
                    {positionLabel[player.position]}
                  </p>
                  <h3 className="mt-1 font-display text-xl leading-tight text-paper">
                    {player.name}
                  </h3>

                  <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm text-paper-dim">
                    <div>
                      <dt className="text-xs text-mist">Apps</dt>
                      <dd className="text-paper">{player.appearances}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-mist">Goals</dt>
                      <dd className="text-paper">{player.goals}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-mist">Assists</dt>
                      <dd className="text-paper">{player.assists}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-mist">Clean sheets</dt>
                      <dd className="text-paper">{player.cleanSheets}</dd>
                    </div>
                  </dl>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
