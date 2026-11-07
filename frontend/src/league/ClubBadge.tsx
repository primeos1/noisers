import { useId } from "react";
import type { ClubId } from "../lib/league";
import { clubById } from "./data";

/** A round crest: the shirt colour with the club's three letters. */
export function ClubBadge({ id, size = 32 }: { id: ClubId; size?: number }) {
  const c = clubById.get(id)!;
  const { primary, secondary, stripe, on } = c.colours;
  const background = stripe
    ? `repeating-linear-gradient(90deg, ${primary} 0 ${size / 6}px, ${stripe} ${size / 6}px ${size / 3}px)`
    : primary;
  return (
    <span
      className="nl-badge"
      title={c.name}
      style={{ width: size, height: size, background, color: stripe ? "#fff" : on, boxShadow: `inset 0 0 0 ${Math.max(2, size / 14)}px ${secondary}`, fontSize: size * 0.32 }}
    >
      {size >= 26 ? c.short : ""}
    </span>
  );
}

/** The club shirt, drawn in its colours. */
export function Shirt({ id, className }: { id: ClubId; className?: string }) {
  const c = clubById.get(id)!;
  const { primary, secondary, stripe } = c.colours;
  const clip = useId();
  const body = "M38 8 L20 16 L4 38 L18 48 L26 40 L26 112 L94 112 L94 40 L102 48 L116 38 L100 16 L82 8 Q60 24 38 8 Z";
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={`${c.name} shirt, ${c.kit.toLowerCase()}`}>
      <defs>
        <clipPath id={clip}>
          <path d={body} />
        </clipPath>
      </defs>
      <path d={body} fill={primary} />
      {stripe && (
        <g clipPath={`url(#${clip})`}>
          {[30, 52, 74, 96].map((x) => (
            <rect key={x} x={x - 5} y="0" width="11" height="120" fill={stripe} />
          ))}
        </g>
      )}
      {/* collar and cuffs in the trim colour */}
      <path d="M38 8 Q60 24 82 8 Q60 32 38 8 Z" fill={secondary} />
      <path d="M4 38 L18 48 L21 44 L7 34 Z M116 38 L102 48 L99 44 L113 34 Z" fill={secondary} />
      <path d={body} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="1.5" />
      <text x="60" y="78" textAnchor="middle" fontFamily="Bebas Neue, sans-serif" fontSize="22" fill={stripe ? "#fff" : c.colours.on} opacity=".9">
        {c.short}
      </text>
    </svg>
  );
}
