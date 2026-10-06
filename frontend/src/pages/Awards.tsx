import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { useSquad } from "../lib/SquadContext";
import { useMatchDay } from "../lib/MatchDayContext";
import { positionCodes, type Player } from "../lib/clubData";
import type { MatchDayEvent } from "../lib/matchDay";
import { buildAwards, reignSummary, type CategoryId, type Race, type Standing, type WeeklyWinner } from "../lib/awards";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Each player keeps one colour across every race bar and reign strip.
const LANE_COLOURS = ["#d8b56a", "#5b9bd5", "#2f9e8a", "#c23b6b", "#9b7fd4", "#e07b39", "#4fb3bf", "#b8c45a", "#d46fa8", "#7d8cff"];
const laneColour = (id: number) => LANE_COLOURS[id % LANE_COLOURS.length];

const MEDALS = ["#e9c46a", "#c7cbd6", "#c08457"];

/** Short name for a match day on tight rows ("Match Day 12" → "MD 12"). */
function dayShort(title: string) {
  const m = title.match(/(\d+)\s*$/);
  return m ? `MD ${m[1]}` : title;
}

/** "goals" → "goal" for a lead of exactly one; ratings lead by points. */
function gapUnit(unit: string, gap: number) {
  const u = unit === "rating" ? "points" : unit;
  return gap === 1 ? u.replace(/s$/, "") : u;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Adds .is-in once the element scrolls into view, for the reveal animations. */
function useInView<T extends HTMLElement>() {
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
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);
  return [ref, inView] as const;
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`aw-reveal ${inView ? "is-in" : ""} ${className}`} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

/** Counts up to the value whenever it changes. */
function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (reducedMotion()) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(origin + (value - origin) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const decimals = format(value).includes(".");
  return <>{format(decimals ? shown : Math.round(shown))}</>;
}

const CrownIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M3 8.5 7.5 12 12 5l4.5 7L21 8.5 19 18H5L3 8.5Z" />
    <rect x="5" y="19.2" width="14" height="1.8" rx="0.9" />
  </svg>
);

/** Small line drawing per award. */
function AwardGlyph({ id, className = "h-6 w-6" }: { id: CategoryId; className?: string }) {
  const paths: Record<CategoryId, ReactNode> = {
    "golden-boot": <path d="M5 4h6v7l7 3a2.5 2.5 0 0 1 2 2.5V18H5Zm0 10h15M9 18v2m5-2v2" />,
    "top-rated": <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8Z" />,
    potw: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21a7 7 0 0 1 14 0M17.5 3.5l1 1.8 2 .3-1.5 1.4.4 2-1.9-1" />
      </>
    ),
    playmaker: <path d="M4 18c4-8 8-11 15-12m0 0-4-1.5M19 6l-1.5 4M4 18l3 2" />,
    talisman: <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />,
    "golden-glove": <path d="M7 21v-6L4 11.5a1.6 1.6 0 0 1 2.4-2L8 11V4.5a1.5 1.5 0 0 1 3 0V10V3.5a1.5 1.5 0 0 1 3 0V10V4.5a1.5 1.5 0 0 1 3 0V11V7a1.5 1.5 0 0 1 3 0v7a7 7 0 0 1-4 6.3V21" />,
    "brick-wall": <path d="M3 5h18v14H3Zm0 5h18M3 14.5h18M9 5v5m6-5v5M6 10v4.5m6-4.5v4.5m6-4.5v4.5M9 14.5V19m6-4.5V19" />,
    "serial-winner": <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Zm10 1h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />,
    ironman: <path d="M12 21s-7-4.4-7-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 16.6 12 21 12 21Z" />,
    climber: <path d="M3 18 9 12l4 4 8-9m0 0h-5m5 0v5" />,
    "hat-tricks": (
      <>
        <circle cx="6" cy="16" r="3" />
        <circle cx="18" cy="16" r="3" />
        <circle cx="12" cy="7" r="3" />
      </>
    ),
    "hot-head": <path d="M7 3h7l4 4v14H7Zm7 0v4h4" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths[id]}
    </svg>
  );
}

