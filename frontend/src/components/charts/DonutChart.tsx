import { useEffect, useState } from "react";

interface Slice {
  label: string;
  value: number;
  color: string;
}

const SIZE = 200;
const CENTER = SIZE / 2;
const R = 76;
const STROKE = 26;
const C = 2 * Math.PI * R;
const GAP = 4;

export default function DonutChart({
  title,
  data,
  centerLabel = "Total",
}: {
  title: string;
  data: Slice[];
  centerLabel?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const total = data.reduce((s, d) => s + d.value, 0);
  const visible = data.filter((d) => d.value > 0);

  let cumulative = 0;
  const slices = visible.map((d) => {
    const rawLen = total > 0 ? (d.value / total) * C : 0;
    const len = visible.length > 1 ? Math.max(rawLen - GAP, 0) : rawLen;
    const startAngle = -90 + (cumulative / C) * 360;
    cumulative += rawLen;
    return { ...d, len, startAngle };
  });

  const active = hovered !== null ? slices[hovered] : null;

  return (
    <div className="border border-ink-line bg-ink-raised p-6">
      <h3 className="font-display text-xl text-paper">{title}</h3>

      {total === 0 ? (
        <p className="mt-4 text-sm text-paper-dim">No data yet.</p>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-8 sm:flex-row">
          <div className="relative shrink-0">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label={title}>
              <circle cx={CENTER} cy={CENTER} r={R} fill="none" stroke="var(--color-ink-line)" strokeWidth={STROKE} />
              {slices.map((s, i) => (
                <circle
                  key={s.label}
                  cx={CENTER}
                  cy={CENTER}
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hovered === i ? STROKE + 6 : STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${C} ${C}`}
                  strokeDashoffset={mounted ? C - s.len : C}
                  transform={`rotate(${s.startAngle} ${CENTER} ${CENTER})`}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer transition-[stroke-width,stroke-dashoffset] duration-700 ease-out"
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <title>
                    {s.label}: {s.value} ({Math.round((s.value / total) * 100)}%)
                  </title>
                </circle>
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-display text-3xl text-paper">{active ? active.value : total}</p>
              <p className="max-w-[7rem] text-center text-xs uppercase tracking-wide text-mist">
                {active ? active.label : centerLabel}
              </p>
            </div>
          </div>

          <ul className="w-full flex-1 space-y-1">
            {slices.map((s, i) => (
              <li
                key={s.label}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className={`flex cursor-default items-center justify-between gap-3 border-l-2 py-1.5 pl-3 text-sm transition-colors ${
                  hovered === i ? "border-paper bg-ink" : "border-transparent"
                }`}
              >
                <span className="flex items-center gap-2 text-paper-dim">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="tabular-nums text-paper">
                  {s.value} · {Math.round((s.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
