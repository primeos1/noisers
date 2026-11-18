import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import type { HighlightItem } from "../lib/highlights";
import { useHighlights } from "../lib/HighlightsContext";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, YOUTUBE_URL } from "../lib/contact";

// Two shelves: full match videos from the club's YouTube channel, and the
// reels from Instagram. Both fill themselves from the sync on the backend.

type Tab = "matches" | "reels";

function youtubeId(link?: string) {
  return link?.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/)?.[1];
}

function PlayIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

function ReelIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M3 8.5h18M8.5 3l3 5.5M14.5 3l3 5.5" />
      <path d="M10 12v5l4.5-2.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MatchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Match Highlights — YouTube                                          */
/* ------------------------------------------------------------------ */

function YouTubeFrame({ id, title }: { id: string; title: string }) {
  return (
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
      title={title}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      className="absolute inset-0 h-full w-full border-0"
    />
  );
}

function MatchVideo({ item, featured = false }: { item: HighlightItem; featured?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(item.link);
  const title = item.caption || "Match highlights";

  function play() {
    if (id) setPlaying(true);
    else if (item.link || item.src) window.open(item.link || item.src, "_blank", "noopener");
  }

  const poster = (
    <button
      type="button"
      onClick={play}
      aria-label={`Play: ${title}`}
      className="group absolute inset-0 block h-full w-full text-left"
    >
      <img
        src={item.src}
        alt=""
        loading={featured ? "eager" : "lazy"}
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
      <span
        className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-paper text-ink shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-110 ${
          featured ? "h-16 w-16 md:h-20 md:w-20" : "h-12 w-12"
        }`}
      >
        <PlayIcon className={featured ? "ml-1 h-7 w-7 md:h-8 md:w-8" : "ml-0.5 h-5 w-5"} />
      </span>
      {featured && (
        <div className="absolute inset-x-0 bottom-0 p-4 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-paper-dim">
            Latest{item.date ? ` · ${item.date}` : ""}
          </p>
          <h2 className="mt-2 line-clamp-2 max-w-3xl font-display text-2xl leading-[1.05] text-paper sm:text-3xl md:text-5xl">
            {title}
          </h2>
        </div>
      )}
    </button>
  );

  if (featured) {
    return (
      <div className="relative aspect-video overflow-hidden bg-ink-raised ring-1 ring-ink-line">
        {playing && id ? <YouTubeFrame id={id} title={title} /> : poster}
      </div>
    );
  }

  return (
    <article>
      <div className="relative aspect-video overflow-hidden bg-ink-raised ring-1 ring-ink-line">
        {playing && id ? <YouTubeFrame id={id} title={title} /> : poster}
      </div>
      <h3 className="mt-3 line-clamp-2 text-[0.95rem] font-semibold leading-snug text-paper">{title}</h3>
      {item.date && <p className="mt-1 text-xs text-mist">{item.date}</p>}
    </article>
  );
}

function MatchHighlights({ items }: { items: HighlightItem[] }) {
  if (items.length === 0) {
    return (
      <Empty
        title="First match film on the way"
        body="Full matchday videos land here as soon as they're up on our YouTube."
        href={YOUTUBE_URL}
        cta="Visit our YouTube"
      />
    );
  }

  const [latest, ...rest] = items;
  return (
    <div>
      <MatchVideo key={latest.id} item={latest} featured />
      {rest.length > 0 && (
        <>
          <h3 className="mt-12 font-display text-2xl text-paper md:text-3xl">More matchdays</h3>
          <div className="mt-5 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((item) => (
              <MatchVideo key={item.id} item={item} />
            ))}
          </div>
        </>
      )}
      <FollowLink href={YOUTUBE_URL} label="Subscribe on YouTube" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Making Noise — Instagram reels                                      */
/* ------------------------------------------------------------------ */

function ReelTile({ item, onOpen }: { item: HighlightItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Play reel${item.caption ? `: ${item.caption}` : ""}`}
      className="group relative block aspect-[9/16] w-full overflow-hidden bg-ink-raised text-left ring-1 ring-ink-line"
    >
      <img
        src={item.src}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/10 to-ink/30" />
      <span className="absolute right-2.5 top-2.5 text-paper/90">
        <ReelIcon className="h-5 w-5" />
      </span>
      <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-paper/40 bg-ink/40 text-paper opacity-90 backdrop-blur-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-paper group-hover:text-ink">
        <PlayIcon className="ml-0.5 h-5 w-5" />
      </span>
      <div className="absolute inset-x-0 bottom-0 p-3">
        {item.caption && (
          <p className="line-clamp-2 text-[0.8rem] font-medium leading-snug text-paper">{item.caption}</p>
        )}
        {item.date && <p className="mt-1 text-[0.7rem] text-paper-dim">{item.date}</p>}
      </div>
    </button>
  );
}

