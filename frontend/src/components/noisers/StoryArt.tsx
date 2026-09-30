import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import logoWhite from "../../assets/brand/logo-white.png";
import type { Player } from "../../lib/clubData";
import { useSquad } from "../../lib/SquadContext";
import type { Story, StoryGameLine } from "../../lib/noisers";

/**
 * Marks the element with data-in once it scrolls into view (once only). A
 * callback ref, so it also catches elements that mount after the first
 * render (e.g. once their data loads).
 */
export function useReveal<T extends Element>(threshold = 0.15) {
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => () => observer.current?.disconnect(), []);
  return useCallback(
    (el: T | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!el || el.hasAttribute("data-in")) return;
      if (!("IntersectionObserver" in window)) {
        el.setAttribute("data-in", "");
        return;
      }
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
      observer.current = io;
    },
    [threshold],
  );
}

/** Looks players up by id — the squad list includes inactive players. */
export function usePlayerLookup() {
  const { players } = useSquad();
  return useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]));
    return (id: number): Player | null => byId.get(id) ?? null;
  }, [players]);
}

export type Lookup = ReturnType<typeof usePlayerLookup>;

/** The story's lead player, if they're still in the squad list. */
export function leadPlayer(story: Story, lookup: Lookup): Player | null {
  for (const id of story.playerIds) {
    const p = lookup(id);
    if (p) return p;
  }
  return null;
}

const abbr = (team: string) => team.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "—";

/** Flip-digit scoreboard for a match report — one row per game. */
export function Scoreboard({ lines, max = 3 }: { lines: StoryGameLine[]; max?: number }) {
  const shown = lines.slice(0, max);
  return (
    <div className="nz-board">
      {shown.map((l, i) => (
        <div key={i} className="nz-board-row" style={{ "--i": i } as CSSProperties}>
          <span className="nz-board-team" title={l.home}>
            {abbr(l.home)}
          </span>
          <span className="nz-flip" data-win={l.homeScore > l.awayScore || undefined}>
            {l.homeScore}
          </span>
          <span className="nz-board-dash">:</span>
          <span className="nz-flip" data-win={l.awayScore > l.homeScore || undefined}>
            {l.awayScore}
          </span>
          <span className="nz-board-team" title={l.away}>
            {abbr(l.away)}
          </span>
        </div>
      ))}
      {lines.length > max && <p className="nz-board-more">+{lines.length - max} more</p>}
    </div>
  );
}

function PlayerFace({ player, className = "" }: { player: Player | null; className?: string }) {
  return player ? (
    <img src={player.photo} alt={player.name} loading="lazy" className={`h-full w-full object-cover ${className}`} />
  ) : (
    <span className="flex h-full w-full items-center justify-center bg-ink-raised">
      <img src={logoWhite} alt="" className="h-1/2 w-1/2 object-contain opacity-60" />
    </span>
  );
}

/**
 * The picture at the top of a story: the lead player's photo (or the crest)
 * plus a piece of artwork that says what kind of story it is at a glance.
 */
export function StoryMedia({ story, lookup, lead = false }: { story: Story; lookup: Lookup; lead?: boolean }) {
  const hero = leadPlayer(story, lookup);
  const hasRed = story.cards?.some((c) => c.type === "red");

  // Team of the week: the lineup fanned out like trading cards, over the side's name.
  if (story.kind === "team_of_week" && story.lineup) {
    const faces = story.lineup.playerIds.slice(0, 5);
    return (
      <div className="nz-media nz-media-totw">
        <span className="nz-totw-name" aria-hidden="true">
          {story.lineup.team}
        </span>
        <div className="nz-fan">
          {faces.map((id, i) => (
            <span
              key={id}
              className="nz-fan-card"
              style={{ "--i": i, "--n": faces.length } as CSSProperties}
            >
              <PlayerFace player={lookup(id)} />
            </span>
          ))}
        </div>
        <span className="nz-crown" aria-hidden="true">
          ♛
        </span>
      </div>
    );
  }

  return (
    <div className="nz-media">
      {hero ? (
        <img
          src={hero.photo}
          alt={hero.name}
          loading={lead ? "eager" : "lazy"}
          className={`nz-kenburns h-full w-full object-cover ${story.kind === "comeback" ? "" : "duotone"}`}
        />
      ) : (
        <div className="nz-media-blank">
          <img src={logoWhite} alt="" className="nz-kenburns h-2/5 w-2/5 object-contain opacity-25" />
        </div>
      )}
      <div className="nz-media-shade" />

      {story.kind === "match_report" && story.scoreline && <Scoreboard lines={story.scoreline} />}

      {story.kind === "discipline" && (
        <div className="nz-cardstack" aria-hidden="true">
          {(story.cards ?? []).slice(0, 3).map((c, i) => (
            <span key={i} className="nz-refcard" data-type={c.type} style={{ "--i": i } as CSSProperties} />
          ))}
          {hasRed && <span className="nz-refcard-flash" />}
        </div>
      )}

      {story.kind === "injury" && (
        <>
          <svg className="nz-ecg" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,32 38,32 46,32 52,12 60,52 67,22 73,32 110,32 118,32 124,8 132,56 139,20 145,32 200,32" />
          </svg>
          <span className="nz-cross" aria-hidden="true" />
        </>
      )}

      {story.kind === "travel" && (
        <div className="nz-flightpath" aria-hidden="true">
          <span className="nz-flight-line" />
          <span className="nz-plane-x">
            <span className="nz-plane-y">✈</span>
          </span>
        </div>
      )}

      {story.kind === "suspension" && (
        <div className="nz-tapes" aria-hidden="true">
          {[0, 1].map((t) => (
            <div key={t} className={`nz-tape nz-tape-${t}`}>
              <div className="nz-tape-track">
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i}>SUSPENDED</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {story.kind === "comeback" && (
        <span className="nz-stamp nz-stamp-back" aria-hidden="true">
          Back!
        </span>
      )}
      {story.kind === "unavailable" && (
        <span className="nz-stamp nz-stamp-out" aria-hidden="true">
          Out
        </span>
      )}
    </div>
  );
}

/** A row of overlapping faces for a story's featured players. */
export function FaceStack({ ids, lookup, max = 5 }: { ids: number[]; lookup: Lookup; max?: number }) {
  const people = ids.map(lookup).filter((p): p is Player => !!p);
  if (people.length === 0) return null;
  return (
    <span className="flex items-center">
      {people.slice(0, max).map((p, i) => (
        <img
          key={p.id}
          src={p.photo}
          alt={p.name}
          title={p.name}
          loading="lazy"
          className="nz-face h-7 w-7 rounded-full object-cover ring-2 ring-ink"
          style={{ "--i": i, marginLeft: i ? "-0.5rem" : 0 } as CSSProperties}
        />
      ))}
      {people.length > max && <span className="ml-1.5 text-xs text-mist">+{people.length - max}</span>}
    </span>
  );
}
