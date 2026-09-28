import { useEffect, useRef, type CSSProperties, type PointerEvent } from "react";
import Layout from "../components/Layout";
import { useExecutives, type Executive } from "../lib/ExecutivesContext";

const fallbackTitles = ["Chairman", "Secretary", "Treasurer", "Welfare", "Media"];

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
function useReveal<T extends HTMLElement>() {
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
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Portrait({ exec, className = "" }: { exec: Executive; className?: string }) {
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
      <span className="exec-photo font-display text-[7rem] font-extrabold leading-none text-paper/80">{initials(exec.name)}</span>
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
          {ch === " " ? " " : ch}
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
          The people who run Noisers FC off the pitch — organising every set, every fixture and every
          fine, week in, week out.
        </p>
      </div>
    </header>
  );
}

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
        <h2 className="mt-5 font-display text-[3.5rem] font-extrabold uppercase leading-[0.9] text-paper md:text-[6.5rem]">
          {words.map((w, i) => (
            <span key={i} className="mr-[0.2em] inline-block overflow-hidden align-bottom last:mr-0">
              <span className="exec-word" style={{ "--i": i } as CSSProperties}>
                {w}
              </span>
            </span>
          ))}
        </h2>
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

export default function Executives() {
  const { executives, loading } = useExecutives();
  const [lead, ...rest] = executives;

  return (
    <Layout>
      <Hero titles={executives.map((e) => e.title)} />

      <section className="overflow-hidden bg-ink">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-28">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-[22px] bg-ink-raised" />
              ))}
            </div>
          ) : !lead ? (
            <div className="rounded-[22px] border border-dashed border-ink-line px-6 py-20 text-center">
              <p className="font-display text-3xl text-paper">The committee line-up is coming soon</p>
              <p className="mt-3 text-sm text-paper-dim">Check back shortly to meet the people behind the club.</p>
            </div>
          ) : (
            <>
              <Lead exec={lead} />

              {rest.length > 0 && (
                <>
                  <div className="mt-24 flex items-end justify-between gap-4 border-b border-ink-line pb-5 md:mt-36">
                    <h2 className="font-display text-4xl font-extrabold uppercase text-paper md:text-5xl">The committee</h2>
                    <p className="font-display text-xl text-mist">{pad(executives.length)} members</p>
                  </div>
                  <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                    {rest.map((exec, i) => (
                      <Card key={exec.id} exec={exec} index={i + 2} />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}