function Avatar({ player, size, ring, className = "" }: { player: Player; size: string; ring?: string; className?: string }) {
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-full bg-ink-raised ${size} ${className}`}
      style={ring ? { boxShadow: `0 0 0 2px var(--color-ink), 0 0 0 4px ${ring}` } : undefined}
    >
      <img src={player.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
    </span>
  );
}

export default function Awards() {
  const { players, loading } = useSquad();
  const { events } = useMatchDay();
  const data = useMemo(() => buildAwards(players, events), [players, events]);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const [active, setActive] = useState<CategoryId>("golden-boot");
  const raceRef = useRef<HTMLElement>(null);

  const race = data.races.find((r) => r.category.id === active)!;
  const lastDay = data.days.length - 1;

  const changes = data.races.reduce((n, r) => n + Math.max(0, r.reigns.length - 1), 0);
  const longest = data.races
    .map((r) => {
      const reign = r.reigns[r.reigns.length - 1];
      return reign && reign.endedBy === null ? { race: r, reign, length: reign.to - reign.from + 1 } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.length - a.length)[0];

  function pick(id: CategoryId) {
    setActive(id);
    raceRef.current?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }

  return (
    <Layout>
      <Hero days={data.days.length} awards={data.races.length} changes={changes} longest={longest ? { name: byId.get(longest.reign.playerId)?.name ?? "", award: longest.race.category.award, length: longest.length } : null} />

      {data.days.length === 0 ? (
        <section className="mx-auto max-w-3xl px-5 py-20 text-center">
          <p className="font-display text-3xl text-paper">{loading ? "Loading the race…" : "The race starts at the first match day"}</p>
          <p className="mt-3 text-paper-dim">Every award fills in the moment a match day ends.</p>
        </section>
      ) : (
        <>
          <Cabinet races={data.races} byId={byId} active={active} onPick={pick} />

          <section ref={raceRef} className="scroll-mt-16 md:scroll-mt-24" aria-label="The race">
            <Switcher races={data.races} active={active} onPick={setActive} />
            <div key={active} className="aw-swap mx-auto max-w-5xl px-4 pb-6 md:px-10">
              <RaceHeader race={race} />
              <Podium race={race} byId={byId} lastDay={lastDay} />
              <RaceReplay race={race} byId={byId} days={data.days} />
              <Reigns race={race} byId={byId} days={data.days} />
              <Chasers race={race} byId={byId} />
            </div>
          </section>

          <WeeklyWall winners={data.winners} byId={byId} race={data.races.find((r) => r.category.id === "potw")!} />
        </>
      )}
    </Layout>
  );
}

function Hero({ days, awards, changes, longest }: { days: number; awards: number; changes: number; longest: { name: string; award: string; length: number } | null }) {
  const sparks = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({ x: (i * 37) % 100, d: (i * 0.73) % 6, s: 2 + (i % 3) })),
    [],
  );
  return (
    <header className="aw-hero relative overflow-hidden border-b border-ink-line px-5 pb-12 pt-[calc(env(safe-area-inset-top)+6rem)] md:px-10 md:pb-20 md:pt-44">
      <div className="aw-rays" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {sparks.map((s, i) => (
          <span key={i} className="aw-spark" style={{ left: `${s.x}%`, "--d": `${s.d}s`, "--s": `${s.s}px` } as CSSProperties} />
        ))}
      </div>

      <div className="relative mx-auto max-w-5xl text-center">
        <div className="aw-trophy mx-auto flex h-20 w-20 items-center justify-center rounded-full md:h-24 md:w-24">
          <svg viewBox="0 0 24 24" className="h-10 w-10 text-ink md:h-12 md:w-12" fill="currentColor" aria-hidden="true">
            <path d="M7 3h10v6a5 5 0 0 1-10 0Zm10 1.5h3V7a3.5 3.5 0 0 1-3.2 3.5M7 4.5H4V7a3.5 3.5 0 0 0 3.2 3.5M11 14.6h2V18h3v3H8v-3h3Z" />
          </svg>
        </div>
        <p className="aw-rise mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-justice" style={{ "--d": "100ms" } as CSSProperties}>
          Noisers FC honours
        </p>
        <h1 className="aw-rise aw-gold-text mt-3 font-display text-[3.6rem] font-extrabold leading-[0.9] md:text-8xl" style={{ "--d": "200ms" } as CSSProperties}>
          THE AWARDS RACE
        </h1>
        <p className="aw-rise mx-auto mt-4 max-w-md text-paper-dim" style={{ "--d": "300ms" } as CSSProperties}>
          Every honour, replayed match day by match day — who's on top, how long they've held it, and who's closing in.
        </p>

        <dl className="aw-rise mx-auto mt-8 grid max-w-xl grid-cols-3 gap-2 md:gap-4" style={{ "--d": "420ms" } as CSSProperties}>
          <HeroStat label="Match days" value={days} />
          <HeroStat label="Lead changes" value={changes} />
          <HeroStat label="Awards" value={awards} />
        </dl>

        {longest && (
          <p className="aw-rise mx-auto mt-5 max-w-md rounded-2xl bg-justice/10 px-4 py-2.5 text-xs leading-relaxed text-paper ring-1 ring-justice/30" style={{ "--d": "520ms" } as CSSProperties}>
            <CrownIcon className="mr-1.5 inline h-4 w-4 -translate-y-px align-middle text-justice" />
            Longest reign: <b className="font-semibold">{longest.name}</b> · {longest.award} · {plural(longest.length, "match day")} and counting
          </p>
        )}
      </div>
    </header>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-ink-raised/70 px-2 py-3 ring-1 ring-white/5 backdrop-blur">
      <dd className="font-display text-3xl leading-none text-paper md:text-4xl">
        <CountUp value={value} format={String} />
      </dd>
      <dt className="mt-1 text-[0.68rem] uppercase tracking-wide text-mist">{label}</dt>
    </div>
  );
}

/** Every award's current holder at a glance — tap one to watch its race. */
function Cabinet({ races, byId, active, onPick }: { races: Race[]; byId: Map<number, Player>; active: CategoryId; onPick: (id: CategoryId) => void }) {
  return (
    <section className="mx-auto max-w-7xl py-10 md:px-10 md:py-16" aria-label="Trophy cabinet">
      <div className="flex items-end justify-between px-5 md:px-0">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-justice">The cabinet</p>
          <h2 className="mt-2 font-display text-3xl text-paper md:text-5xl">Who holds what</h2>
        </div>
        <p className="hidden text-sm text-mist md:block">Tap an award to watch its race</p>
      </div>

      <div className="no-scrollbar mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-4">
        {races.map((race, i) => {
          const frame = race.frames[race.frames.length - 1] ?? [];
          const leader = frame[0];
          const player = leader ? byId.get(leader.playerId) : undefined;
          const reign = race.reigns[race.reigns.length - 1];
          const held = reign && reign.endedBy === null ? reign.to - reign.from + 1 : 0;
          const selected = race.category.id === active;
          return (
            <button
              key={race.category.id}
              type="button"
              onClick={() => onPick(race.category.id)}
              className={`aw-card group relative w-[72%] shrink-0 snap-center overflow-hidden rounded-3xl p-4 text-left ring-1 transition-[box-shadow,transform] sm:w-[45%] md:w-auto ${
                selected ? "ring-justice/70" : "ring-white/5"
              }`}
              style={{ "--i": i } as CSSProperties}
              aria-pressed={selected}
            >
              <span className="aw-card-shine" aria-hidden="true" />
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-justice/15 text-justice">
                  <AwardGlyph id={race.category.id} className="h-5 w-5" />
                </span>
                {held > 0 && <span className="text-[0.68rem] text-mist">{plural(held, "match day")} on top</span>}
              </div>
              <p className="mt-4 font-display text-2xl leading-none text-paper">{race.category.award}</p>
              <p className="mt-1 text-xs text-mist">{race.category.stat}</p>
              {player && leader ? (
                <div className="mt-4 flex items-center gap-3">
                  <Avatar player={player} size="h-11 w-11" ring={MEDALS[0]} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-paper">{player.name}</p>
                    <p className="text-xs text-mist">#{player.number} · {positionCodes(player)}</p>
                  </div>
                  <p className="font-display text-3xl leading-none text-justice">{race.category.format(leader.value)}</p>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-dashed border-ink-line px-3 py-3 text-xs text-mist">Up for grabs — nobody's claimed it yet.</p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Switcher({ races, active, onPick }: { races: Race[]; active: CategoryId; onPick: (id: CategoryId) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<CategoryId, HTMLButtonElement>());
  // Centre the active chip by scrolling the strip only — scrollIntoView
  // would also drag the page down to it.
  useEffect(() => {
    const list = listRef.current;
    const chip = refs.current.get(active);
    if (!list || !chip) return;
    list.scrollTo({ left: chip.offsetLeft - (list.clientWidth - chip.clientWidth) / 2, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [active]);
  return (
    <div className="glass-bar sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-30 border-y border-ink-line md:top-[4.75rem]">
      <div ref={listRef} role="tablist" aria-label="Awards" className="no-scrollbar relative mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-2.5 md:px-10">
        {races.map((r) => {
          const on = r.category.id === active;
          return (
            <button
              key={r.category.id}
              ref={(el) => {
                if (el) refs.current.set(r.category.id, el);
              }}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onPick(r.category.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                on ? "bg-justice text-ink" : "bg-ink-raised text-paper-dim hover:text-paper"
              }`}
            >
              <AwardGlyph id={r.category.id} className="h-4 w-4" />
              {r.category.award}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RaceHeader({ race }: { race: Race }) {
  return (
    <div className="pt-8 text-center md:pt-12">
      <span className="aw-glyph-spin mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-justice/15 text-justice ring-1 ring-justice/40">
        <AwardGlyph id={race.category.id} className="h-7 w-7" />
      </span>
      <h2 className="aw-gold-text mt-4 font-display text-5xl font-extrabold leading-none md:text-7xl">{race.category.award}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-paper-dim">{race.category.blurb}</p>
    </div>
  );
}

