import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import type { HighlightItem } from "../lib/highlights";
import { useHighlights } from "../lib/HighlightsContext";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, YOUTUBE_URL } from "../lib/contact";
import { MatchIcon, MatchVideo, ReelIcon, ReelTile, ReelViewer, splitHighlights } from "../components/HighlightPlayers";

// Two shelves: full match videos from the club's YouTube channel, and the
// reels from Instagram. Both fill themselves from the sync on the backend.

type Tab = "matches" | "reels";

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

  // Photos aren't shown on this page.
  const { matches, reels } = splitHighlights(highlights);
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
