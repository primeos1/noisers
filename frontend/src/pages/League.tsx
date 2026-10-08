import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { buildSchedule, clockTime, clubs, GAME_MINUTES, GAMES_PER_NIGHT, ideas, KICK_OFF, type Club, type ClubId } from "../lib/league";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const byId = new Map(clubs.map((c) => [c.id, c]));
const club = (id: ClubId) => byId.get(id)!;
const season = buildSchedule();

const clubVars = (c: Club) =>
  ({
    "--c1": c.colours.primary,
    "--c2": c.colours.secondary,
    "--c3": c.colours.stripe ?? c.colours.primary,
    "--glow": c.colours.glow,
    "--on": c.colours.on,
  }) as CSSProperties;

/** Adds .is-in once the element scrolls into view, for the reveal animations. */
function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, threshold]);
  return [ref, inView] as const;
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`lg-reveal ${inView ? "is-in" : ""} ${className}`} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

/** Counts up from zero the first time it scrolls into view. */
function CountUp({ value }: { value: number }) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.6);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reducedMotion()) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value]);
  return <span ref={ref}>{shown}</span>;
}

/** A shield in the club's colours; Castellers carry their stripes. */
function Crest({ c, className = "h-10 w-10" }: { c: Club; className?: string }) {
  const id = useId();
  const shield = "M32 3 58 11v20c0 16-11 26-26 31C17 57 6 47 6 31V11Z";
  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 ${className}`} aria-hidden="true">
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={shield} />
        </clipPath>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect width="64" height="64" fill={c.colours.primary} />
        {c.colours.stripe &&
          [8, 24, 40, 56].map((x) => <rect key={x} x={x} y="0" width="8" height="64" fill={c.colours.stripe} />)}
        <rect width="64" height="64" fill={`url(#${id}-shine)`} />
      </g>
      <path d={shield} fill="none" stroke={c.colours.secondary} strokeWidth="3" />
      <path d="M32 9 52 15v16c0 12-8 20-20 24C20 51 12 43 12 31V15Z" fill="none" stroke={c.colours.secondary} strokeOpacity="0.35" strokeWidth="1" />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontFamily="Big Shoulders Display, Arial Narrow, sans-serif"
        fontWeight="900"
        fontSize="17"
        letterSpacing="0.5"
        fill={c.colours.stripe ? c.colours.secondary : c.colours.on}
      >
        {c.short}
      </text>
    </svg>
  );
}

const SoonDot = () => (
  <span className="relative flex h-2 w-2">
    <span className="lg-ping absolute inline-flex h-full w-full rounded-full bg-justice" />
    <span className="relative inline-flex h-2 w-2 rounded-full bg-justice" />
  </span>
);

function SectionHead({ eyebrow, title, note }: { eyebrow: string; title: string; note?: ReactNode }) {
  return (
    <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-12">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-justice">{eyebrow}</p>
        <h2 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none text-paper md:text-6xl">{title}</h2>
      </div>
      {note && <p className="max-w-sm text-sm text-paper-dim">{note}</p>}
    </Reveal>
  );
}

/* ------------------------------------------------------------------ Hero */

