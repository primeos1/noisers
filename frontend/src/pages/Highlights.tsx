import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { categories, type HighlightCategory } from "../lib/highlights";
import { useHighlights } from "../lib/HighlightsContext";

type Filter = "All" | "Videos" | HighlightCategory;

const filters: Filter[] = ["All", "Videos", ...categories];

// The player for a synced video's post: YouTube watch links become the
// privacy-enhanced embed; Instagram posts get /embed on the end.
function embedFor(link: string): { src: string; youtube: boolean } {
  const youtubeId = link.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/)?.[1];
  if (youtubeId) {
    return { src: `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`, youtube: true };
  }
  return { src: link.split("?")[0].replace(/\/?$/, "/") + "embed", youtube: false };
}

export default function Highlights() {
  const { highlights } = useHighlights();
  const [filter, setFilter] = useState<Filter>("All");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const visible = useMemo(() => {
    if (filter === "All") return highlights;
    if (filter === "Videos") return highlights.filter((h) => h.type === "video");
    return highlights.filter((h) => h.category === filter);
  }, [filter, highlights]);

  const active = openIndex !== null ? visible[openIndex] : null;

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? i : (i + 1) % visible.length));
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? i : (i - 1 + visible.length) % visible.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, visible.length]);

  return (
    <Layout>
      <PageHeader
        eyebrow="Matchday"
        title="Highlights"
        description="Pictures and video from every set — goals, saves, skills and the moments in between."
      />

      <section className="bg-ink">
        <div className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-16">
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFilter(f);
                  setOpenIndex(null);
                }}
                className={`border px-4 py-2 text-sm transition-colors ${
                  filter === f
                    ? "border-paper bg-paper text-ink"
                    : "border-ink-line text-paper-dim hover:border-paper/60 hover:text-paper"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="mt-16 border border-dashed border-ink-line px-6 py-20 text-center">
              <p className="font-display text-3xl text-paper">
                Video highlights coming soon
              </p>
              <p className="mt-3 text-sm text-paper-dim">
                Match footage will land here right after the next set.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid auto-rows-[10rem] grid-cols-2 gap-2 sm:grid-cols-4 md:auto-rows-[12rem]">
              {visible.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setOpenIndex(i)}
                  className={`group relative overflow-hidden text-left ${
                    item.tall ? "row-span-2" : ""
                  }`}
                >
                  <img
                    src={item.src}
                    alt={item.alt}
                    loading="lazy"
                    className="duotone h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="duotone-wash pointer-events-none absolute inset-0" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-3">
                    <p className="text-xs text-paper-dim">{item.category}</p>
                  </div>
                  {item.type === "video" && (
                    <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-paper/50 bg-ink/60 backdrop-blur">
                      <span className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-paper" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {active && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/95 p-4 backdrop-blur md:p-10"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center border border-paper/30 text-paper hover:border-paper"
          >
            ✕
          </button>

          <button
            type="button"
            aria-label="Previous"
            onClick={(e) => {
              e.stopPropagation();
              setOpenIndex((i) => (i === null ? i : (i - 1 + visible.length) % visible.length));
            }}
            className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-paper/30 text-paper hover:border-paper sm:flex"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={(e) => {
              e.stopPropagation();
              setOpenIndex((i) => (i === null ? i : (i + 1) % visible.length));
            }}
            className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-paper/30 text-paper hover:border-paper sm:flex"
          >
            →
          </button>

          <div
            className="max-h-[85vh] max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            {active.video ? (
              <video
                key={active.id}
                src={active.video}
                poster={active.src}
                controls
                autoPlay
                playsInline
                className="mx-auto block max-h-[70vh] w-auto max-w-full bg-ink"
              />
            ) : active.link && embedFor(active.link).youtube ? (
              (() => {
                const embed = embedFor(active.link);
                return (
                  <iframe
                    key={active.id}
                    src={embed.src}
                    title={active.caption || "Video"}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    className={
                      embed.youtube
                        ? "mx-auto block aspect-video w-[min(56rem,calc(100vw-2rem))] max-h-[70vh] border-0 bg-ink"
                        : "mx-auto block h-[70vh] w-[min(26rem,calc(100vw-2rem))] border-0 bg-paper"
                    }
                  />
                );
              })()
            ) : (
              <img
                src={active.src}
                alt={active.alt}
                className="duotone max-h-[70vh] w-full object-contain"
              />
            )}
            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-ink-line pt-4">
              <p className="text-paper">{active.caption}</p>
              <p className="text-sm text-mist">
                {active.category}
                {active.date ? ` · ${active.date}` : ""}
                {active.link && (
                  <>
                    {" · "}
                    <a href={active.link} target="_blank" rel="noreferrer" className="underline hover:text-paper">
                      {embedFor(active.link).youtube ? "Watch on YouTube" : "View on Instagram"}
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
