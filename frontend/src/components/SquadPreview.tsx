import { Link } from "react-router-dom";
import { useSquad } from "../lib/SquadContext";
import { positionNames } from "../lib/clubData";
import MembershipBadge from "./MembershipBadge";

export default function SquadPreview() {
  const { players } = useSquad();
  const featured = players.slice(0, 8);

  return (
    <section id="squad" className="border-b border-ink-line bg-ink">
      <div className="mx-auto max-w-7xl px-5 py-12 md:px-10 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-line pb-6">
          <div>
            <p className="text-sm text-paper-dim">This season</p>
            <h2 className="mt-2 font-display text-[2.75rem] leading-none text-paper md:mt-3 md:text-6xl">
              The squad
            </h2>
          </div>
          <p className="max-w-sm text-sm text-paper-dim">
            Every player's cards, fines, goals and assists are logged set by
            set — this is the shortlist.
          </p>
        </div>

        <div className="no-scrollbar -mx-5 mt-6 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:mt-10 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-px sm:overflow-visible sm:bg-ink-line sm:px-0 sm:pb-0 lg:grid-cols-4">
          {featured.map((player) => (
            <Link
              to={`/squad/${player.id}`}
              key={player.id}
              className="group relative flex aspect-[3/4] w-[42vw] max-w-[14rem] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl border border-ink-line bg-ink-raised p-4 transition-colors hover:bg-ink-raised sm:w-auto sm:max-w-none sm:rounded-none sm:border-0 sm:bg-ink sm:p-6"
            >
              <img
                src={player.photo}
                alt={player.name}
                loading="lazy"
                className="duotone absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="duotone-wash pointer-events-none absolute inset-0" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-ink/60" />

              <div className="relative flex items-start justify-between">
                <span className="font-display text-6xl leading-none text-paper drop-shadow sm:text-7xl md:text-8xl">
                  {player.number}
                </span>
                <span className="mt-1 text-[0.65rem] text-paper drop-shadow sm:text-xs">
                  {positionNames(player)}
                </span>
              </div>

              <div className="relative">
                <MembershipBadge membership={player.membership} className="mb-2 backdrop-blur" />
                <h3 className="font-display text-xl leading-tight text-paper sm:text-2xl">
                  {player.name}
                </h3>
                <p className="mt-1 text-xs text-paper-dim sm:mt-2 sm:text-sm">
                  {player.goals} goals · {player.assists} assists
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex sm:mt-10 sm:justify-end">
          <Link
            to="/squad"
            className="w-full border border-paper/40 px-6 py-3.5 text-center text-sm text-paper transition-colors hover:border-paper sm:w-auto sm:py-3"
          >
            View full squad →
          </Link>
        </div>
      </div>
    </section>
  );
}