function Podium({ race, byId, lastDay }: { race: Race; byId: Map<number, Player>; lastDay: number }) {
  const frame = race.frames[lastDay] ?? [];
  const top = frame.slice(0, 3);
  if (!top.length) {
    return <p className="mx-auto mt-10 max-w-sm rounded-3xl border border-dashed border-ink-line p-8 text-center text-paper-dim">Nobody's on the board yet. The first to get one takes the crown.</p>;
  }
  const gap = top[1] ? top[0].value - top[1].value : null;
  // 2nd, 1st, 3rd from left to right — the winner stands in the middle.
  const order = [1, 0, 2];
  const heights = ["h-32 md:h-44", "h-24 md:h-32", "h-16 md:h-24"];
  const sizes = ["h-24 w-24 md:h-32 md:w-32", "h-16 w-16 md:h-24 md:w-24", "h-14 w-14 md:h-20 md:w-20"];

  return (
    <div className="mt-8 md:mt-12">
      <div className="mx-auto grid max-w-xl grid-cols-3 items-end gap-2 md:gap-4">
        {order.map((place) => {
          const s = top[place];
          const p = s ? byId.get(s.playerId) : undefined;
          if (!s || !p) return <div key={place} />;
          return (
            <Link key={place} to={`/squad/${p.id}`} className="flex flex-col items-center" style={{ "--d": `${[300, 0, 550][place]}ms` } as CSSProperties}>
              <div className="aw-pod-player relative flex flex-col items-center">
                {place === 0 && <CrownIcon className="aw-crown -mb-1 h-8 w-8 text-[#e9c46a] md:h-10 md:w-10" />}
                <Avatar player={p} size={sizes[place]} ring={MEDALS[place]} className={place === 0 ? "aw-halo" : ""} />
                <p className="mt-2 max-w-full truncate px-1 text-center text-sm font-semibold text-paper md:text-base">{p.name}</p>
                <p className="font-display text-2xl leading-none md:text-3xl" style={{ color: MEDALS[place] }}>
                  <CountUp value={s.value} format={race.category.format} />
                </p>
              </div>
              <div
                className={`podium-rise aw-block mt-2 flex w-full items-start justify-center rounded-t-2xl ${heights[place]}`}
                style={{ "--medal": MEDALS[place], animationDelay: `${[150, 0, 300][place]}ms` } as CSSProperties}
              >
                <span className="mt-2 font-display text-4xl text-ink/70 md:text-5xl">{place + 1}</span>
              </div>
            </Link>
          );
        })}
      </div>
      <p className="mt-4 text-center text-sm text-paper-dim">
        {gap === null
          ? "Out on their own — no challenger yet."
          : gap === 0
            ? "Dead level at the top — the next match day decides it."
            : `Leads by ${race.category.format(gap).replace("+", "")} ${gapUnit(race.category.unit, gap)}`}
      </p>
    </div>
  );
}