function Hero({ onPick }: { onPick: (id: ClubId) => void }) {
  return (
    <section className="lg-hero relative overflow-hidden border-b border-ink-line">
      <div className="lg-hero-bands" aria-hidden="true">
        {clubs.map((c, i) => (
          <span key={c.id} style={{ ...clubVars(c), "--i": i } as CSSProperties} />
        ))}
      </div>
      <div className="lg-beam lg-beam-l" aria-hidden="true" />
      <div className="lg-beam lg-beam-r" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-5 pt-[calc(env(safe-area-inset-top)+5.5rem)] md:px-10 md:pt-32">
        <div className="animate-hero-in flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-justice/40 bg-justice/10 px-3.5 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-justice">
            <SoonDot />
            Season one · Kicks off Sun 15 Nov, 9pm
          </span>
        </div>
        <h1 className="lg-title mt-5 text-center font-display font-black uppercase leading-[0.82] text-paper">
          <span className="block text-[0.32em] font-bold mr-[-0.4em] tracking-[0.4em] text-paper-dim">The Noisers</span>
          <span className="lg-title-word block">League</span>
        </h1>
        <p className="animate-hero-in mx-auto mt-5 max-w-xl text-center text-[0.95rem] text-paper-dim md:text-lg" style={{ animationDelay: "0.25s" }}>
          Six squads. Six colours. Six names. One table at the end of it all.
        </p>
        <Countdown />
      </div>

      <KitRing onPick={onPick} />

      <div className="relative mx-auto grid max-w-4xl grid-cols-4 gap-2 px-5 pb-10 md:px-10 md:pb-14">
        {[
          { n: clubs.length, l: "Clubs" },
          { n: season.reduce((n, night) => n + night.games.length, 0), l: "Fixtures" },
          { n: season.length, l: "Sundays" },
          { n: 0, l: "Played" },
        ].map((s) => (
          <div key={s.l} className="text-center">
            <p className="font-display text-4xl font-black text-paper md:text-6xl">
              <CountUp value={s.n} />
            </p>
            <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-mist md:text-xs">{s.l}</p>
          </div>
        ))}
      </div>

      <Ticker />
    </section>
  );
}

/** The six kits turning on a 3D carousel; tapping one opens its club. */
function KitRing({ onPick }: { onPick: (id: ClubId) => void }) {
  return (
    <div className="lg-stage" role="list" aria-label="The six kits">
      <div className="lg-ring">
        {clubs.map((c, i) => (
          <button
            key={c.id}
            type="button"
            role="listitem"
            onClick={() => onPick(c.id)}
            className="lg-ring-card"
            style={{ ...clubVars(c), "--i": i } as CSSProperties}
            aria-label={`${c.name}, ${c.kit.toLowerCase()} kit`}
          >
            <img src={c.image} alt="" loading="eager" draggable={false} />
            <span className="lg-ring-label">
              <Crest c={c} className="h-6 w-6" />
              {c.name}
            </span>
          </button>
        ))}
      </div>
      <div className="lg-floor" aria-hidden="true" />
    </div>
  );
}

