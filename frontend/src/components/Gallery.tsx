import { useState } from "react";
import { Link } from "react-router-dom";
import { useHomeContent } from "../lib/HomeContentContext";
import { useHighlights } from "../lib/HighlightsContext";
import { YOUTUBE_URL } from "../lib/contact";
import { MatchIcon, MatchVideo, PlayIcon, ReelIcon, ReelTile, ReelViewer, splitHighlights } from "./HighlightPlayers";

// Home page highlights teaser: the latest match film with a side panel of
// older ones, then a rail of Instagram reels. Falls back to the photo
// gallery from the home content until any videos have synced.

const HOME_REELS = 6;

export default function Gallery() {
  const { highlights } = useHighlights();
  const { matches, reels } = splitHighlights(highlights);
  const [openReel, setOpenReel] = useState<number | null>(null);

  if (matches.length === 0 && reels.length === 0) return <PhotoGallery />;

  const [latest, ...older] = matches;
  const shownReels = reels.slice(0, HOME_REELS);

  return (
    <section id="gallery" className="relative overflow-hidden border-b border-ink-line bg-ink">
      {/* A faint floodlight wash so the section doesn't read flat. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[60rem] -translate-x-1/2 rounded-full bg-paper/[0.04] blur-3xl"
      />
      <div className="relative mx-auto max-w-7xl px-5 py-12 md:px-10 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-line pb-6">
          <div>
            <p className="text-sm text-paper-dim">Highlights</p>
            <h2 className="mt-2 font-display text-[2.75rem] leading-none text-paper md:mt-3 md:text-6xl">
              The Noise, on film
            </h2>
          </div>
          <Link
            to="/highlights"
            className="hidden border border-paper/40 px-5 py-3 text-sm text-paper transition-colors hover:border-paper sm:inline-flex"
          >
            View all highlights →
          </Link>
        </div>

        {latest && (
          <div className="mt-6 grid gap-4 md:mt-10 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-8">
              <MatchVideo key={latest.id} item={latest} featured />
            </div>

            <aside className="flex flex-col border border-ink-line bg-ink-raised/40 p-5 lg:col-span-4 lg:p-6">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-paper-dim">
                <MatchIcon className="h-5 w-5 text-paper" /> Match Highlights
              </p>

              {older.length > 0 ? (
                <ul className="mt-5 space-y-4">
                  {older.slice(0, 3).map((m) => (
                    <li key={m.id}>
                      <Link to="/highlights" className="group flex items-center gap-3">
                        <span className="relative aspect-video w-28 shrink-0 overflow-hidden bg-ink ring-1 ring-ink-line">
                          <img src={m.src} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          <span className="absolute inset-0 flex items-center justify-center bg-ink/30">
                            <PlayIcon className="h-5 w-5 text-paper" />
                          </span>
                        </span>
                        <span className="min-w-0">
                          <span className="line-clamp-2 text-sm font-semibold leading-snug text-paper group-hover:underline">
                            {m.caption || "Match highlights"}
                          </span>
                          {m.date && <span className="mt-0.5 block text-xs text-mist">{m.date}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm leading-relaxed text-paper-dim">
                  Every matchday, filmed start to finish — goals, saves and the banter in between. New films drop on our
                  YouTube after each set.
                </p>
              )}

              <div className="mt-6 flex flex-col gap-2 pt-1 sm:flex-row lg:mt-auto lg:flex-col">
                <Link
                  to="/highlights"
                  className="flex-1 bg-paper px-5 py-3 text-center text-sm font-semibold text-ink transition-opacity hover:opacity-90"
                >
                  All match films
                </Link>
                <a
                  href={YOUTUBE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 border border-ink-line px-5 py-3 text-center text-sm text-paper transition-colors hover:border-paper"
                >
                  Subscribe on YouTube ↗
                </a>
              </div>
            </aside>
          </div>
        )}

        {shownReels.length > 0 && (
          <div className={latest ? "mt-12 md:mt-16" : "mt-6 md:mt-10"}>
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-center gap-3">
                <ReelIcon className="h-7 w-7 text-paper" />
                <div>
                  <h3 className="font-display text-2xl leading-none text-paper md:text-3xl">Making Noise</h3>
                  <p className="mt-1 text-xs text-mist">See us perform</p>
                </div>
              </div>
              <Link to="/highlights?tab=reels" className="shrink-0 text-sm text-paper-dim hover:text-paper">
                All reels →
              </Link>
            </div>

            {/* Swipeable rail on phones, a single row on wide screens. */}
            <div className="no-scrollbar -mx-5 mt-5 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-5 px-5 md:mx-0 md:px-0 lg:grid lg:grid-cols-6 lg:gap-3 lg:overflow-visible">
              {shownReels.map((reel, i) => (
                <div key={reel.id} className="w-[42%] shrink-0 snap-start sm:w-[30%] md:w-[23%] lg:w-auto">
                  <ReelTile item={reel} onOpen={() => setOpenReel(i)} />
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          to="/highlights"
          className="mt-8 block w-full border border-paper/40 px-6 py-3.5 text-center text-sm text-paper transition-colors hover:border-paper sm:hidden"
        >
          View all highlights →
        </Link>
      </div>

      {openReel !== null && shownReels[openReel] && (
        <ReelViewer reels={shownReels} index={openReel} onIndex={setOpenReel} onClose={() => setOpenReel(null)} />
      )}
    </section>
  );
}

/** The original photo grid, shown until any videos have synced. */
function PhotoGallery() {
  const { content } = useHomeContent();

  return (
    <section id="gallery" className="border-b border-ink-line bg-ink">
      <div className="mx-auto max-w-7xl px-5 py-12 md:px-10 md:py-20">
        <div className="border-b border-ink-line pb-6">
          <p className="text-sm text-paper-dim">Matchday</p>
          <h2 className="mt-2 font-display text-[2.75rem] leading-none text-paper md:mt-3 md:text-6xl">
            On the pitch
          </h2>
        </div>

        <div className="mt-6 grid auto-rows-[9rem] grid-cols-2 gap-2 sm:grid-cols-4 md:mt-10 md:auto-rows-[11rem]">
          {content.gallery.map((shot, i) => (
            <div key={shot.id} className={`relative overflow-hidden ${i % 4 === 0 ? "row-span-2" : ""}`}>
              <img
                src={shot.imageUrl}
                alt={shot.alt ?? ""}
                loading="lazy"
                className="duotone h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
              <div className="duotone-wash pointer-events-none absolute inset-0" />
            </div>
          ))}
        </div>

        <div className="mt-8 flex sm:mt-10 sm:justify-end">
          <Link
            to="/highlights"
            className="w-full border border-paper/40 px-6 py-3.5 text-center text-sm text-paper transition-colors hover:border-paper sm:w-auto sm:py-3"
          >
            View all highlights →
          </Link>
        </div>
      </div>
    </section>
  );
}
