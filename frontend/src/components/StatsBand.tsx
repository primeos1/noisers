import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSquad } from "../lib/SquadContext";
import { useMatchDay } from "../lib/MatchDayContext";
import { DEFAULT_HOME_CONTENT, LIVE_STATS, useHomeContent, type LiveStatId } from "../lib/HomeContentContext";
import { allGames } from "../lib/matchDay";
import { photos } from "../lib/photos";

/**
 * Counts a value like "42" or "85%" up from zero the first time it scrolls
 * into view. Anything without a leading number is shown as-is.
 */
function CountUp({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const match = /^(\d+)(.*)$/.exec(value);
  const target = match ? Number(match[1]) : 0;
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !match) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const duration = 1100;
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
          if (t < 1) frame = requestAnimationFrame(tick);
          else setShown(null);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
    // Re-run only when the number itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return (
    <span ref={ref} className="tabular-nums">
      {shown === null ? value : `${shown}${match?.[2] ?? ""}`}
    </span>
  );
}

export default function StatsBand() {
  const { players } = useSquad();
  const { events } = useMatchDay();
  const { content } = useHomeContent();
  const section = { ...DEFAULT_HOME_CONTENT.statsSection, ...content.statsSection };

  const finished = allGames(events).filter(({ game }) => game.status === "finished");
  const liveValues: Record<LiveStatId, number> = {
    squad: players.length,
    match_days: events.length,
    games: finished.length,
    goals: finished.reduce((n, { game }) => n + game.goals.length, 0),
  };

  const tiles = [
    ...LIVE_STATS.filter((s) => section.live.includes(s.id)).map((s) => ({
      key: s.id,
      value: String(liveValues[s.id]),
      label: s.label,
      live: true,
    })),
    ...content.stats.map((s) => ({ key: `custom-${s.id}`, value: s.value, label: s.label, live: false })),
  ];

  if (!section.enabled || tiles.length === 0) return null;

  return (
    <section className="relative isolate overflow-hidden border-b border-ink-line">
      <img
        src={section.imageUrl || photos.stadiumFloodlights}
        alt=""
        className="duotone absolute inset-0 -z-20 h-full w-full object-cover opacity-30"
        loading="lazy"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-ink via-ink/85 to-ink" />

      <div className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-24">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-paper-dim">{section.eyebrow || DEFAULT_HOME_CONTENT.statsSection.eyebrow}</p>
            <h2 className="mt-3 max-w-xl font-display text-5xl leading-[0.95] text-paper md:text-6xl">
              {section.headline || DEFAULT_HOME_CONTENT.statsSection.headline}
            </h2>
          </div>
          <Link to="/performance" className="text-sm text-paper-dim transition-colors hover:text-paper">
            Full season stats →
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 md:mt-12 md:gap-4 lg:grid-cols-4">
          {tiles.map((tile, i) => (
            <div
              key={tile.key}
              className={`relative overflow-hidden rounded-2xl border border-ink-line bg-ink/60 p-5 backdrop-blur-sm md:p-7 ${
                i === tiles.length - 1 && tiles.length % 2 === 1 ? "col-span-2 lg:col-span-1" : ""
              }`}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-paper/40 to-transparent" />
              <p className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.18em] text-mist md:text-xs">
                {tile.live && <span className="h-1.5 w-1.5 rounded-full bg-win" aria-hidden="true" />}
                {tile.label}
              </p>
              <p className="mt-4 font-display text-5xl leading-none text-paper md:mt-6 md:text-7xl">
                <CountUp value={tile.value} />
              </p>
            </div>
          ))}
        </div>

        {tiles.some((t) => t.live) && (
          <p className="mt-5 flex items-center gap-2 text-xs text-mist">
            <span className="h-1.5 w-1.5 rounded-full bg-win" aria-hidden="true" />
            Updates automatically after every match day
          </p>
        )}
      </div>
    </section>
  );
}
