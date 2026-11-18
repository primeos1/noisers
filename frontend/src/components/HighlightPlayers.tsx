import { useEffect, useRef, useState } from "react";
import type { HighlightItem } from "../lib/highlights";

// Players shared by the Highlights page and the home page teaser: YouTube
// match films that play in place, and Instagram reels with a full-screen,
// swipeable viewer.

/** YouTube uploads and videos added by hand are match films; reels come from Instagram. */
export function splitHighlights(highlights: HighlightItem[]) {
  return {
    matches: highlights.filter((h) => h.type === "video" && h.source !== "instagram"),
    reels: highlights.filter((h) => h.source === "instagram"),
  };
}

export function youtubeId(link?: string) {
  return link?.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/)?.[1];
}

export function PlayIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

export function ReelIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M3 8.5h18M8.5 3l3 5.5M14.5 3l3 5.5" />
      <path d="M10 12v5l4.5-2.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MatchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function YouTubeFrame({ id, title }: { id: string; title: string }) {
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

export function MatchVideo({ item, featured = false }: { item: HighlightItem; featured?: boolean }) {
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

export function ReelTile({ item, onOpen }: { item: HighlightItem; onOpen: () => void }) {
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

export function ReelViewer({
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
