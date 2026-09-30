import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { absencePeriod, daysUntil, shortDate, todayIso } from "../../lib/absences";
import { kindAccent, readingTime, timeAgo, type Story } from "../../lib/noisers";
import { FaceStack, StoryMedia, leadPlayer, useReveal, type Lookup } from "./StoryArt";

/** Deterministic bar heights for the waveform, so a story always has the same shape. */
function waveform(seed: string, count: number) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: count }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const base = 0.25 + ((h >>> 16) % 1000) / 1000 * 0.75;
    // Swell towards the middle, like a track's loud bit.
    return Math.min(1, base * (0.6 + 0.5 * Math.sin((i / count) * Math.PI)));
  });
}

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0) {
      el.textContent = String(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      el.textContent = String(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span ref={ref}>0</span>;
}

/** From → back bar with a "today" marker, for injuries, trips and bans. */
function AbsenceTimeline({ absence }: { absence: NonNullable<Story["absence"]> }) {
  const today = todayIso();
  const ref = useReveal<HTMLDivElement>(0.3);
  const total = absence.endsOn ? daysUntil(absence.endsOn, absence.startsOn) + 1 : null;
  const done = daysUntil(today, absence.startsOn) + 1;
  const pct = total ? Math.min(100, Math.max(0, (done / total) * 100)) : null;
  const left = absence.endsOn ? daysUntil(absence.endsOn, today) : null;
  return (
    <div ref={ref} className="nz-timeline mt-8">
      <div className="flex justify-between text-xs uppercase tracking-wide text-mist">
        <span>Out {shortDate(absence.startsOn)}</span>
        <span>{absence.endsOn ? `Back ${shortDate(absence.endsOn)}` : "Return TBC"}</span>
      </div>
      <div className={`nz-timeline-track ${absence.endsOn ? "" : "nz-timeline-open"}`}>
        <span className="nz-timeline-fill" style={{ "--pct": `${pct ?? 60}%` } as CSSProperties} />
        {pct !== null && pct > 0 && pct < 100 && (
          <span className="nz-timeline-today" style={{ left: `${pct}%` }}>
            <span>Today</span>
          </span>
        )}
      </div>
      <p className="mt-8 text-sm text-paper-dim">
        {absence.status === "ended"
          ? "Served in full — available again."
          : absence.status === "upcoming"
            ? `Starts in ${daysUntil(absence.startsOn, today)} day${daysUntil(absence.startsOn, today) === 1 ? "" : "s"}.`
            : left !== null
              ? left <= 0
                ? "Last day out."
                : `${left} day${left === 1 ? "" : "s"} to go.`
              : "No return date yet."}{" "}
        <span className="text-mist">{absencePeriod(absence)}</span>
      </p>
    </div>
  );
}

export default function StoryReader({
  story,
  next,
  lookup,
  onClose,
}: {
  story: Story;
  next: Story | null;
  lookup: Lookup;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const bars = useMemo(() => waveform(story.id, 56), [story.id]);
  const accent = kindAccent[story.kind];
  const hero = leadPlayer(story, lookup);

  // Esc closes; the page behind stays put.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // A new story opens at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    scrollRef.current?.style.setProperty("--progress", "0");
    scrollRef.current?.style.setProperty("--scroll", "0");
  }, [story.id]);

  // Parallax hero and the waveform progress bar, driven by CSS vars (no re-renders).
  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    el.style.setProperty("--progress", String(max > 0 ? Math.min(1, el.scrollTop / max) : 1));
    el.style.setProperty("--scroll", String(el.scrollTop));
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: story.headline, text: story.standfirst, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Share sheet dismissed — nothing to do.
    }
  }

  const words = story.headline.split(" ");

  return (
    <div className="nz-reader-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={story.headline}
        className="nz-reader"
        style={{ "--accent": accent } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div ref={scrollRef} onScroll={onScroll} className="nz-reader-scroll">
          {/* Waveform reading progress */}
          <div className="nz-wave" aria-hidden="true">
            <div className="nz-wave-bars">
              {bars.map((h, i) => (
                <span key={i} style={{ height: `${h * 100}%` }} />
              ))}
            </div>
            <div className="nz-wave-bars nz-wave-lit">
              {bars.map((h, i) => (
                <span key={i} style={{ height: `${h * 100}%` }} />
              ))}
            </div>
          </div>

          <div className="nz-reader-bar">
            <button type="button" onClick={onClose} className="nz-round-btn" aria-label="Close story">
              <span aria-hidden="true">✕</span>
            </button>
            <span className="nz-reader-tag">{story.tag}</span>
            <button type="button" onClick={share} className="nz-round-btn" aria-label="Share story">
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
              </svg>
            </button>
          </div>
          {copied && <p className="nz-toast" role="status">Link copied</p>}

          <div className="nz-reader-hero" data-in="">
            <StoryMedia story={story} lookup={lookup} lead />
          </div>

          <article className="nz-reader-body">
            <p className="nz-kicker">
              <span className="nz-onair-dot" aria-hidden="true" />
              {story.tag}
              {story.matchDay ? ` · ${story.matchDay.title}` : ""}
            </p>
            <h1 className="nz-reader-headline" key={story.id}>
              {words.map((w, i) => (
                <span key={i} className="nz-word" style={{ "--i": i } as CSSProperties}>
                  {w}{" "}
                </span>
              ))}
            </h1>
            <p className="nz-reader-standfirst">{story.standfirst}</p>

            <div className="nz-byline">
              <FaceStack ids={story.playerIds} lookup={lookup} max={4} />
              <span>
                Noisers Newsroom · {timeAgo(story.publishedAt)} · {readingTime(story)} min read
              </span>
            </div>

            <div className="nz-prose">
              {story.body.map((p, i) => (
                <p key={i} style={{ "--i": i } as CSSProperties}>
                  {p}
                </p>
              ))}
            </div>

            {story.stats && (
              <div className="nz-stats">
                {story.stats.map((s) => (
                  <div key={s.label} className="nz-stat">
                    <span className="nz-stat-value">
                      <CountUp value={s.value} />
                    </span>
                    <span className="nz-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            {story.scoreline && story.scoreline.length > 0 && (
              <section className="mt-10">
                <h2 className="nz-module-title">Full time</h2>
                <div className="nz-results">
                  {story.scoreline.map((l, i) => (
                    <div key={i} className="nz-result" style={{ "--i": i } as CSSProperties}>
                      <span className={`truncate ${l.homeScore > l.awayScore ? "text-paper" : "text-paper-dim"}`}>{l.home}</span>
                      <span className="nz-result-score">
                        {l.homeScore}–{l.awayScore}
                      </span>
                      <span className={`truncate text-right ${l.awayScore > l.homeScore ? "text-paper" : "text-paper-dim"}`}>
                        {l.away}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {story.lineup && (
              <section className="mt-10">
                <h2 className="nz-module-title">
                  {story.lineup.team} · {story.lineup.won}/{story.lineup.played} won
                </h2>
                <div className="nz-lineup">
                  {story.lineup.playerIds.map((id, i) => {
                    const p = lookup(id);
                    if (!p) return null;
                    return (
                      <Link key={id} to={`/squad/${id}`} className="nz-lineup-card" style={{ "--i": i } as CSSProperties}>
                        <img src={p.photo} alt="" loading="lazy" />
                        <span className="nz-lineup-num">{p.number}</span>
                        <span className="nz-lineup-name">{p.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {story.cards && story.cards.length > 0 && (
              <section className="mt-10">
                <h2 className="nz-module-title">The referee's notebook</h2>
                <ul className="nz-notebook">
                  {story.cards.map((c, i) => {
                    const p = c.playerId ? lookup(c.playerId) : null;
                    return (
                      <li key={i} style={{ "--i": i } as CSSProperties}>
                        <span className="nz-mini-card" data-type={c.type} aria-label={`${c.type} card`} />
                        {p ? (
                          <img src={p.photo} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-line text-xs text-mist">
                            G
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-paper">{c.name}</span>
                          <span className="block truncate text-xs text-mist">{c.reason ?? "No reason given"}</span>
                        </span>
                        {c.minute !== null && <span className="text-sm tabular-nums text-paper-dim">{c.minute}'</span>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {story.absence && <AbsenceTimeline absence={story.absence} />}

            {hero && (
              <Link to={`/squad/${hero.id}`} className="nz-profile-link">
                <img src={hero.photo} alt="" className="h-12 w-12 rounded-full object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs uppercase tracking-wide text-mist">Player profile</span>
                  <span className="block truncate font-display text-xl text-paper">{hero.name}</span>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            )}

            {next && (
              <Link to={`/noisers/${next.id}`} className="nz-upnext" style={{ "--next": kindAccent[next.kind] } as CSSProperties}>
                <span className="text-xs uppercase tracking-[0.2em] text-mist">Up next · {next.tag}</span>
                <span className="mt-2 block font-display text-2xl leading-tight text-paper md:text-3xl">{next.headline}</span>
                <span className="nz-upnext-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
