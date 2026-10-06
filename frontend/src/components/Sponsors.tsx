import { useEffect, useRef, type CSSProperties, type PointerEvent } from "react";
// Single-colour (white) logos, so they sit in the site's palette.
import reckonLogo from "../assets/sponsors/reckon-mono.png";
import poundsLogo from "../assets/sponsors/pounds-mono.png";

interface Sponsor {
  name: string;
  logo: string;
  tagline: string;
}

const sponsors: Sponsor[] = [
  {
    name: "Reckon Nigeria Limited",
    logo: reckonLogo,
    tagline: "Official partner",
  },
  {
    name: "Pounds Apparel Ltd",
    logo: poundsLogo,
    tagline: "Apparel partner",
  },
];

/** Adds `is-in` once the element scrolls into view, so its CSS entrance plays. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("is-in");
        observer.disconnect();
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function SponsorCard({ sponsor, index }: { sponsor: Sponsor; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);

  // A gentle 3D tilt that follows a mouse or pen; touch keeps the float and spin.
  function tilt(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch" || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    cardRef.current.style.setProperty("--rx", `${(-y * 10).toFixed(2)}deg`);
    cardRef.current.style.setProperty("--ry", `${(x * 12).toFixed(2)}deg`);
    cardRef.current.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`);
    cardRef.current.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
  }

  function reset() {
    cardRef.current?.style.setProperty("--rx", "0deg");
    cardRef.current?.style.setProperty("--ry", "0deg");
  }

  return (
    <div
      className="sp-item"
      style={{ "--i": index } as CSSProperties}
    >
      <div ref={cardRef} className="sp-card" onPointerMove={tilt} onPointerLeave={reset}>
        <div className="sp-face">
          <span className="sp-glow" aria-hidden="true" />
          <span className="sp-shine" aria-hidden="true" />
          <img src={sponsor.logo} alt={sponsor.name} className="sp-logo" loading="lazy" draggable={false} />
          <p className="sp-caption">{sponsor.tagline}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * The club's sponsors, right under the hero: two quiet cards in the site's
 * palette (a faint light round the border, floating logo, tilt on hover)
 * and an endless logo ribbon underneath.
 */
export default function Sponsors() {
  const sectionRef = useReveal<HTMLElement>();
  // Enough copies that the ribbon is always wider than the screen; the track
  // holds two identical halves and slides one half's width per loop.
  const ribbon = [...sponsors, ...sponsors, ...sponsors];

  return (
    <section ref={sectionRef} className="sp-section relative isolate overflow-hidden border-b border-ink-line bg-ink" aria-labelledby="sponsors-title">
      <div className="mx-auto max-w-3xl px-4 pt-8 pb-6 md:px-10 md:pt-12 md:pb-8">
        <div className="sp-head text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-ink-line bg-ink-raised/70 px-3 py-1 text-[0.6rem] uppercase tracking-[0.22em] text-paper-dim">
            <span className="sp-pulse" aria-hidden="true" />
            Proudly backed by
          </p>
          <h2 id="sponsors-title" className="mt-3 font-display text-2xl leading-[0.95] text-paper md:text-4xl">
            Our sponsors
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs text-paper-dim md:text-sm">
            The partners who keep Noisers FC playing, every match day.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:mt-8 md:gap-5">
          {sponsors.map((s, i) => (
            <SponsorCard key={s.name} sponsor={s} index={i} />
          ))}
        </div>
      </div>

      <div className="sp-ribbon" aria-hidden="true">
        <div className="sp-track">
          {[...ribbon, ...ribbon].map((s, i) => (
            <img key={i} src={s.logo} alt="" className="h-4 w-auto md:h-5" loading="lazy" draggable={false} />
          ))}
        </div>
      </div>
    </section>
  );
}
