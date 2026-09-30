import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { useAbsences } from "../lib/AbsencesContext";
import { absenceLabel, absenceStatus, daysUntil, todayIso } from "../lib/absences";
import { desks, kindAccent, readingTime, timeAgo, useNoisersFeed, type Story } from "../lib/noisers";
import { FaceStack, StoryMedia, usePlayerLookup, useReveal, type Lookup } from "../components/noisers/StoryArt";
import StoryReader from "../components/noisers/StoryReader";
import { absenceTone } from "../components/AbsenceBadge";

/* ---- Masthead ------------------------------------------------------------- */

function Masthead({ count }: { count: number }) {
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return (
    <header className="nz-masthead">
      <div className="nz-eq-bg" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </div>
      <div aria-hidden="true" className="grain pointer-events-none absolute inset-0" />

      <div className="relative mx-auto max-w-7xl px-5 md:px-10">
        <p className="nz-onair">
          <span className="nz-onair-dot" aria-hidden="true" />
          On air
          <span className="text-mist">· {today}</span>
        </p>
        <h1 className="nz-title" aria-label="Noisers">
          {[..."NOISERS"].map((ch, i) => (
            <span key={i} className="nz-title-letter" style={{ "--i": i } as CSSProperties} aria-hidden="true">
              {ch}
            </span>
          ))}
        </h1>
        <div className="nz-masthead-rule" aria-hidden="true" />
        <p className="nz-masthead-sub">
          The loudest page in the club. Written live from the scoreboard, the referee's notebook and the physio's
          table{count ? ` — ${count} ${count === 1 ? "story" : "stories"} and counting.` : "."}
        </p>
      </div>
    </header>
  );
}

/* ---- Breaking ticker ------------------------------------------------------ */

