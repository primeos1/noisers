import { useSquad } from "../lib/SquadContext";
import { useHomeContent } from "../lib/HomeContentContext";
import { photos } from "../lib/photos";

export default function StatsBand() {
  const { players } = useSquad();
  const { content } = useHomeContent();
  const clubStats = [
    { value: String(players.length), label: "Squad" },
    ...content.stats.map((s) => ({ value: s.value, label: s.label })),
  ];

  return (
    <section className="relative border-b border-ink-line">
      <img
        src={photos.stadiumFloodlights}
        alt="Floodlights over an empty stadium bowl"
        className="duotone absolute inset-0 h-full w-full object-cover opacity-30"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-ink/85" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-px bg-ink-line md:grid-cols-4">
        {clubStats.map((stat) => (
          <div key={stat.label} className="bg-ink/60 px-4 py-8 md:px-10 md:py-14">
            <div className="font-display text-6xl leading-none text-paper md:text-7xl">
              {stat.value}
            </div>
            <div className="mt-3 text-sm text-paper-dim">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