function Ticker() {
  const row = clubs.flatMap((c) => [c, null]);
  return (
    <div className="lg-ticker relative border-t border-ink-line bg-ink-raised/60 py-3" aria-hidden="true">
      <div className="lg-ticker-track">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center gap-6 pr-6">
            {row.map((c, i) =>
              c ? (
                <span key={i} className="flex items-center gap-2.5 font-display text-xl font-extrabold uppercase tracking-wide text-paper">
                  <Crest c={c} className="h-6 w-6" />
                  {c.name}
                </span>
              ) : (
                <span key={i} className="text-xs font-semibold uppercase tracking-[0.3em] text-justice">
                  Coming soon
                </span>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Showcase */

function Showcase({ active, onPick }: { active: ClubId; onPick: (id: ClubId) => void }) {
  const c = club(active);
  const index = clubs.findIndex((x) => x.id === active);
  const frameRef = useRef<HTMLDivElement>(null);

  const step = (d: number) => onPick(clubs[(index + d + clubs.length) % clubs.length].id);

  function tilt(e: PointerEvent<HTMLDivElement>) {
    const el = frameRef.current;
    if (!el || reducedMotion() || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 12}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  }
  function untilt() {
    const el = frameRef.current;
    if (!el) return;
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--rx", "0deg");
  }

  return (
    <section id="clubs" className="lg-show relative scroll-mt-16 overflow-hidden md:scroll-mt-24" style={clubVars(c)}>
      <div className="lg-show-bg" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-24">
        <SectionHead eyebrow="Meet the six" title="The clubs" note="Every squad plays in its own colour, and every colour got a name that is easy to say, easy to chant and means something." />

        <div
          className="lg-picker -mx-5 mb-8 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:mb-12 md:flex-wrap md:px-0"
          role="tablist"
          aria-label="Clubs"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") step(1);
            if (e.key === "ArrowLeft") step(-1);
          }}
        >
          {clubs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={x.id === active}
              tabIndex={x.id === active ? 0 : -1}
              onClick={() => onPick(x.id)}
              className={`lg-chip ${x.id === active ? "is-on" : ""}`}
              style={clubVars(x)}
            >
              <Crest c={x} className="h-7 w-7" />
              <span className="whitespace-nowrap">{x.name}</span>
            </button>
          ))}
        </div>

        <div key={active} className="grid items-center gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-16" role="tabpanel" aria-label={c.name}>
          <div className="lg-frame-wrap">
            <div ref={frameRef} className="lg-frame" onPointerMove={tilt} onPointerLeave={untilt}>
              <img src={c.image} alt={`${c.name} ${c.kit.toLowerCase()} kit, front and back`} className="lg-kit" />
              <span className="lg-sheen" aria-hidden="true" />
              <span className="lg-frame-num" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
          </div>

          <div>
            <div className="lg-in flex items-center gap-3" style={{ "--d": "60ms" } as CSSProperties}>
              <Crest c={c} className="h-14 w-14 md:h-16 md:w-16" />
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-paper-dim">
                <p>{c.kit} kit</p>
                <p className="mt-1 text-mist">
                  Squad {index + 1} of {clubs.length} · {c.idea}
                </p>
              </div>
            </div>

            <h3 className="mt-5 font-display text-[3.4rem] font-black uppercase leading-[0.85] text-paper md:text-[5.5rem]" aria-label={c.name}>
              {c.name.split(" ").map((word, w) => (
                <span key={w} className="mr-[0.2em] inline-block whitespace-nowrap" aria-hidden="true">
                  {[...word].map((ch, i) => (
                    <span key={i} className="lg-letter" style={{ "--d": `${(w * 6 + i) * 28}ms` } as CSSProperties}>
                      {ch}
                    </span>
                  ))}
                </span>
              ))}
            </h3>
            <p className="lg-in mt-3 font-display text-2xl font-semibold italic text-[color:color-mix(in_srgb,var(--glow)_55%,white)] md:text-3xl" style={{ "--d": "260ms" } as CSSProperties}>
              {c.motto}
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div className="lg-in" style={{ "--d": "340ms" } as CSSProperties}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mist">What the name means</p>
                <p className="mt-2 text-sm leading-relaxed text-paper-dim">{c.meaning}</p>
              </div>
              <div className="lg-in" style={{ "--d": "420ms" } as CSSProperties}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mist">Why it fits the kit</p>
                <p className="mt-2 text-sm leading-relaxed text-paper-dim">{c.fits}</p>
              </div>
            </div>

            <div className="lg-in mt-8 flex flex-wrap items-center gap-3" style={{ "--d": "500ms" } as CSSProperties}>
              {[c.colours.primary, c.colours.stripe, c.colours.secondary].filter(Boolean).map((hex) => (
                <span key={hex} className="flex items-center gap-2 rounded-full bg-ink/60 py-1 pl-1 pr-3 text-xs font-medium uppercase text-paper-dim ring-1 ring-white/10">
                  <span className="h-6 w-6 rounded-full ring-1 ring-white/20" style={{ background: hex }} />
                  {hex}
                </span>
              ))}
              <span className="ml-auto flex gap-2">
                <button type="button" onClick={() => step(-1)} className="lg-arrow" aria-label="Previous club">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                    <path d="m15 6-6 6 6 6" />
                  </svg>
                </button>
                <button type="button" onClick={() => step(1)} className="lg-arrow" aria-label="Next club">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- Table */

function Table({ onPick }: { onPick: (id: ClubId) => void }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.15);
  // Before a ball is kicked, the table runs alphabetically.
  const rows = useMemo(() => [...clubs].sort((a, b) => a.name.localeCompare(b.name)), []);
  const cols = ["P", "W", "D", "L", "GF", "GA", "GD"];

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-24">
      <SectionHead
        eyebrow="Standings"
        title="The table"
        note={
          <span className="inline-flex items-center gap-2">
            <SoonDot /> Pre-season. Every club starts level, and the table goes live after the first round.
          </span>
        }
      />

      <div ref={ref} className={`lg-table overflow-hidden rounded-2xl border border-ink-line bg-ink-raised/50 ${inView ? "is-in" : ""}`}>
        <div className="lg-row lg-row-head text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-mist">
          <span className="text-center">#</span>
          <span>Club</span>
          {cols.map((h) => (
            <span key={h} className={`text-center ${h === "GF" || h === "GA" ? "max-md:hidden" : h === "W" || h === "D" || h === "L" ? "max-sm:hidden" : ""}`}>
              {h}
            </span>
          ))}
          <span className="text-center text-paper">Pts</span>
          <span className="text-center max-sm:hidden">Form</span>
        </div>
        {rows.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            className="lg-row lg-row-body w-full text-left"
            style={{ ...clubVars(c), "--d": `${i * 70}ms` } as CSSProperties}
          >
            <span className={`text-center font-display text-xl font-bold ${i === 0 ? "text-justice" : "text-paper"}`}>{i + 1}</span>
            <span className="flex min-w-0 items-center gap-3">
              <Crest c={c} className="h-8 w-8 md:h-9 md:w-9" />
              <span className="min-w-0">
                <span className="block truncate font-display text-lg font-bold uppercase leading-tight text-paper md:text-xl">{c.name}</span>
                <span className="block truncate text-[0.7rem] text-mist">{c.kit} kit</span>
              </span>
            </span>
            {cols.map((h) => (
              <span key={h} className={`text-center tabular-nums text-paper-dim ${h === "GF" || h === "GA" ? "max-md:hidden" : h === "W" || h === "D" || h === "L" ? "max-sm:hidden" : ""}`}>
                0
              </span>
            ))}
            <span className="text-center font-display text-xl font-black tabular-nums text-paper">0</span>
            <span className="flex justify-center gap-1 max-sm:hidden" aria-label="No form yet">
              {[0, 1, 2, 3, 4].map((k) => (
                <span key={k} className="h-2.5 w-2.5 rounded-full border border-ink-line" />
              ))}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-mist">
        <span className="font-display text-sm font-bold text-justice">1</span> Top of the table at the end of the season are champions.
      </p>
    </section>
  );
}

/* --------------------------------------------------------------- Leaders */

const leaderBoards: { title: string; stat: string; glyph: ReactNode }[] = [
  { title: "Golden Boot", stat: "Goals", glyph: <path d="M5 4h6v7l7 3a2.5 2.5 0 0 1 2 2.5V18H5Zm0 10h15M9 18v2m5-2v2" /> },
  { title: "Playmaker", stat: "Assists", glyph: <path d="M4 18c4-8 8-11 15-12m0 0-4-1.5M19 6l-1.5 4M4 18l3 2" /> },
  { title: "Clean Sheet", stat: "Clean sheets", glyph: <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6Zm-3.5 9 2.5 2.5 4.5-5" /> },
  {
    title: "Golden Glove",
    stat: "Saves",
    glyph: <path d="M7 21v-6L4 11.5a1.6 1.6 0 0 1 2.4-2L8 11V4.5a1.5 1.5 0 0 1 3 0V10V3.5a1.5 1.5 0 0 1 3 0V10V4.5a1.5 1.5 0 0 1 3 0V11V7a1.5 1.5 0 0 1 3 0v7a7 7 0 0 1-4 6.3V21" />,
  },
  { title: "Hot Head", stat: "Cards", glyph: <path d="M7 3h10v18H7Z" /> },
];

function Leaders() {
  return (
    <section className="border-y border-ink-line bg-ink-raised/40">
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-24">
        <SectionHead eyebrow="Player stats" title="League leaders" note="The league's top performers, updated after every game once the season starts." />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
          {leaderBoards.map((b, i) => (
            <Reveal key={b.title} delay={i * 100} className="lg-leader">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-justice/15 text-justice">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {b.glyph}
                  </svg>
                </span>
                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-mist">{b.stat}</span>
              </div>
              <p className="mt-4 font-display text-2xl font-extrabold uppercase leading-none text-paper md:text-3xl">{b.title}</p>
              <ul className="mt-4 space-y-2" aria-label="No leaders yet">
                {[0, 1, 2].map((r) => (
                  <li key={r} className="flex items-center gap-2.5">
                    <span className="w-3 font-display text-sm font-bold text-mist">{r + 1}</span>
                    <span className="lg-skel h-6 w-6 rounded-full" />
                    <span className="lg-skel h-2.5 flex-1 rounded-full" style={{ maxWidth: `${80 - r * 15}%` }} />
                    <span className="font-display text-sm font-bold text-mist">–</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Fixtures */

const dayLabel = (d: Date, long = false) =>
  d.toLocaleDateString("en-GB", { weekday: long ? "long" : "short", day: "numeric", month: long ? "long" : "short", timeZone: "UTC" });

function Fixtures() {
  const nights = season;
  const [night, setNight] = useState(0);
  const games = nights[night].games;
  const last = games[games.length - 1];
  const firstRound = games[0].round;
  const lastRound = last.round;

  return (
    <section id="fixtures" className="scroll-mt-16 border-y border-ink-line bg-ink-raised/40 md:scroll-mt-24">
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-24">
        <SectionHead
          eyebrow="Season one schedule"
          title="Fixtures"
          note={`Every club meets every other club three times: home, away, then home again. Sundays from 15 November, 9pm to midnight: ${GAMES_PER_NIGHT} games of ${GAME_MINUTES} minutes a night.`}
        />

        <div className="lg-picker -mx-5 mb-6 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0" role="tablist" aria-label="Match nights">
          {nights.map((n, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === night}
              onClick={() => setNight(i)}
              className={`lg-round lg-night ${i === night ? "is-on" : ""}`}
            >
              <span className="text-[0.6rem] uppercase tracking-[0.2em] opacity-70">Night {i + 1}</span>
              <span className="font-display text-2xl font-black leading-none">{dayLabel(n.date)}</span>
              <span className="text-[0.6rem] uppercase tracking-[0.15em] opacity-70">{n.games.length} games</span>
            </button>
          ))}
        </div>

        <div key={night} role="tabpanel" aria-label={dayLabel(nights[night].date, true)}>
          <div className="lg-in mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-ink-line bg-ink px-4 py-3 text-sm md:px-5">
            <span className="font-display text-xl font-extrabold uppercase text-paper">{dayLabel(nights[night].date, true)}</span>
            <span className="text-paper-dim">
              {clockTime(0)} – {clockTime(last.start + GAME_MINUTES)}
            </span>
            <span className="text-paper-dim">{firstRound === lastRound ? `Round ${firstRound}` : `Rounds ${firstRound}–${lastRound}`}</span>
            <span className="text-mist md:ml-auto">Each club plays {(games.length * 2) / clubs.length} games</span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {games.map((f, i) => {
              const h = club(f.home);
              const a = club(f.away);
              return (
                <article
                  key={`${f.home}-${f.away}`}
                  className="lg-match"
                  style={{ "--h": h.colours.glow, "--a": a.colours.glow, "--d": `${i * 70}ms` } as CSSProperties}
                >
                  <div className="flex items-center justify-between text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-mist">
                    <span>
                      Game {i + 1} · Round {f.round}
                    </span>
                    <span className="rounded-full bg-ink px-2 py-0.5 font-display text-sm tracking-wide text-justice">{clockTime(f.start)}</span>
                  </div>
                  <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Crest c={h} className="lg-match-crest h-14 w-14" />
                      <span className="font-display text-base font-bold uppercase leading-tight text-paper">{h.name}</span>
                      <span className="text-[0.6rem] uppercase tracking-[0.2em] text-mist">Home</span>
                    </div>
                    <span className="lg-vs font-display text-2xl font-black text-paper-dim">VS</span>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Crest c={a} className="lg-match-crest h-14 w-14" />
                      <span className="font-display text-base font-bold uppercase leading-tight text-paper">{a.name}</span>
                      <span className="text-[0.6rem] uppercase tracking-[0.2em] text-mist">Away</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Countdown */

/** Ticks down to the opening kick-off; after that, says the season is on. */
function Countdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, KICK_OFF.getTime() - now);
  if (left === 0) {
    return <p className="mt-6 text-center font-display text-2xl font-extrabold uppercase text-justice">Season one is under way</p>;
  }
  const parts = [
    { l: "Days", v: Math.floor(left / 86_400_000) },
    { l: "Hours", v: Math.floor(left / 3_600_000) % 24 },
    { l: "Mins", v: Math.floor(left / 60_000) % 60 },
    { l: "Secs", v: Math.floor(left / 1000) % 60 },
  ];
  return (
    <div className="animate-hero-in mt-7 flex justify-center gap-2 md:gap-3" style={{ animationDelay: "0.4s" }} role="timer" aria-label="Time until kick-off">
      {parts.map((p) => (
        <div key={p.l} className="lg-count">
          <span key={p.v} className="lg-count-num font-display text-3xl font-black tabular-nums text-paper md:text-5xl">
            {String(p.v).padStart(2, "0")}
          </span>
          <span className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-mist">{p.l}</span>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Ideas */

function Ideas({ onPick }: { onPick: (id: ClubId) => void }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-24">
      <SectionHead eyebrow="Behind the names" title="Three ideas" note="Each name was matched to its kit, so the name and the shirt tell the same story." />
      <div className="grid gap-4 md:grid-cols-3">
        {ideas.map(({ idea, note }, i) => {
          const members = clubs.filter((c) => c.idea === idea);
          return (
            <Reveal key={idea} delay={i * 120} className="lg-idea">
              <p className="font-display text-[5rem] font-black leading-none text-ink-line">0{i + 1}</p>
              <h3 className="-mt-6 font-display text-4xl font-extrabold uppercase text-paper">{idea}</h3>
              <p className="mt-2 text-sm text-paper-dim">{note}</p>
              <ul className="mt-6 space-y-2">
                {members.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => onPick(c.id)} className="lg-idea-row" style={clubVars(c)}>
                      <Crest c={c} className="h-8 w-8" />
                      <span className="flex-1 font-display text-lg font-bold uppercase text-paper">{c.name}</span>
                      <span className="text-xs text-mist">{c.kit}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Page */

export default function League() {
  const [active, setActive] = useState<ClubId>("bulwark");

  function pick(id: ClubId) {
    setActive(id);
    document.getElementById("clubs")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }

  return (
    <Layout>
      <Hero onPick={pick} />
      <Showcase active={active} onPick={setActive} />
      <Table onPick={pick} />
      <Leaders />
      <Fixtures />
      <Ideas onPick={pick} />

      <section className="lg-cta relative overflow-hidden border-t border-ink-line">
        <div className="lg-hero-bands lg-hero-bands-soft" aria-hidden="true">
          {clubs.map((c, i) => (
            <span key={c.id} style={{ ...clubVars(c), "--i": i } as CSSProperties} />
          ))}
        </div>
        <Reveal className="relative mx-auto max-w-3xl px-5 py-20 text-center md:py-28">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-justice">
            <SoonDot /> Coming soon
          </p>
          <h2 className="mt-4 font-display text-5xl font-black uppercase leading-[0.9] text-paper md:text-7xl">Kick-off is close</h2>
          <p className="mx-auto mt-4 max-w-lg text-paper-dim">
            Season one kicks off on Sunday 15 November at 9pm. Results, scorers and the live table will all land on this page from the first whistle.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/squad" className="bg-paper px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-paper-dim">
              Meet the squad
            </Link>
            <Link to="/the-vale" className="border border-paper/40 px-6 py-3 text-sm font-semibold text-paper transition-colors hover:border-paper hover:bg-paper hover:text-ink">
              See The Vale
            </Link>
          </div>
        </Reveal>
      </section>
    </Layout>
  );
}
