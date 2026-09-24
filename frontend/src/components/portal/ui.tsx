// Shared building blocks for the player portal — phone-first: grouped lists
// instead of tables, a segmented control instead of pills, and the shirt
// back (name over a big number) as the one signature element.

import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Player, Position } from "../../lib/clubData";
import type { Result } from "../../lib/portal";
import defaultPlayerImage from "../../assets/player-default.svg";

export function PageTitle({ title, sub, back }: { title: ReactNode; sub?: ReactNode; back?: string }) {
  const navigate = useNavigate();
  return (
    <header className="mb-5 flex items-start gap-3">
      {back && (
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(back))}
          aria-label="Go back"
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-raised text-paper-dim transition-colors hover:text-paper"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      <div className="min-w-0">
        <h1 className="font-display text-[2.6rem] font-extrabold leading-[0.95] text-paper md:text-5xl">{title}</h1>
        {sub && <div className="mt-1.5 text-sm text-mist">{sub}</div>}
      </div>
    </header>
  );
}

/** Rounded group of rows, iOS-settings style, with an optional heading. */
export function Group({ title, aside, children, className = "" }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mb-6 ${className}`}>
      {(title || aside) && (
        <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
          {title && <h2 className="text-sm font-semibold text-paper-dim">{title}</h2>}
          {aside && <div className="text-xs text-mist">{aside}</div>}
        </div>
      )}
      <div className="divide-y divide-ink-line/70 overflow-hidden rounded-2xl bg-ink-raised">{children}</div>
    </section>
  );
}

const Chevron = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-mist" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export function Row({ to, children, chevron = !!to, className = "" }: { to?: string; children: ReactNode; chevron?: boolean; className?: string }) {
  const body = (
    <>
      {children}
      {chevron && <Chevron />}
    </>
  );
  const base = `flex min-h-[56px] items-center gap-3 px-4 py-3 ${className}`;
  return to ? (
    <Link to={to} className={`${base} transition-[background-color,transform] duration-150 hover:bg-ink-line/25 active:scale-[0.99] active:bg-ink-line/40`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

/** A handful of figures side by side, no boxes. */
export function Figures({ items }: { items: { label: string; value: ReactNode; tone?: string }[] }) {
  return (
    <div className="mb-6 grid rounded-2xl bg-ink-raised px-2 py-4" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((f) => (
        <div key={f.label} className="px-2 text-center">
          <p className={`font-display text-[2rem] font-bold leading-none tabular-nums ${f.tone ?? "text-paper"}`}>{f.value}</p>
          <p className="mt-1.5 text-xs leading-tight text-mist">{f.label}</p>
        </div>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  sticky = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  sticky?: boolean;
}) {
  return (
    <div className={`${sticky ? "sticky top-14 z-30 -mx-4 bg-ink/95 px-4 py-2 backdrop-blur md:top-16" : ""} mb-5`}>
      <div role="tablist" aria-label={label} className="flex overflow-x-auto rounded-full bg-ink-raised p-1 [scrollbar-width:none]">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(o.value)}
              className={`min-w-fit flex-1 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                active ? "bg-paper text-ink" : "text-paper-dim hover:text-paper"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const positionDot: Record<Position, string> = {
  GK: "bg-draw",
  DEF: "bg-win",
  MID: "bg-paper-dim",
  FWD: "bg-loss",
};

export function PositionTag({ position }: { position: Position }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-mist">
      <span className={`h-1.5 w-1.5 rounded-full ${positionDot[position]}`} aria-hidden="true" />
      {position}
    </span>
  );
}

const resultTone: Record<Result, string> = {
  W: "bg-win text-ink",
  D: "bg-draw text-ink",
  L: "bg-loss text-paper",
};

export function ResultChip({ result, size = "sm" }: { result: Result | null; size?: "sm" | "lg" }) {
  const dims = size === "lg" ? "h-10 w-10 rounded-xl text-xl" : "h-7 w-7 rounded-lg text-sm";
  const label = result === "W" ? "Won" : result === "D" ? "Drew" : result === "L" ? "Lost" : "Not finished";
  if (!result)
    return <span className={`inline-flex ${dims} items-center justify-center bg-ink-line font-display text-mist`} aria-label={label}>–</span>;
  return (
    <span className={`inline-flex ${dims} shrink-0 items-center justify-center font-display font-extrabold ${resultTone[result]}`} aria-label={label}>
      {result}
    </span>
  );
}

