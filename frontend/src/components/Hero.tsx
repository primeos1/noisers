import { Link } from "react-router-dom";
import { photos } from "../lib/photos";
import FittedImage from "./FittedImage";
import { useMatchDay } from "../lib/MatchDayContext";
import { allGames, scoreOf } from "../lib/matchDay";
import { useHomeContent } from "../lib/HomeContentContext";
import logoWhite from "../assets/brand/logo-white.png";
import MobileHero from "./MobileHero";

export default function Hero() {
  const { events } = useMatchDay();
  const { content } = useHomeContent();
  const { hero } = content;
  const games = allGames(events);
  const last = games[games.length - 1];

  const imageUrl = hero.imageUrl || photos.heroNight;

  return (
    <>
    <MobileHero
      eyebrow={hero.eyebrow}
      headline={hero.headline}
      subtext={hero.subtext}
      imageUrl={imageUrl}
      games={games}
    />
    <section className="relative hidden min-h-[92svh] flex-row items-end overflow-hidden border-b border-ink-line md:flex">
      <FittedImage
        src={imageUrl}
        alt="Noisers FC playing under floodlights on a five-a-side pitch at night"
        position="object-top"
        loading="eager"
        className="duotone"
      />
      <div className="duotone-wash pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-ink via-ink/60 to-transparent" />

      <img
        src={logoWhite}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-1/2 hidden w-[38rem] -translate-y-1/2 opacity-[0.07] md:block"
      />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-10 pt-24 md:px-10 md:pb-24 md:pt-40">
        <p className="animate-hero-in text-sm text-paper-dim [animation-delay:0ms]">
          {hero.eyebrow}
        </p>

        <h1 className="animate-hero-in mt-4 max-w-3xl font-display text-[3.5rem] leading-[0.92] tracking-tight text-paper [animation-delay:80ms] sm:text-7xl md:text-8xl">
          {hero.headline}
        </h1>

        <p className="animate-hero-in mt-5 max-w-lg text-base leading-relaxed md:mt-6 md:text-lg text-paper-dim [animation-delay:160ms]">
          {hero.subtext}
        </p>

        <div className="animate-hero-in mt-8 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4 [animation-delay:240ms]">
          <Link
            to="/squad"
            className="border border-paper bg-paper px-6 py-3.5 text-center text-sm font-medium text-ink sm:py-3 transition-colors hover:bg-transparent hover:text-paper"
          >
            Meet the squad
          </Link>
          <a
            href="#matchday"
            className="border border-paper/40 px-6 py-3.5 text-center text-sm text-paper sm:py-3 transition-colors hover:border-paper"
          >
            See match days
          </a>
        </div>

        {last && (
        <div className="animate-hero-in mt-10 flex flex-col gap-1 border-t md:mt-14 md:flex-row md:items-center md:gap-4 border-ink-line pt-6 text-sm text-paper-dim [animation-delay:320ms]">
          <span className="text-paper">Last match day</span>
          <span>
            {last.game.teams[0].name} {scoreOf(last.game, 0)}–{scoreOf(last.game, 1)}{" "}
            {last.game.teams[1].name} · {last.event.date}
          </span>
        </div>
        )}
      </div>
    </section>
    </>
  );
}