function ReelViewer({
  reels,
  index,
  onIndex,
  onClose,
}: {
  reels: HighlightItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const reel = reels[index];
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const go = (step: number) => onIndex((index + step + reels.length) % reels.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reel"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur"
      onClick={onClose}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touchStart.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        // Swipe up for the next reel, down for the previous — vertical
        // only, so dragging the video's scrub bar doesn't skip reels.
        if (Math.abs(dy) < 60 || Math.abs(dy) < Math.abs(dx) * 1.5) return;
        go(dy < 0 ? 1 : -1);
      }}
    >
      <div
        className="relative h-[100dvh] w-full sm:h-[min(88vh,56rem)] sm:w-auto sm:aspect-[9/16]"
        onClick={(e) => e.stopPropagation()}
      >
        {reel.video ? (
          <video
            key={reel.id}
            src={reel.video}
            poster={reel.src}
            autoPlay
            controls
            playsInline
            loop
            className="h-full w-full bg-black object-contain sm:rounded-2xl"
          />
        ) : (
          <div className="relative h-full w-full sm:overflow-hidden sm:rounded-2xl">
            <img src={reel.src} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-ink/50">
              <a
                href={reel.link}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-paper px-5 py-3 text-sm font-semibold text-ink"
              >
                Watch on Instagram
              </a>
            </div>
          </div>
        )}

        {/* Caption sits above the native controls. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-16 bg-gradient-to-t from-black/70 to-transparent px-4 pb-2 pt-10 sm:rounded-b-2xl">
          {reel.caption && <p className="line-clamp-3 text-sm text-paper">{reel.caption}</p>}
          <p className="mt-1 text-xs text-paper-dim">
            {reel.date}
            {reel.link && (
              <>
                {reel.date ? " · " : ""}
                <a href={reel.link} target="_blank" rel="noreferrer" className="pointer-events-auto underline">
                  View on Instagram
                </a>
              </>
            )}
          </p>
        </div>

        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:rounded-t-2xl">
          <p className="text-xs font-semibold tracking-wide text-paper-dim">
            {index + 1} / {reels.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-lg text-paper backdrop-blur hover:bg-black/70"
          >
            ✕
          </button>
        </div>
      </div>

      {reels.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous reel"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-6 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-paper/30 text-paper hover:border-paper sm:flex"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Next reel"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-6 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-paper/30 text-paper hover:border-paper sm:flex"
          >
            →
          </button>
        </>
      )}
    </div>
  );
}

function MakingNoise({ reels }: { reels: HighlightItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  if (reels.length === 0) {
    return (
      <Empty
        title="Reels coming up"
        body={`Our latest reels from @${INSTAGRAM_HANDLE} show up here on their own.`}
        href={INSTAGRAM_URL}
        cta={`Follow @${INSTAGRAM_HANDLE}`}
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {reels.map((reel, i) => (
          <ReelTile key={reel.id} item={reel} onOpen={() => setOpen(i)} />
        ))}
      </div>
      <FollowLink href={INSTAGRAM_URL} label={`Follow @${INSTAGRAM_HANDLE} on Instagram`} />
      {open !== null && reels[open] && (
        <ReelViewer reels={reels} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FollowLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="mt-12 flex justify-center">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 border border-ink-line px-5 py-3 text-sm font-semibold text-paper transition-colors hover:border-paper"
      >
        {label} <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

function Empty({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="border border-dashed border-ink-line px-6 py-16 text-center md:py-20">
      <p className="font-display text-3xl text-paper">{title}</p>
      <p className="mx-auto mt-3 max-w-sm text-sm text-paper-dim">{body}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex items-center gap-2 bg-paper px-5 py-3 text-sm font-semibold text-ink"
      >
        {cta} <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

const tabs: { id: Tab; label: string; hint: string; icon: typeof MatchIcon }[] = [
  { id: "matches", label: "Match Highlights", hint: "Full matchdays", icon: MatchIcon },
  { id: "reels", label: "Making Noise", hint: "See us perform", icon: ReelIcon },
];

export default function Highlights() {
  const { highlights, loading } = useHighlights();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "reels" ? "reels" : "matches";

  // YouTube uploads and any video added by hand are match films; reels
  // come from Instagram. Photos aren't shown on this page.
  const matches = highlights.filter((h) => h.type === "video" && h.source !== "instagram");
  const reels = highlights.filter((h) => h.source === "instagram");
  const counts: Record<Tab, number> = { matches: matches.length, reels: reels.length };

  return (
    <Layout>
      <PageHeader
        eyebrow="Watch"
        title="Highlights"
        description="Every matchday on film, and the moments in between — straight from our YouTube and Instagram."
      />

      <section className="bg-ink">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-10 md:py-12">
          <div role="tablist" aria-label="Highlights" className="grid grid-cols-2 gap-1 border border-ink-line p-1 md:inline-grid md:min-w-[32rem]">
            {tabs.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setParams(t.id === "matches" ? {} : { tab: t.id }, { replace: true })}
                  className={`flex items-center gap-2.5 px-3 py-3 text-left transition-colors md:px-4 ${
                    active ? "bg-paper text-ink" : "text-paper-dim hover:bg-ink-raised hover:text-paper"
                  }`}
                >
                  <Icon className="h-6 w-6 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold leading-tight">
                      {t.label}
                      {!loading && <span className={active ? "text-ink/50" : "text-mist"}> {counts[t.id]}</span>}
                    </span>
                    <span className={`block truncate text-xs ${active ? "text-ink/60" : "text-mist"}`}>{t.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 md:mt-10" role="tabpanel">
            {loading ? (
              <div className={tab === "matches" ? "aspect-video animate-pulse bg-ink-raised" : "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"}>
                {tab === "reels" &&
                  Array.from({ length: 4 }, (_, i) => <div key={i} className="aspect-[9/16] animate-pulse bg-ink-raised" />)}
              </div>
            ) : tab === "matches" ? (
              <MatchHighlights items={matches} />
            ) : (
              <MakingNoise reels={reels} />
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
