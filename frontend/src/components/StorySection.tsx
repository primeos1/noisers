import { photos } from "../lib/photos";

export default function StorySection() {
  return (
    <section id="story" className="border-b border-ink-line">
      <div className="mx-auto grid max-w-7xl md:grid-cols-2">
        <div className="relative min-h-[22rem] overflow-hidden border-b border-ink-line md:min-h-[32rem] md:border-b-0 md:border-r">
          <img
            src={photos.zenithStadium}
            alt="Floodlit stadium bowl viewed from above"
            className="duotone h-full w-full object-cover"
            loading="lazy"
          />
          <div className="duotone-wash pointer-events-none absolute inset-0" />
        </div>

        <div className="flex flex-col justify-center px-6 py-16 md:px-16 md:py-0">
          <p className="text-sm text-paper-dim">Our story</p>
          <h2 className="mt-4 max-w-md font-display text-5xl leading-[0.98] text-paper md:text-6xl">
            From the vale, toward the zenith.
          </h2>
          <div className="mt-6 max-w-md space-y-4 text-base leading-relaxed text-paper-dim">
            <p>
              Noisers FC started in 2021 as a handful of regulars turning up
              for the same Saturday set. The name on the badge changed, the
              pitch didn't — and neither did the plan: play hard, look after
              each other, and keep the standard climbing every season.
            </p>
            <p>
              "Vale 2 Zenith" is the club in one line — grounded where we
              play, ambitious about where we're going. This site is how we
              run that climb: squad, sets, cards and every goal, all in one
              place.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
