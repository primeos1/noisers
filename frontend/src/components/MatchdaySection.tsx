import { photos } from "../lib/photos";
import { latestResult, nextFixture } from "../lib/clubData";

export default function MatchdaySection() {
  return (
    <section id="matchday" className="border-b border-ink-line">
      <div className="mx-auto grid max-w-7xl md:grid-cols-2">
        <div className="relative flex min-h-[26rem] flex-col justify-end overflow-hidden border-b border-ink-line p-10 md:border-b-0 md:border-r">
          <img
            src={photos.emptyPitchNight}
            alt="Empty floodlit pitch before kick-off"
            className="duotone absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div className="duotone-wash pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink via-ink/70 to-transparent" />
          <div className="relative z-10">
            <p className="text-sm text-paper-dim">Next fixture</p>
            <h3 className="mt-3 font-display text-4xl text-paper md:text-5xl">
              Noisers FC v {nextFixture.opponent}
            </h3>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm text-paper-dim">
              <div>
                <dt className="text-mist">Kick-off</dt>
                <dd className="mt-1 text-paper">
                  {nextFixture.date}, {nextFixture.time}
                </dd>
              </div>
              <div>
                <dt className="text-mist">Venue</dt>
                <dd className="mt-1 text-paper">
                  {nextFixture.venue} · {nextFixture.location}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-mist">Competition</dt>
                <dd className="mt-1 text-paper">{nextFixture.competition}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex min-h-[26rem] flex-col justify-center bg-ink-raised p-10">
          <p className="text-sm text-paper-dim">Latest result</p>
          <div className="mt-4 flex items-baseline gap-4">
            <span className="font-display text-7xl text-paper md:text-8xl">
              {latestResult.scoreFor}–{latestResult.scoreAgainst}
            </span>
            <span className="text-lg text-paper-dim">
              {latestResult.venue === "Home" ? "vs" : "at"}{" "}
              {latestResult.opponent}
            </span>
          </div>
          <p className="mt-2 text-sm text-mist">{latestResult.date}</p>

          <div className="mt-8 border-t border-ink-line pt-6">
            <p className="text-sm text-paper-dim">Scorers</p>
            <ul className="mt-3 space-y-2 text-paper">
              {latestResult.scorers.map((scorer) => (
                <li key={scorer} className="text-sm">
                  {scorer}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