/** Cards drawn as little referee cards, with a count. */
export function CardPips({ yellow, red }: { yellow: number; red: number }) {
  if (!yellow && !red) return null;
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`${yellow} yellow, ${red} red`}>
      {yellow > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <span className="h-3.5 w-2.5 rounded-[2px] bg-draw" />
          {yellow > 1 && <span className="text-xs text-paper-dim">{yellow}</span>}
        </span>
      )}
      {red > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <span className="h-3.5 w-2.5 rounded-[2px] bg-loss" />
          {red > 1 && <span className="text-xs text-paper-dim">{red}</span>}
        </span>
      )}
    </span>
  );
}

export function LiveTag() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-loss/15 px-2.5 py-1 text-xs font-semibold text-loss">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-loss" />
      Live
    </span>
  );
}

// Mirrors PlayerRatings::MIN / MAX on the backend.
export const RATING_MIN = 4.0;
export const RATING_MAX = 9.5;

export function RatingMeter({ rating, className = "" }: { rating: number; className?: string }) {
  const pct = Math.min(Math.max(((rating - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100, 0), 100);
  return (
    <div className={className} role="meter" aria-valuemin={RATING_MIN} aria-valuemax={RATING_MAX} aria-valuenow={rating} aria-label="Rating">
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-line">
        <div className="rating-fill h-full rounded-full bg-draw" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[0.65rem] text-mist">
        <span>{RATING_MIN.toFixed(1)}</span>
        <span>{RATING_MAX.toFixed(1)}</span>
      </div>
    </div>
  );
}

/** Horizontal bar used for leaderboards and per-match-day totals. */
export function Bar({ value, max, tone = "bg-paper" }: { value: number; max: number; tone?: string }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-ink-line">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${max > 0 ? Math.max((value / max) * 100, 3) : 0}%` }} />
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 rounded-2xl bg-ink-raised px-6 py-10 text-center text-sm text-paper-dim">
      {children}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** The player's photo (uploaded, or a stock face), or the club's default
 *  player image when it fails to load. */
function PlayerImage({ player, alt, className }: { player: Player; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  const src = player.photo && !failed ? player.photo : defaultPlayerImage;
  return <img src={src} alt={alt} onError={() => setFailed(true)} className={`shrink-0 object-cover ${className}`} />;
}

/** Round player photo for list rows. */
export function Avatar({ player, className = "h-10 w-10" }: { player: Player; className?: string }) {
  return <PlayerImage key={player.photo} player={player} alt="" className={`rounded-full ${className}`} />;
}

/** The player's picture for the big profile cards. */
export function PlayerPicture({ player, className }: { player: Player; className: string }) {
  return <PlayerImage key={player.photo} player={player} alt={player.name} className={`rounded-2xl ${className}`} />;
}

/**
 * The signature element: a shirt back with the player's name printed over
 * their number. Drawn in SVG so the lettering scales with the shirt.
 */
export function ShirtBack({ name, number, className = "" }: { name: string; number: number; className?: string }) {
  const surname = name.trim().split(/\s+/).slice(-1)[0]?.toUpperCase() ?? "";
  const nameSize = Math.min(19, 150 / Math.max(surname.length, 1) + 2);
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={`${name}, number ${number}`}>
      <path
        d="M62 18 L84 10 Q100 22 116 10 L138 18 L186 48 L168 84 L148 74 L148 192 L52 192 L52 74 L32 84 L14 48 Z"
        fill="var(--color-ink-line)"
        stroke="var(--color-mist)"
        strokeOpacity="0.35"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M84 10 Q100 22 116 10" fill="none" stroke="var(--color-paper)" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
      <text x="100" y="56" textAnchor="middle" fill="var(--color-paper)" fontFamily="var(--font-display)" fontWeight="700" fontSize={nameSize} letterSpacing="2.5">
        {surname}
      </text>
      <text x="100" y="164" textAnchor="middle" fill="var(--color-paper)" fontFamily="var(--font-display)" fontWeight="900" fontSize="104">
        {number}
      </text>
    </svg>
  );
}
