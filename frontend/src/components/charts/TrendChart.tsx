import { useState } from "react";

interface Point {
  label: string;
  value: number;
  detail: string;
}

const WIDTH = 640;
const HEIGHT = 220;
const PAD_X = 24;
const PAD_TOP = 20;
const PAD_BOTTOM = 32;

export default function TrendChart({ points }: { points: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return <p className="text-sm text-paper-dim">No match days logged yet.</p>;
  }

  const max = Math.max(...points.map((p) => p.value), 1);
  const plotW = WIDTH - PAD_X * 2;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: PAD_X + i * stepX,
    y: PAD_TOP + plotH - (p.value / max) * plotH,
    point: p,
  }));

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const ticks = [0, Math.ceil(max / 2), max];

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    coords.forEach((c, i) => {
      const dist = Math.abs(c.x - x);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHover(nearest);
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Goals scored per match day this season"
      >
        {ticks.map((t) => {
          const y = PAD_TOP + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line
                x1={PAD_X}
                x2={WIDTH - PAD_X}
                y1={y}
                y2={y}
                stroke="var(--color-ink-line)"
                strokeWidth={1}
              />
              <text x={0} y={y + 4} fontSize={11} fill="var(--color-mist)">
                {t}
              </text>
            </g>
          );
        })}

        <path d={path} fill="none" stroke="var(--color-paper)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={hover === i ? 6 : 4} fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth={2} />
            {hover === i && (
              <line x1={c.x} x2={c.x} y1={PAD_TOP} y2={PAD_TOP + plotH} stroke="var(--color-ink-line)" strokeWidth={1} />
            )}
          </g>
        ))}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full border border-ink-line bg-ink-raised px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${(coords[hover].x / WIDTH) * 100}%`,
            top: `${(coords[hover].y / HEIGHT) * 100}%`,
          }}
        >
          <p className="text-paper">{coords[hover].point.value} goals</p>
          <p className="mt-0.5 text-paper-dim">
            {coords[hover].point.detail} · {coords[hover].point.label}
          </p>
        </div>
      )}
    </div>
  );
}
