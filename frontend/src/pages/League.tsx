import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import Layout from "../components/Layout";
import reckonLogo from "../assets/sponsors/reckon-mono.png";
import { clubs, type Club, type ClubId } from "../lib/league";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const byId = new Map(clubs.map((c) => [c.id, c]));
const club = (id: ClubId) => byId.get(id)!;

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
            Season one · Coming soon
          </span>
        </div>
        <h1 className="lg-title mt-5 text-center font-display font-black uppercase leading-[0.82] text-paper">
          <span className="block text-[0.32em] font-bold mr-[-0.4em] tracking-[0.4em] text-paper-dim">The Noisers</span>
          <span className="lg-title-word block">League</span>
        </h1>
        <p className="animate-hero-in mx-auto mt-5 max-w-xl text-center text-[0.95rem] text-paper-dim md:text-lg" style={{ animationDelay: "0.25s" }}>
          Six squads. Six colours. Six names. One table at the end of it all.
        </p>
      </div>

      <KitRing onPick={onPick} />

      <div className="relative mx-auto grid max-w-3xl grid-cols-4 gap-2 px-5 pb-10 md:px-10 md:pb-14">
        {[
          { n: clubs.length, l: "Clubs" },
          { n: 0, l: "Played" },
          { n: 0, l: "Goals" },
          { n: 0, l: "Points" },
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
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-justice" />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Showcase */

/** The full home strip — shirt, shorts and socks — drawn in the club's colours. */
function Strip({ c, className = "h-24 w-14" }: { c: Club; className?: string }) {
  const id = useId();
  const k = c.colours;
  const shirt = k.stripe ? `url(#${id}-stripes)` : k.primary;
  return (
    <svg viewBox="0 0 60 100" className={`shrink-0 ${className}`} aria-hidden="true">
      <defs>
        <pattern id={`${id}-stripes`} width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill={k.primary} />
          <rect width="5" height="10" fill={k.stripe} />
        </pattern>
      </defs>
      <path d="M18 4 8 8 2 20l7 4 4-4v24h34V20l4 4 7-4-6-12-10-4c-2 5-22 5-24 0Z" fill={shirt} stroke={k.secondary} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M13 48h34l2 19H33l-3-8-3 8H11Z" fill={k.shorts} stroke={k.secondary} strokeOpacity="0.6" strokeWidth="1" strokeLinejoin="round" />
      {[15, 37].map((x) => (
        <g key={x}>
          <rect x={x} y="71" width="8" height="25" rx="2" fill={k.socks} stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
          <rect x={x} y="71" width="8" height="4" rx="1" fill={k.secondary} />
        </g>
      ))}
    </svg>
  );
}

function FileTile({ label, children, delay, wide = false }: { label: string; children: ReactNode; delay: number; wide?: boolean }) {
  return (
    <div className={`lg-in lg-file ${wide ? "max-sm:col-span-2" : ""}`} style={{ "--d": `${delay}ms` } as CSSProperties}>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-mist">{label}</p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

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
        <SectionHead eyebrow="Season one" title="The clubs" />

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
                <p>Founded 2026</p>
                <p className="mt-1 text-mist">Noisers League · Season one</p>
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
            <p className="lg-in mt-3 max-w-lg text-sm leading-relaxed text-paper-dim" style={{ "--d": "320ms" } as CSSProperties}>
              {c.story}
            </p>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <FileTile label="Home strip" delay={380} wide>
                <div className="flex items-center gap-3">
                  <Strip c={c} className="h-16 w-10" />
                  <dl className="min-w-0 space-y-0.5 text-xs">
                    {(["shirt", "shorts", "socks"] as const).map((part) => (
                      <div key={part} className="flex gap-1.5">
                        <dt className="w-11 shrink-0 capitalize text-mist">{part}</dt>
                        <dd className="text-paper">{c.strip[part]}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </FileTile>
              <FileTile label="Season record" delay={440} wide>
                <div className="grid grid-cols-5 text-center">
                  {["P", "W", "D", "L", "Pts"].map((h) => (
                    <div key={h}>
                      <p className="font-display text-2xl font-black leading-none text-paper">0</p>
                      <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-wider text-mist">{h}</p>
                    </div>
                  ))}
                </div>
              </FileTile>
              <FileTile label="Shirt sponsor" delay={500}>
                <img src={reckonLogo} alt="Reckon" className="h-5 w-auto opacity-90" draggable={false} />
              </FileTile>
              <FileTile label="Captain" delay={560}>
                <p className="font-display text-xl font-bold uppercase leading-none text-paper">To be named</p>
              </FileTile>
            </div>

            <div className="lg-in mt-6 flex items-center justify-between gap-3" style={{ "--d": "620ms" } as CSSProperties}>
              <p className="text-xs text-mist">
                Club {index + 1} of {clubs.length}
              </p>
              <span className="flex gap-2">
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
  const hide = (h: string) => (h === "GF" || h === "GA" ? "max-md:hidden" : h === "W" || h === "D" || h === "L" ? "max-sm:hidden" : "");

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-24">
      <SectionHead
        eyebrow="Standings"
        title="The table"
        note={
          <span className="inline-flex items-center gap-2">
            <SoonDot /> Pre-season. Every club starts level until the first ball is kicked.
          </span>
        }
      />

      <div ref={ref} className={`lg-table overflow-hidden rounded-2xl border border-ink-line bg-ink-raised/50 ${inView ? "is-in" : ""}`}>
        <div className="lg-row lg-row-head text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-mist">
          <span className="text-center">#</span>
          <span>Club</span>
          {cols.map((h) => (
            <span key={h} className={`text-center ${hide(h)}`}>
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
              <span className="block truncate font-display text-lg font-bold uppercase leading-tight text-paper md:text-xl">{c.name}</span>
            </span>
            {cols.map((h) => (
              <span key={h} className={`text-center tabular-nums text-paper-dim ${hide(h)}`}>
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
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-mist">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-justice" /> Champions
        </span>
        <span className="flex items-center gap-1.5">
          Form: <span className="h-2.5 w-2.5 rounded-full bg-win" /> W <span className="h-2.5 w-2.5 rounded-full bg-draw" /> D <span className="h-2.5 w-2.5 rounded-full bg-loss" /> L
        </span>
      </div>
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

/* ------------------------------------------------------- Rules & honours */

function Rulebook() {
  const points = [
    { label: "Win", n: 3, tone: "bg-win" },
    { label: "Draw", n: 1, tone: "bg-draw" },
    { label: "Loss", n: 0, tone: "bg-loss" },
  ];
  const ties = ["Goal difference", "Goals scored", "Head-to-head"];

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-24">
      <div className="grid gap-4 md:grid-cols-2">
        <Reveal className="lg-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-justice">League rules</p>
          <h2 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none text-paper md:text-5xl">How points work</h2>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {points.map((p) => (
              <div key={p.label} className="relative overflow-hidden rounded-2xl bg-ink px-3 py-4 text-center ring-1 ring-ink-line">
                <span className={`absolute inset-x-0 top-0 h-1 ${p.tone}`} />
                <p className="font-display text-5xl font-black leading-none text-paper">{p.n}</p>
                <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-mist">{p.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-mist">Level on points? Separated by</p>
          <ol className="mt-3 space-y-2">
            {ties.map((t, i) => (
              <li key={t} className="flex items-center gap-3 rounded-xl bg-ink px-3 py-2.5 ring-1 ring-ink-line">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-paper font-display text-sm font-black text-ink">{i + 1}</span>
                <span className="text-sm text-paper">{t}</span>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={120} className="lg-panel lg-honours relative overflow-hidden text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-justice">Roll of honour</p>
          <svg viewBox="0 0 64 72" className="lg-cup mx-auto mt-6 h-36 w-32 md:h-44 md:w-40" aria-hidden="true">
            <defs>
              <linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#f6dc95" />
                <stop offset="0.5" stopColor="#d8b56a" />
                <stop offset="1" stopColor="#8c6a2c" />
              </linearGradient>
            </defs>
            <path d="M18 6h28v14a14 14 0 0 1-28 0Z" fill="url(#lg-gold)" />
            <path d="M18 10H9v5a9 9 0 0 0 9 9M46 10h9v5a9 9 0 0 1-9 9" fill="none" stroke="url(#lg-gold)" strokeWidth="3.5" />
            <path d="M28 33h8v9h-8Z" fill="url(#lg-gold)" />
            <path d="M22 42h20l3 10H19Z" fill="url(#lg-gold)" />
            <rect x="15" y="52" width="34" height="9" rx="1.5" fill="#1d2547" stroke="url(#lg-gold)" strokeWidth="1.5" />
            <path d="M24 10h4v14h-4Z" fill="#fff" opacity="0.35" />
          </svg>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-mist">Season one champions</p>
          <p className="mt-2 font-display text-4xl font-black uppercase leading-none text-paper md:text-5xl">To be decided</p>
          <div className="mt-6 flex justify-center gap-2">
            {clubs.map((c, i) => (
              <span key={c.id} className="lg-bob" style={{ "--i": i } as CSSProperties}>
                <Crest c={c} className="h-9 w-9 md:h-10 md:w-10" />
              </span>
            ))}
          </div>
        </Reveal>
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
      <Rulebook />

      <section className="relative overflow-hidden border-t border-ink-line">
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
          <p className="mx-auto mt-4 max-w-md text-paper-dim">Results, scorers and the live table land here the moment season one begins.</p>
        </Reveal>
      </section>
    </Layout>
  );
}