function Ticker({ stories }: { stories: Story[] }) {
  if (stories.length === 0) return null;
  const items = stories.slice(0, 8);
  return (
    <div className="nz-ticker" aria-label="Latest headlines">
      <span className="nz-ticker-label">
        <span className="nz-onair-dot" aria-hidden="true" />
        Latest
      </span>
      <div className="nz-ticker-window">
        <div className="nz-ticker-track" style={{ "--dur": `${Math.max(24, items.length * 7)}s` } as CSSProperties}>
          {[0, 1].map((copy) => (
            <span key={copy} className="flex shrink-0" aria-hidden={copy === 1 || undefined}>
              {items.map((s) => (
                <Link key={s.id} to={`/noisers/${s.id}`} tabIndex={copy ? -1 : undefined} className="nz-ticker-item">
                  <span style={{ color: kindAccent[s.kind] }}>●</span> {s.headline}
                </Link>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- Sick bay: who's out right now ---------------------------------------- */

function SickBay({ lookup }: { lookup: Lookup }) {
  const { absences } = useAbsences();
  const today = todayIso();
  const out = absences
    .filter((a) => absenceStatus(a, today) !== "ended" && lookup(a.playerId))
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const ref = useReveal<HTMLDivElement>(0.1);
  if (out.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-5 pt-10 md:px-10" aria-label="Unavailable players">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-3xl uppercase text-paper md:text-4xl">The sick bay</h2>
        <p className="text-sm text-mist">{out.length} out</p>
      </div>
      <div ref={ref} className="nz-bay no-scrollbar">
        {out.map((a, i) => {
          const p = lookup(a.playerId)!;
          const upcoming = absenceStatus(a, today) === "upcoming";
          const total = a.endsOn ? daysUntil(a.endsOn, a.startsOn) + 1 : null;
          const done = daysUntil(today, a.startsOn) + 1;
          const pct = upcoming ? 0 : total ? Math.min(1, Math.max(0, done / total)) : 0.75;
          const left = a.endsOn ? daysUntil(a.endsOn, today) : null;
          return (
            <Link
              key={a.id}
              to={`/squad/${p.id}`}
              className="nz-bay-card"
              style={{ "--i": i, "--pct": pct, "--ring": kindAccent[a.type === "other" ? "unavailable" : a.type] } as CSSProperties}
            >
              <span className="nz-ring" data-open={!a.endsOn || undefined}>
                <img src={p.photo} alt="" loading="lazy" />
              </span>
              <span className="mt-3 block truncate text-sm text-paper">{p.name}</span>
              <span className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ${absenceTone[a.type]}`}>
                {absenceLabel(a.type).short}
              </span>
              <span className="mt-1.5 block text-xs text-mist">
                {upcoming
                  ? `from ${daysUntil(a.startsOn, today)}d`
                  : left === null
                    ? "TBC"
                    : left <= 0
                      ? "back tomorrow"
                      : `${left}d to go`}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ---- Desk switcher -------------------------------------------------------- */

function DeskSwitcher({ active, counts, onPick }: { active: string; counts: Record<string, number>; onPick: (id: string) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const btn = track.querySelector<HTMLElement>(`[data-id="${active}"]`);
      if (!btn) return;
      setPill({ x: btn.offsetLeft, w: btn.offsetWidth });
      // Keep the chosen desk in view on phones.
      const target = btn.offsetLeft - (track.clientWidth - btn.offsetWidth) / 2;
      track.scrollTo({ left: target, behavior: "smooth" });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [active]);

  return (
    <nav className="nz-desks glass-bar mt-10" aria-label="Story sections">
      <div ref={trackRef} className="nz-desks-track no-scrollbar mx-auto max-w-7xl">
        {pill && <span className="nz-desk-pill" style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} aria-hidden="true" />}
        {desks.map((d) => (
          <button
            key={d.id}
            type="button"
            data-id={d.id}
            onClick={() => onPick(d.id)}
            aria-pressed={active === d.id}
            className={`nz-desk ${active === d.id ? "text-ink" : "text-paper-dim"}`}
          >
            {d.label}
            <span className="nz-desk-count">{counts[d.id] ?? 0}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ---- Story cards ---------------------------------------------------------- */

function StoryCard({ story, lookup, lead = false, index }: { story: Story; lookup: Lookup; lead?: boolean; index: number }) {
  const ref = useReveal<HTMLElement>(lead ? 0.05 : 0.2);
  const words = story.headline.split(" ");
  return (
    <article
      ref={ref}
      className={`nz-card ${lead ? "nz-card-lead" : ""}`}
      data-kind={story.kind}
      style={{ "--accent": kindAccent[story.kind], "--tilt": `${index % 2 ? 2.5 : -2.5}deg` } as CSSProperties}
    >
      <Link to={`/noisers/${story.id}`} className="nz-card-link">
        <div className="nz-card-media">
          <StoryMedia story={story} lookup={lookup} lead={lead} />
          <span className="nz-tag">{story.tag}</span>
        </div>
        <div className="nz-card-body">
          <p className="nz-card-meta">
            {timeAgo(story.publishedAt)} · {readingTime(story)} min read
          </p>
          <h3 className="nz-card-headline">
            {lead
              ? words.map((w, i) => (
                  <span key={i} className="nz-word" style={{ "--i": i } as CSSProperties}>
                    {w}{" "}
                  </span>
                ))
              : story.headline}
          </h3>
          <p className="nz-card-standfirst">{story.standfirst}</p>
          <div className="nz-card-foot">
            <FaceStack ids={story.playerIds} lookup={lookup} max={lead ? 6 : 4} />
            <span className="nz-read">
              Read <span aria-hidden="true">→</span>
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto grid max-w-7xl gap-5 px-5 py-10 md:grid-cols-2 md:px-10 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={`nz-skeleton ${i === 0 ? "md:col-span-2" : ""}`} style={{ "--i": i } as CSSProperties}>
          <div className="nz-skeleton-media" />
          <div className="space-y-3 p-5">
            <div className="nz-skeleton-line w-1/3" />
            <div className="nz-skeleton-line h-6 w-11/12" />
            <div className="nz-skeleton-line w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Quiet({ failed }: { failed: boolean }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <svg className="nz-flatline mx-auto" viewBox="0 0 300 60" aria-hidden="true">
        <polyline points="0,30 110,30 120,30 128,12 136,48 144,30 300,30" />
      </svg>
      <h2 className="mt-6 font-display text-4xl uppercase text-paper">{failed ? "Off air" : "Quiet… too quiet"}</h2>
      <p className="mt-3 text-sm text-paper-dim">
        {failed
          ? "We couldn't reach the newsroom. Check your connection and try again."
          : "No stories yet. The first match day, card or injury will get the presses rolling."}
      </p>
    </div>
  );
}

/* ---- Page ----------------------------------------------------------------- */

export default function Noisers() {
  const { stories, loading, failed } = useNoisersFeed();
  const lookup = usePlayerLookup();
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const [desk, setDesk] = useState("all");
  const [shown, setShown] = useState(13);

  const counts = useMemo(
    () => Object.fromEntries(desks.map((d) => [d.id, d.kinds.length ? stories.filter((s) => d.kinds.includes(s.kind)).length : stories.length])),
    [stories],
  );
  const kinds = desks.find((d) => d.id === desk)?.kinds ?? [];
  const visible = kinds.length ? stories.filter((s) => kinds.includes(s.kind)) : stories;
  const [lead, ...rest] = visible;

  const openIndex = storyId ? stories.findIndex((s) => s.id === storyId) : -1;
  const open = openIndex >= 0 ? stories[openIndex] : null;
  const next = openIndex >= 0 ? (stories[openIndex + 1] ?? null) : null;
  const close = useCallback(() => navigate("/noisers", { preventScrollReset: true }), [navigate]);

  function pickDesk(id: string) {
    setDesk(id);
    setShown(13);
  }

  return (
    <Layout>
      <div className="nz-page">
        <Masthead count={stories.length} />
        <Ticker stories={stories} />
        <SickBay lookup={lookup} />

        <DeskSwitcher active={desk} counts={counts} onPick={pickDesk} />

        {loading ? (
          <Skeleton />
        ) : visible.length === 0 ? (
          <Quiet failed={failed} />
        ) : (
          <section key={desk} className="nz-feed mx-auto max-w-7xl px-5 pb-16 pt-8 md:px-10" aria-label="Stories">
            {lead && <StoryCard story={lead} lookup={lookup} lead index={0} />}
            {rest.slice(0, shown - 1).map((s, i) => (
              <StoryCard key={s.id} story={s} lookup={lookup} index={i + 1} />
            ))}
            {visible.length > shown && (
              <button type="button" onClick={() => setShown((n) => n + 12)} className="nz-more">
                Turn the page <span aria-hidden="true">↓</span>
                <span className="block text-xs text-mist">{visible.length - shown} more stories</span>
              </button>
            )}
          </section>
        )}
      </div>

      {/* Portalled out of <main>: its screen-in animation would otherwise make
          it the containing block for these fixed overlays. */}
      {open && createPortal(<StoryReader story={open} next={next} lookup={lookup} onClose={close} />, document.body)}
      {storyId && !open && !loading && createPortal(<StoryReaderMissing onClose={close} />, document.body)}
    </Layout>
  );
}

function StoryReaderMissing({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="sheet md:max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl text-paper">Story not found</h2>
        <p className="mt-2 text-sm text-paper-dim">That story has been taken down or rewritten since the link was shared.</p>
        <div className="sheet-actions mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="border border-paper bg-paper px-4 py-2 text-sm font-medium text-ink">
            Back to Noisers
          </button>
        </div>
      </div>
    </div>
  );
}