const ROW = 52;
const SHOWN = 8;

/** Bar-chart race: the standings re-sort themselves match day by match day. */
function RaceReplay({ race, byId, days }: { race: Race; byId: Map<number, Player>; days: MatchDayEvent[] }) {
  const last = days.length - 1;
  const [frame, setFrame] = useState(last);
  const [playing, setPlaying] = useState(false);
  const [ref, inView] = useInView<HTMLDivElement>();

  // Replay from the first match day once the chart is in view.
  useEffect(() => {
    if (!inView || last < 1 || reducedMotion()) return;
    setFrame(0);
    setPlaying(true);
  }, [inView, last, race.category.id]);

  useEffect(() => {
    if (!playing) return;
    if (frame >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setFrame((f) => f + 1), 1000);
    return () => clearTimeout(t);
  }, [playing, frame, last]);

  const standings = race.frames[frame] ?? [];
  const lanes = useMemo(() => {
    const ids = new Set<number>();
    for (const f of race.frames) for (const s of f.slice(0, SHOWN)) ids.add(s.playerId);
    return [...ids];
  }, [race]);
  const rankOf = new Map(standings.map((s, i) => [s.playerId, i]));
  const shown = standings.slice(0, SHOWN);
  const max = Math.max(...shown.map((s) => s.value), 0);
  const min = race.category.spread ? Math.min(...shown.map((s) => s.value)) : 0;
  const width = (v: number) => {
    if (max <= 0) return 0;
    if (!race.category.spread) return Math.max(6, (v / max) * 100);
    const span = max - min || 1;
    return 35 + ((v - min) / span) * 65;
  };
  const prevLeader = frame > 0 ? race.frames[frame - 1]?.[0]?.playerId : undefined;
  const newLeader = frame > 0 && standings[0] && standings[0].playerId !== prevLeader;

  function toggle() {
    if (playing) setPlaying(false);
    else {
      if (frame >= last) setFrame(0);
      setPlaying(true);
    }
  }

  return (
    <Reveal className="mt-12 md:mt-16">
      <div ref={ref} className="overflow-hidden rounded-3xl bg-ink-raised/60 ring-1 ring-white/5">
        <div className="flex items-center justify-between gap-3 border-b border-ink-line px-4 py-3 md:px-6">
          <div className="min-w-0">
            <p className="text-[0.68rem] uppercase tracking-[0.2em] text-justice">Race replay</p>
            <p key={frame} className="aw-tick truncate font-display text-2xl leading-tight text-paper">
              {days[frame]?.title}
              <span className="ml-2 font-sans text-xs text-mist">{days[frame]?.date}</span>
            </p>
          </div>
          {last > 0 && (
            <button
              type="button"
              onClick={toggle}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-justice text-ink transition-transform active:scale-90"
              aria-label={playing ? "Pause the replay" : "Play the replay"}
            >
              {playing ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5 translate-x-px" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5Z" /></svg>
              )}
            </button>
          )}
        </div>

        <div className="relative px-3 py-4 md:px-6" style={{ height: Math.max(1, Math.min(SHOWN, shown.length)) * ROW + 32 }}>
          {shown.length === 0 && <p className="py-6 text-center text-sm text-mist">Nobody on the board after this match day.</p>}
          {lanes.map((id) => {
            const p = byId.get(id);
            const rank = rankOf.get(id);
            if (!p) return null;
            const visible = rank !== undefined && rank < SHOWN;
            const s = visible ? standings[rank] : undefined;
            return (
              <div
                key={id}
                className="aw-lane absolute inset-x-3 flex items-center gap-2.5 md:inset-x-6"
                style={{ transform: `translateY(${(visible ? rank : SHOWN) * ROW}px)`, opacity: visible ? 1 : 0, height: ROW - 8 }}
              >
                <span className="w-5 shrink-0 text-right font-display text-lg text-mist">{visible ? rank + 1 : ""}</span>
                <Avatar player={p} size="h-9 w-9" ring={rank === 0 ? MEDALS[0] : undefined} />
                <div className="relative h-9 min-w-0 flex-1">
                  <div
                    className="aw-bar absolute inset-y-0 left-0 rounded-r-full rounded-l-md"
                    style={{ width: `${s ? width(s.value) : 0}%`, background: `linear-gradient(90deg, ${laneColour(id)}55, ${laneColour(id)})` }}
                  />
                  <span className="absolute inset-y-0 left-2.5 flex max-w-[70%] items-center truncate text-sm font-semibold text-paper drop-shadow">
                    {p.name}
                  </span>
                  {rank === 0 && newLeader && <span className="aw-pop absolute -top-2.5 right-12 rounded-full bg-justice px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-ink">New leader</span>}
                </div>
                <span className="w-12 shrink-0 text-right font-display text-xl tabular-nums text-paper">{s ? race.category.format(s.value) : ""}</span>
              </div>
            );
          })}
        </div>

        {last > 0 && (
          <div className="border-t border-ink-line px-4 py-3 md:px-6">
            <input
              type="range"
              min={0}
              max={last}
              value={frame}
              onChange={(e) => {
                setPlaying(false);
                setFrame(Number(e.target.value));
              }}
              className="aw-scrub w-full"
              aria-label="Match day"
            />
            <div className="mt-1 flex justify-between text-[0.68rem] text-mist">
              <span>{dayShort(days[0].title)}</span>
              <span>{dayShort(days[last].title)}</span>
            </div>
          </div>
        )}
      </div>
    </Reveal>
  );
}

