import { Link } from "react-router-dom";
import logoWhite from "../assets/brand/logo-white.png";

/**
 * Phones only. A photo-first "kick-off" hero: the match photo fills
 * the top and ends on the centre-circle arc, and the crest drops onto that line.
 */
export default function MobileHero({
  eyebrow,
  headline,
  subtext,
  imageUrl,
}: {
  eyebrow: string;
  headline: string;
  subtext: string;
  imageUrl: string;
}) {
  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden border-b border-ink-line bg-ink pb-tabbar md:hidden">
      {/* Photo, ending on the centre-circle arc */}
      <div className="kickoff-photo relative h-[40svh] min-h-[260px] shrink-0 overflow-hidden">
        <div className="kickoff-zoom absolute inset-0">
          <img
            src={imageUrl}
            alt="Noisers FC playing under floodlights on a five-a-side pitch at night"
            className="kickoff-base duotone absolute inset-0 h-full w-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-transparent to-ink/50" />
          {/* Colour copy keeping only the green pitch, over the black-and-white photo */}
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            className="kickoff-pitch absolute inset-0 h-full w-full object-cover object-top"
          />
        </div>
        <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
          <filter id="pitch-green" colorInterpolationFilters="sRGB">
            {/* Opaque only where green outweighs blue: the grass, not the teal night sky */}
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 6 -6 0 -0.12"
              result="grass"
            />
            <feColorMatrix in="SourceGraphic" type="saturate" values="1.35" result="vivid" />
            <feComposite in="vivid" in2="grass" operator="in" />
          </filter>
        </svg>
        {/* The arc line on the photo's edge, drawn out from the centre spot */}
        <div className="kickoff-arc pointer-events-none absolute inset-0" aria-hidden="true" />
      </div>

      <div className="relative -mt-10 flex flex-1 flex-col items-center px-6 text-center">
        <div className="kickoff-crest grid h-20 w-20 place-items-center rounded-full bg-ink ring-1 ring-paper/40 shadow-[0_0_0_8px_var(--color-ink),0_0_60px_rgb(246_246_243/0.15)]">
          <img src={logoWhite} alt="" aria-hidden="true" className="h-[3.75rem] w-[3.75rem]" />
        </div>

        <p className="hero-rise mt-4 text-sm text-paper-dim [animation-delay:700ms]">{eyebrow}</p>

        <h1 className="hero-rise mt-2 max-w-[12ch] font-display text-[3.4rem] font-extrabold leading-[0.9] tracking-tight text-paper [animation-delay:820ms]">
          {headline}
        </h1>

        <p className="hero-rise mt-3 max-w-[32ch] text-[0.95rem] leading-relaxed text-paper-dim [animation-delay:940ms]">
          {subtext}
        </p>

        <div className="hero-rise mt-6 flex w-full gap-3 [animation-delay:1060ms]">
          <Link
            to="/squad"
            className="flex-1 rounded-full bg-paper py-3.5 text-sm font-semibold text-ink"
          >
            Meet the squad
          </Link>
          <a href="#matchday" className="flex-1 rounded-full py-3.5 text-sm font-medium text-paper ring-1 ring-paper/30">
            See match days
          </a>
        </div>
      </div>
    </section>
  );
}
