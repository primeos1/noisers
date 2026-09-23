import { useEffect, useState } from "react";

interface Segment {
  name: string;
  value: number;
  color: string;
}

interface StackedDatum {
  label: string;
  segments: Segment[];
}

export default function StackedBarChart({
  title,
  data,
  legend,
  emptyLabel = "No data yet.",
}: {
  title: string;
  data: StackedDatum[];
  legend: { name: string; color: string }[];
  emptyLabel?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const max = Math.max(...data.map((d) => d.segments.reduce((s, seg) => s + seg.value, 0)), 1);

  return (
    <div className="border border-ink-line bg-ink-raised p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl text-paper">{title}</h3>
        <div className="flex gap-4 text-xs text-paper-dim">
          {legend.map((l) => (
            <span key={l.name} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
              {l.name}
            </span>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <p className="mt-4 text-sm text-paper-dim">{emptyLabel}</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {data.map((d, i) => {
            const total = d.segments.reduce((s, seg) => s + seg.value, 0);
            return (
              <li key={d.label} className="group relative">
                <div
                  className="pointer-events-none absolute -top-8 left-0 z-10 whitespace-nowrap border border-ink-line bg-ink px-2 py-1 text-xs text-paper opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
                  aria-hidden="true"
                >
                  {d.segments.filter((s) => s.value > 0).map((s) => `${s.name} ${s.value}`).join(" · ")}
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-paper">{d.label}</span>
                  <span className="tabular-nums text-paper-dim">
                    {total} card{total === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-1.5 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-ink">
                  {d.segments
                    .filter((s) => s.value > 0)
                    .map((seg, si) => (
                      <div
                        key={seg.name}
                        className="h-full transition-[width] duration-700 ease-out"
                        style={{
                          width: mounted ? `${(seg.value / max) * 100}%` : "0%",
                          transitionDelay: `${i * 70 + si * 60}ms`,
                          background: seg.color,
                        }}
                      />
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