/** Who held first place, for how long, and who knocked them off. */
function Reigns({ race, byId, days }: { race: Race; byId: Map<number, Player>; days: MatchDayEvent[] }) {
  if (!race.reigns.length) return null;
  const total = days.length;
  const summary = reignSummary(race);
  const firstDay = race.reigns[0].from;

  return (
    <Reveal className="mt-12 md:mt-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.2em] text-justice">King of the hill</p>
          <h3 className="mt-1 font-display text-3xl text-paper md:text-4xl">Every reign at the top</h3>
        </div>
        <p className="shrink-0 text-xs text-mist">{plural(race.reigns.length - 1, "lead change")}</p>
      </div>

      {/* The whole season as one strip, each segment a reign. */}
      <div className="mt-5 flex h-12 overflow-hidden rounded-2xl bg-ink-raised ring-1 ring-white/5">
        {firstDay > 0 && <div style={{ flexGrow: firstDay }} className="bg-ink-raised" title="Nobody on the board yet" />}
        {race.reigns.map((r, i) => {
          const p = byId.get(r.playerId);
          const len = r.to - r.from + 1;
          return (
            <div
              key={i}
              className="aw-seg flex min-w-0 items-center justify-center border-r border-ink/60 last:border-r-0"
              style={{ flexGrow: len, flexBasis: 0, background: laneColour(r.playerId), "--i": i } as CSSProperties}
              title={`${p?.name ?? "Former player"} · ${plural(len, "match day")}`}
            >
              {p && len / total > 0.12 && <Avatar player={p} size="h-8 w-8" />}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[0.68rem] text-mist">
        <span>{dayShort(days[0].title)}</span>
        <span>{dayShort(days[total - 1].title)}</span>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-xs uppercase tracking-wide text-mist">Most time at No. 1</p>
          <ol className="mt-3 space-y-2">
            {summary.slice(0, 5).map((s, i) => {
              const p = byId.get(s.playerId);
              if (!p) return null;
              return (
                <li key={s.playerId} className="aw-slide flex items-center gap-3 rounded-2xl bg-ink-raised/60 px-3 py-2.5" style={{ "--i": i } as CSSProperties}>
                  <Avatar player={p} size="h-9 w-9" ring={laneColour(p.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-paper">{p.name}</p>
                    <p className="text-xs text-mist">Topped it {s.reigns === 1 ? "once" : `${s.reigns} times`}</p>
                  </div>
                  <p className="text-right">
                    <span className="font-display text-2xl leading-none text-paper">{s.days}</span>
                    <span className="block text-[0.65rem] text-mist">match day{s.days === 1 ? "" : "s"}</span>
                  </p>
                </li>
              );
            })}
          </ol>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-mist">The timeline</p>
          <ol className="relative mt-3 space-y-4 border-l border-ink-line pl-5">
            {[...race.reigns].reverse().map((r, i) => {
              const p = byId.get(r.playerId);
              const taker = r.endedBy !== null ? byId.get(r.endedBy) : undefined;
              const len = r.to - r.from + 1;
              const current = r.endedBy === null;
              return (
                <li key={`${r.playerId}-${r.from}`} className="aw-slide relative" style={{ "--i": i } as CSSProperties}>
                  <span
                    className={`absolute -left-[1.62rem] top-1 flex h-3 w-3 rounded-full ${current ? "aw-live-dot" : ""}`}
                    style={{ background: laneColour(r.playerId) }}
                  />
                  <p className="text-sm text-paper">
                    <b className="font-semibold">{p?.name ?? "Former player"}</b>
                    {current ? <span className="ml-2 rounded-full bg-win/20 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-win">Holder</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-mist">
                    Took the top spot at {days[r.from]?.title} · {plural(len, "match day")} on top
                  </p>
                  {!current && (
                    <p className="mt-1 text-xs text-loss">
                      Fell at {days[r.to + 1]?.title ?? "the next match day"}
                      {taker ? ` — overtaken by ${taker.name}` : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </Reveal>
  );
}

/** The rest of the field, with how they moved at the last match day. */
function Chasers({ race, byId }: { race: Race; byId: Map<number, Player> }) {
  const last = race.frames.length - 1;
  const now = race.frames[last] ?? [];
  const before = new Map((race.frames[last - 1] ?? []).map((s, i) => [s.playerId, i]));
  const rest = now.slice(3, 15);
  if (!rest.length) return null;
  const leader = now[0];

  return (
    <Reveal className="mt-12 md:mt-16">
      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-justice">The chasing pack</p>
      <h3 className="mt-1 font-display text-3xl text-paper md:text-4xl">Closing in</h3>
      <ol className="mt-4 divide-y divide-ink-line overflow-hidden rounded-3xl bg-ink-raised/60 ring-1 ring-white/5">
        {rest.map((s: Standing, i) => {
          const p = byId.get(s.playerId);
          if (!p) return null;
          const rank = i + 3;
          const was = before.get(s.playerId);
          const move = was === undefined ? null : was - rank;
          return (
            <li key={s.playerId}>
              <Link to={`/squad/${p.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-raised">
                <span className="w-6 text-right font-display text-lg text-mist">{rank + 1}</span>
                <Movement move={move} />
                <Avatar player={p} size="h-9 w-9" />
                <span className="min-w-0 flex-1 truncate text-sm text-paper">{p.name}</span>
                <span className="text-xs text-mist">
                  {race.category.spread || race.category.id === "climber"
                    ? `−${(leader.value - s.value).toFixed(2)}`
                    : `−${leader.value - s.value}`}
                </span>
                <span className="w-12 text-right font-display text-xl text-paper">{race.category.format(s.value)}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Reveal>
  );
}

function Movement({ move }: { move: number | null }) {
  if (move === null) return <span className="w-6 text-center text-[0.6rem] font-bold text-justice">NEW</span>;
  if (move === 0) return <span className="w-6 text-center text-mist">–</span>;
  const up = move > 0;
  return (
    <span className={`flex w-6 items-center justify-center text-[0.7rem] font-semibold ${up ? "text-win" : "text-loss"}`}>
      <svg viewBox="0 0 10 10" className={`h-2.5 w-2.5 ${up ? "" : "rotate-180"}`} fill="currentColor" aria-hidden="true"><path d="M5 1 9.5 8h-9Z" /></svg>
      {Math.abs(move)}
    </span>
  );
}

/** Player of the week — the roll of honour, then every week's winner. */
function WeeklyWall({ winners, byId, race }: { winners: WeeklyWinner[]; byId: Map<number, Player>; race: Race }) {
  if (!winners.length) return null;
  const counts = new Map<number, { playerId: number; wins: number; last: WeeklyWinner; streak: number }>();
  let run = 0;
  winners.forEach((w, i) => {
    const prev = winners[i - 1];
    run = prev && prev.playerId === w.playerId && prev.day === w.day - 1 ? run + 1 : 1;
    const c = counts.get(w.playerId) ?? { playerId: w.playerId, wins: 0, last: w, streak: 0 };
    c.wins++;
    c.last = w;
    c.streak = Math.max(c.streak, run);
    counts.set(w.playerId, c);
  });
  // Same order as the Player of the Week race, so a tie keeps its holder on top.
  const place = new Map((race.frames[race.frames.length - 1] ?? []).map((st, i) => [st.playerId, i]));
  const table = [...counts.values()].sort((a, b) => (place.get(a.playerId) ?? 0) - (place.get(b.playerId) ?? 0));
  const latest = [...winners].reverse();

  return (
    <section className="aw-potw relative mt-10 overflow-hidden border-t border-ink-line py-12 md:py-20" aria-label="Player of the week">
      <div className="relative mx-auto max-w-5xl px-4 md:px-10">
        <Reveal className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-justice">Roll of honour</p>
          <h2 className="aw-gold-text mt-2 font-display text-5xl font-extrabold leading-none md:text-7xl">Player of the Week</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-paper-dim">The standout performer of every match day — and how many times each has won it.</p>
        </Reveal>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 md:mt-12 md:grid-cols-3">
          {table.slice(0, 6).map((c, i) => {
            const p = byId.get(c.playerId);
            if (!p) return null;
            return (
              <Reveal key={c.playerId} delay={i * 80}>
                <Link to={`/squad/${p.id}`} className={`aw-honour flex items-center gap-4 rounded-3xl p-4 ring-1 ${i === 0 ? "aw-honour-top ring-justice/50" : "ring-white/5"}`}>
                  <div className="relative">
                    <Avatar player={p} size="h-16 w-16" ring={MEDALS[i] ?? laneColour(p.id)} className={i === 0 ? "aw-halo" : ""} />
                    {i === 0 && <CrownIcon className="aw-crown absolute -top-5 left-1/2 h-6 w-6 -translate-x-1/2 text-[#e9c46a]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-paper">{p.name}</p>
                    <div className="mt-1 flex flex-wrap gap-0.5" aria-label={plural(c.wins, "win")}>
                      {Array.from({ length: Math.min(c.wins, 10) }, (_, k) => (
                        <svg key={k} viewBox="0 0 24 24" className="aw-star h-3.5 w-3.5 text-justice" style={{ "--i": k } as CSSProperties} fill="currentColor" aria-hidden="true">
                          <path d="m12 2.5 2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8Z" />
                        </svg>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-mist">
                      Last won {c.last.event.title}
                      {c.streak > 1 ? ` · ${c.streak} in a row` : ""}
                    </p>
                  </div>
                  <p className="text-right">
                    <span className="font-display text-5xl leading-none text-paper">×{c.wins}</span>
                  </p>
                </Link>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-10">
          <p className="text-xs uppercase tracking-wide text-mist">Week by week</p>
        </Reveal>
      </div>

      <div className="no-scrollbar relative mx-auto mt-3 flex max-w-5xl snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:px-10">
        {latest.map((w, i) => {
          const p = byId.get(w.playerId);
          if (!p) return null;
          return (
            <Link
              key={w.event.id}
              to={`/squad/${p.id}`}
              className="aw-week relative w-40 shrink-0 snap-start overflow-hidden rounded-3xl ring-1 ring-white/5"
              style={{ "--i": Math.min(i, 8) } as CSSProperties}
            >
              <img src={p.photo} alt="" loading="lazy" className="h-48 w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
              {i === 0 && <span className="absolute left-3 top-3 rounded-full bg-justice px-2 py-0.5 text-[0.6rem] font-bold uppercase text-ink">Latest</span>}
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="text-[0.65rem] uppercase tracking-wide text-justice">{w.event.title}</p>
                <p className="truncate font-display text-xl leading-tight text-paper">{p.name}</p>
                <p className="text-[0.7rem] text-paper-dim">
                  {w.goals}G · {w.assists}A{w.cleanSheets ? ` · ${w.cleanSheets}CS` : ""} · {plural(w.games, "game")}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
