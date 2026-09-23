import type { ReactNode } from "react";

export default function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="border border-ink-line bg-ink-raised px-6 py-6">
      <p className="text-xs uppercase tracking-wide text-mist">{label}</p>
      <p className="mt-3 font-display text-4xl leading-none text-paper">
        {value}
      </p>
      {hint && <p className="mt-2 text-sm text-paper-dim">{hint}</p>}
    </div>
  );
}
