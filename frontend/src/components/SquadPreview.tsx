import { squad } from "../lib/clubData";

const positionLabel: Record<string, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

export default function SquadPreview() {
  const featured = squad.slice(0, 8);

  return (
    <section id="squad" className="border-b border-ink-line bg-ink">
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-line pb-6">
          <div>
            <p className="text-sm text-paper-dim">This season</p>
            <h2 className="mt-3 font-display text-5xl text-paper md:text-6xl">
              The squad
            </h2>
          </div>
          <p className="max-w-sm text-sm text-paper-dim">
            Every player's cards, fines, goals and assists are logged set by
            set — this is the shortlist.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-px bg-ink-line sm:grid-cols-3 lg:grid-cols-4">
          {featured.map((player) => (
            <article
              key={player.number}
              className="group flex aspect-[3/4] flex-col justify-between bg-ink p-6 transition-colors hover:bg-ink-raised"
            >
              <div className="flex items-start justify-between">
                <span className="font-display text-7xl leading-none text-paper-dim transition-colors group-hover:text-paper md:text-8xl">
                  {player.number}
                </span>
                <span className="mt-1 text-xs text-mist">
                  {positionLabel[player.position]}
                </span>
              </div>

              <div>
                <h3 className="font-display text-2xl leading-tight text-paper">
                  {player.name}
                </h3>
                <p className="mt-2 text-sm text-paper-dim">
                  {player.goals} goals · {player.assists} assists
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
