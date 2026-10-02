import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import Layout from "../components/Layout";
import { useExecutives, type Executive, type ExecutiveGroup } from "../lib/ExecutivesContext";

const fallbackTitles = ["President", "Secretary", "Treasurer", "Welfare", "Media"];

/** How each section presents itself on the page — its own name, voice and accent. */
const sections: {
  id: ExecutiveGroup;
  anchor: string;
  label: string;
  short: string;
  heading: string;
  blurb: string;
  accent: string;
}[] = [
  {
    id: "executive",
    anchor: "executives",
    label: "Executives",
    short: "Executives",
    heading: "The Executives",
    blurb: "The committee that steers the club — every decision, every season.",
    accent: "var(--color-win)",
  },
  {
    id: "staff",
    anchor: "staff",
    label: "Staff members",
    short: "Staff",
    heading: "The Backroom",
    blurb: "The staff who keep matchday moving — kit, pitch, cameras and everything in between.",
    accent: "var(--color-paper)",
  },
  {
    id: "disciplinary",
    anchor: "disciplinary",
    label: "Disciplinary committee",
    short: "Discipline",
    heading: "The Panel",
    blurb: "The disciplinary committee. Fair play, firm hand — they hear every case and settle every fine.",
    accent: "var(--color-justice)",
  },
];

const pad = (n: number) => String(n).padStart(2, "0");

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Marks the element with data-in once it scrolls into view (once only). */
function useReveal<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.setAttribute("data-in", "");
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

function Portrait({ exec, className = "", size = "text-[7rem]" }: { exec: Executive; className?: string; size?: string }) {
  if (exec.photo) {
    return (
      <img
        src={exec.photo}
        alt={`${exec.name}, ${exec.title}`}
        loading="lazy"
        className={`exec-photo h-full w-full object-cover ${className}`}
      />
    );
  }
  return (
    <div className="exec-monogram flex h-full w-full items-center justify-center" role="img" aria-label={exec.name}>
      <span className={`exec-photo font-display font-extrabold leading-none text-paper/80 ${size}`}>{initials(exec.name)}</span>
    </div>
  );
}

