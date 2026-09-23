import { useEffect, useState } from "react";

interface BarDatum {
  label: string;
  value: number;
  display?: string;
}

export default function AnimatedBarChart({
  title,
  data,
  color = "var(--color-paper)",
  emptyLabel = "No data yet.",
}: {
  title: string;
  data: BarDatum[];
  color?: string;
  emptyLabel?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="border border-ink-line bg-ink-raised p-6">
      <h3 className="font-display text-xl text-paper">{title}</h3>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-paper-dim">{emptyLabel}</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {data.map((d, i) => {
            const pct = Math.max((d.value / max) * 100, 3);
            return (
              <li key={d.label} className="group relative">
                <div
                  className="pointer-events-none absolute -top-8 left-0 z-10 whitespace-nowrap border border-ink-line bg-ink px-2 py-1 text-xs text-paper opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
                  aria-hidden="true"
                >
                  {d.label}: {d.display ?? d.value}
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-paper">{d.label}</span>
                  <span className="tabular-nums text-paper-dim">{d.display ?? d.value}</span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-ink">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out group-hover:brightness-125"
                    style={{
                      width: mounted ? `${pct}%` : "0%",
                      transitionDelay: `${i * 70}ms`,
                      background: color,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