function Letters({ text, outline = false, offset = 0 }: { text: string; outline?: boolean; offset?: number }) {
  return (
    <span className="block overflow-hidden pb-[0.06em]" aria-hidden="true">
      {[...text].map((ch, i) => (
        <span
          key={i}
          className={outline ? "exec-letter-outline inline-block" : "exec-letter"}
          style={{ "--i": i + offset } as CSSProperties}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

function Hero({ titles }: { titles: string[] }) {
  const words = titles.length ? [...new Set(titles)] : fallbackTitles;
  // Repeat so the strip is always wider than the screen, then double for a seamless loop.
  const strip = Array.from({ length: Math.max(2, Math.ceil(8 / words.length)) }, () => words).flat();

  return (
    <header className="relative overflow-hidden border-b border-ink-line bg-ink px-5 pb-28 pt-[calc(env(safe-area-inset-top)+6rem)] md:px-10 md:pb-48 md:pt-48">
      <div aria-hidden="true" className="floodlight-sweep pointer-events-none absolute -inset-[60%]" />
      <div aria-hidden="true" className="grain pointer-events-none absolute inset-0" />

      <div aria-hidden="true" className="exec-marquee pointer-events-none absolute inset-x-0 bottom-2 overflow-hidden md:bottom-4">
        <div className="exec-marquee-track flex w-max whitespace-nowrap font-display text-[5rem] font-black uppercase leading-none md:text-[9rem]">
          {[0, 1].map((copy) => (
            <span key={copy} className="flex">
              {strip.map((t, i) => (
                <span key={i} className="px-6">
                  {t} ·
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl">
        <p className="exec-fade flex items-center gap-3 text-sm text-paper-dim" style={{ "--d": "0ms" } as CSSProperties}>
          <span className="h-px w-8 bg-paper-dim" />
          Behind the badge
        </p>
        <h1
          aria-label="The Executives"
          className="mt-4 font-display text-[4rem] font-black uppercase leading-[0.85] text-paper sm:text-[6rem] md:text-[9.5rem]"
        >
          <Letters text="The" />
          <Letters text="Executives" outline offset={3} />
        </h1>
        <p
          className="exec-fade mt-8 max-w-md text-sm text-paper-dim md:text-base"
          style={{ "--d": "900ms" } as CSSProperties}
        >
          The people who run Noisers FC off the pitch — the executives, the backroom staff and the disciplinary
          committee, week in, week out.
        </p>
      </div>
    </header>
  );
}

/* ---- Section switcher -------------------------------------------------- */

function SectionSwitcher({
  items,
  active,
  onPick,
}: {
  items: { id: ExecutiveGroup; short: string; count: number; accent: string }[];
  active: ExecutiveGroup;
  onPick: (id: ExecutiveGroup) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  // Slide the highlight under whichever section is in view.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const btn = track.querySelector<HTMLElement>(`[data-id="${active}"]`);
      if (btn) setPill({ x: btn.offsetLeft, w: btn.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [active, items.length]);

  const accent = items.find((i) => i.id === active)?.accent;

  return (
    <nav
      aria-label="Sections"
      className="exec-switch-wrap pointer-events-none sticky -mb-6 pt-6 md:-mb-8 md:pt-8 top-[calc(env(safe-area-inset-top)+4.25rem)] z-40 flex justify-center px-4 md:top-[5.75rem]"
    >
      <div ref={trackRef} className="exec-switch pointer-events-auto relative flex max-w-full rounded-full p-1">
        {pill && (
          <span
            aria-hidden="true"
            className="exec-switch-pill absolute bottom-1 top-1 left-0 rounded-full"
            style={{ transform: `translateX(${pill.x}px)`, width: pill.w, background: accent } as CSSProperties}
          />
        )}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            data-id={item.id}
            aria-current={active === item.id ? "true" : undefined}
            onClick={() => onPick(item.id)}
            className={`relative z-10 flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors duration-300 md:px-5 md:text-sm ${
              active === item.id ? "text-ink" : "text-paper-dim hover:text-paper"
            }`}
          >
            {item.short}
            <span
              className={`rounded-full px-1.5 py-px font-display text-[11px] leading-tight tabular-nums transition-colors duration-300 ${
                active === item.id ? "bg-ink/15" : "bg-paper/10"
              }`}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ---- Chapter heading shared by every section --------------------------- */

function Chapter({
  id,
  number,
  heading,
  label,
  blurb,
  accent,
  art,
}: {
  id: string;
  number: number;
  heading: string;
  label: string;
  blurb: string;
  accent: string;
  art?: ReactNode;
}) {
  const ref = useReveal<HTMLDivElement>(0.4);
  return (
    <div ref={ref} className="exec-chapter relative" style={{ "--accent": accent } as CSSProperties}>
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: accent }}>
            <span className="exec-chapter-num font-display text-base tracking-normal">{pad(number)}</span>
            <span className="exec-chapter-tick" />
            {label}
          </p>
          <h2 id={id} className="mt-3 overflow-hidden font-display text-[3.25rem] font-extrabold uppercase leading-[0.9] text-paper md:text-[5.5rem]">
            <span className="exec-chapter-title block">{heading}</span>
          </h2>
        </div>
        {art}
      </div>
      <p className="exec-chapter-blurb mt-5 max-w-lg text-sm text-paper-dim md:text-base">{blurb}</p>
      <span aria-hidden="true" className="exec-chapter-line mt-8 block h-px" />
    </div>
  );
}

/* ---- 01 · Executives: featured lead + tilt cards ----------------------- */

function Lead({ exec }: { exec: Executive }) {
  const ref = useReveal<HTMLElement>();
  const words = exec.name.split(/\s+/).filter(Boolean);

  return (
    <article
      ref={ref}
      className="exec-lead exec-reveal grid items-center gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-20"
    >
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[22rem] md:max-w-none">
        <div aria-hidden="true" className="exec-glow" />
        <div aria-hidden="true" className="exec-ring" />
        <div className="relative h-full overflow-hidden rounded-[28px] bg-ink-raised">
          <Portrait exec={exec} />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
        </div>
        <span
          aria-hidden="true"
          className="absolute -bottom-5 -right-3 flex h-16 w-16 items-center justify-center rounded-full bg-paper font-display text-2xl font-extrabold text-ink shadow-[0_10px_30px_rgba(0,0,0,0.5)] md:-right-5 md:h-20 md:w-20 md:text-3xl"
        >
          01
        </span>
      </div>

      <div className="text-center md:text-left">
        <p className="flex items-center justify-center gap-3 text-sm uppercase tracking-[0.2em] text-win md:justify-start">
          <span className="exec-rule" />
          {exec.title}
        </p>
        <h3 className="mt-5 font-display text-[3.5rem] font-extrabold uppercase leading-[0.9] text-paper md:text-[6.5rem]">
          {words.map((w, i) => (
            <span key={i} className="mr-[0.2em] inline-block overflow-hidden align-bottom last:mr-0">
              <span className="exec-word" style={{ "--i": i } as CSSProperties}>
                {w}
              </span>
            </span>
          ))}
        </h3>
        <p className="mt-6 text-sm text-mist">Noisers FC · Executive committee</p>
      </div>
    </article>
  );
}

const canTilt = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Card({ exec, index }: { exec: Executive; index: number }) {
  const ref = useReveal<HTMLLIElement>();

  function onMove(e: PointerEvent<HTMLElement>) {
    if (!canTilt()) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.dataset.tilting = "";
    el.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 14}deg`);
    el.style.setProperty("--gx", `${x * 100}%`);
    el.style.setProperty("--gy", `${y * 100}%`);
  }

  function onLeave(e: PointerEvent<HTMLElement>) {
    const el = e.currentTarget;
    delete el.dataset.tilting;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <li ref={ref} className="exec-reveal" style={{ "--d": `${(index % 3) * 120}ms` } as CSSProperties}>
      <article
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="exec-card relative aspect-[3/4] rounded-[22px] bg-ink-raised shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]"
      >
        <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
          <Portrait exec={exec} />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
          <div aria-hidden="true" className="exec-glare absolute inset-0" />
        </div>

        <span aria-hidden="true" className="exec-num absolute left-5 top-4 font-display text-6xl font-black leading-none">
          {pad(index)}
        </span>

        <div className="exec-meta absolute inset-x-0 bottom-0 p-5 md:p-6">
          <p className="flex items-center gap-2.5 text-xs uppercase tracking-[0.2em] text-paper-dim">
            <span className="exec-rule text-win" />
            {exec.title}
          </p>
          <h3 className="mt-2 font-display text-3xl font-extrabold uppercase leading-none text-paper md:text-[2.1rem]">
            {exec.name}
          </h3>
        </div>
      </article>
    </li>
  );
}

function ExecutivesBody({ members }: { members: Executive[] }) {
  const [lead, ...rest] = members;
  if (!lead) return null;
  return (
    <>
      <Lead exec={lead} />
      {rest.length > 0 && (
        <ul className="mt-20 grid gap-6 sm:grid-cols-2 md:mt-28 lg:grid-cols-3 lg:gap-8">
          {rest.map((exec, i) => (
            <Card key={exec.id} exec={exec} index={i + 2} />
          ))}
        </ul>
      )}
    </>
  );
}

/* ---- 02 · Staff: swinging lanyard passes on a swipe rail --------------- */

function StaffBody({ members }: { members: Executive[] }) {
  const ref = useReveal<HTMLUListElement>(0.15);
  const [current, setCurrent] = useState(0);

  // Which pass is centred on the phone rail — drives the dots.
  function onScroll() {
    const rail = ref.current;
    if (!rail) return;
    const mid = rail.scrollLeft + rail.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    Array.from(rail.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setCurrent(best);
  }

  function goTo(i: number) {
    const el = ref.current?.children[i] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  return (
    <>
      <ul
        ref={ref}
        onScroll={onScroll}
        className="exec-rail -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-[12vw] pb-6 pt-14 md:mx-0 md:grid md:snap-none md:grid-cols-3 md:gap-8 md:overflow-visible md:px-0 lg:grid-cols-4"
      >
        {members.map((exec, i) => (
          <li
            key={exec.id}
            className="exec-pass-slot w-[76vw] max-w-[19rem] shrink-0 snap-center md:w-auto md:max-w-none"
            style={{ "--d": `${Math.min(i, 5) * 110}ms` } as CSSProperties}
          >
            <article className="exec-pass relative flex h-full flex-col items-center rounded-[22px] px-6 pb-5 pt-10 text-center">
              <span aria-hidden="true" className="exec-strap" />
              <span aria-hidden="true" className="exec-pass-slot-hole" />

              <div className="exec-pass-avatar relative h-32 w-32 rounded-full p-[3px]">
                <div className="h-full w-full overflow-hidden rounded-full bg-ink">
                  <Portrait exec={exec} size="text-5xl" />
                </div>
              </div>

              <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.25em] text-mist">{exec.title}</p>
              <h3 className="mt-2 font-display text-[2rem] font-extrabold uppercase leading-none text-paper">{exec.name}</h3>

              <div className="mt-auto w-full pt-7">
                <div aria-hidden="true" className="exec-barcode h-7 w-full" />
                <div className="mt-2 flex justify-between font-display text-xs uppercase tracking-[0.2em] text-mist">
                  <span>Staff</span>
                  <span>NFC · {pad(i + 1)}</span>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>

      {members.length > 1 && (
        <div className="mt-2 flex justify-center gap-2 md:hidden">
          {members.map((exec, i) => (
            <button
              key={exec.id}
              type="button"
              aria-label={`Show ${exec.name}`}
              aria-current={current === i ? "true" : undefined}
              onClick={() => goTo(i)}
              className={`exec-dot h-1.5 rounded-full ${current === i ? "w-6 bg-paper" : "w-1.5 bg-paper/25"}`}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ---- 03 · Disciplinary: case files sealed with a gavel ----------------- */

function Scales() {
  const ref = useReveal<SVGSVGElement>(0.5);
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      viewBox="0 0 120 120"
      className="exec-scales mb-1 h-24 w-24 shrink-0 text-justice md:h-36 md:w-36"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M60 26v80M40 108h40M46 108c0-6 6-10 14-10s14 4 14 10" />
      <circle cx="60" cy="20" r="4.5" fill="currentColor" stroke="none" />
      <g className="exec-scales-beam">
        <path d="M18 30h84" />
        <g className="exec-scales-pan exec-scales-pan-l">
          <path d="M18 30 7 70M18 30l11 40" strokeWidth="1.5" />
          <path d="M3 70h30c-2 9-8 13-15 13S5 79 3 70Z" fill="currentColor" fillOpacity="0.25" />
        </g>
        <g className="exec-scales-pan exec-scales-pan-r">
          <path d="m102 30-11 40m11-40 11 40" strokeWidth="1.5" />
          <path d="M87 70h30c-2 9-8 13-15 13s-13-4-15-13Z" fill="currentColor" fillOpacity="0.25" />
        </g>
      </g>
    </svg>
  );
}

function Gavel() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="exec-gavel"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m14.5 12.5-8 8a2.12 2.12 0 1 1-3-3l8-8" />
      <path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8" />
    </svg>
  );
}

function PanelRow({ exec, index }: { exec: Executive; index: number }) {
  const ref = useReveal<HTMLLIElement>(0.3);
  const chair = index === 0;
  return (
    <li ref={ref} className="exec-case" style={{ "--d": `${(index % 2) * 120}ms` } as CSSProperties}>
      <article className="exec-case-inner relative flex items-center gap-4 overflow-hidden rounded-[18px] p-3 pr-5 md:gap-5 md:p-4 md:pr-6">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[14px] bg-ink md:h-24 md:w-24">
          <Portrait exec={exec} size="text-3xl" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-justice">{exec.title}</p>
          <h3 className="mt-1.5 font-display text-[1.75rem] font-extrabold uppercase leading-[0.95] text-paper md:text-3xl">
            {exec.name}
          </h3>
          <p className="mt-1.5 font-display text-xs uppercase tracking-[0.2em] text-mist">Case panel · {pad(index + 1)}</p>
        </div>
        <span aria-hidden="true" className={`exec-seal shrink-0 ${chair ? "is-chair" : ""}`}>
          <Gavel />
        </span>
      </article>
    </li>
  );
}

function PanelBody({ members }: { members: Executive[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 md:gap-5">
      {members.map((exec, i) => (
        <PanelRow key={exec.id} exec={exec} index={i} />
      ))}
    </ul>
  );
}

/* ---- Page -------------------------------------------------------------- */

export default function Executives() {
  const { executives, loading } = useExecutives();
  const [active, setActive] = useState<ExecutiveGroup>("executive");
  const sectionRefs = useRef<Partial<Record<ExecutiveGroup, HTMLElement | null>>>({});

  const filled = sections
    .map((s) => ({ ...s, members: executives.filter((e) => e.group === s.id) }))
    .filter((s) => s.members.length > 0);
  const filledKey = filled.map((s) => s.id).join();

  // Scroll-spy: whichever section crosses the middle band of the screen is active.
  useEffect(() => {
    const els = Object.values(sectionRefs.current).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive((entry.target as HTMLElement).dataset.group as ExecutiveGroup);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [filledKey, loading]);

  function pick(id: ExecutiveGroup) {
    setActive(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <Layout>
      <Hero titles={executives.map((e) => e.title)} />

      <div className="relative overflow-x-clip bg-ink">
        {loading ? (
          <div className="mx-auto grid max-w-7xl gap-6 px-5 py-16 sm:grid-cols-2 md:px-10 md:py-28 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-[22px] bg-ink-raised" />
            ))}
          </div>
        ) : filled.length === 0 ? (
          <div className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-28">
            <div className="rounded-[22px] border border-dashed border-ink-line px-6 py-20 text-center">
              <p className="font-display text-3xl text-paper">The committee line-up is coming soon</p>
              <p className="mt-3 text-sm text-paper-dim">Check back shortly to meet the people behind the club.</p>
            </div>
          </div>
        ) : (
          <>
            {filled.length > 1 && (
              <SectionSwitcher
                items={filled.map((s) => ({ id: s.id, short: s.short, count: s.members.length, accent: s.accent }))}
                active={active}
                onPick={pick}
              />
            )}

            {filled.map((s, i) => (
              <section
                key={s.id}
                id={s.anchor}
                data-group={s.id}
                ref={(el) => {
                  sectionRefs.current[s.id] = el;
                }}
                aria-labelledby={`${s.anchor}-heading`}
                className={`exec-section exec-section-${s.id} relative scroll-mt-[calc(env(safe-area-inset-top)+7.5rem)] md:scroll-mt-40`}
              >
                <div className="relative mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-28">
                  <div className="mb-12 md:mb-20">
                    <Chapter
                      id={`${s.anchor}-heading`}
                      number={i + 1}
                      heading={s.heading}
                      label={s.label}
                      blurb={s.blurb}
                      accent={s.accent}
                      art={s.id === "disciplinary" ? <Scales /> : undefined}
                    />
                  </div>

                  {s.id === "executive" && <ExecutivesBody members={s.members} />}
                  {s.id === "staff" && <StaffBody members={s.members} />}
                  {s.id === "disciplinary" && <PanelBody members={s.members} />}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </Layout>
  );
}
