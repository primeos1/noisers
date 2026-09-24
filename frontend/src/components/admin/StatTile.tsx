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
    <div className="min-w-0 border border-ink-line bg-ink-raised px-4 py-5 md:px-6 md:py-6">
      <p className="text-[0.7rem] uppercase tracking-wide text-mist md:text-xs">{label}</p>
      <p className="mt-3 break-words font-display text-3xl leading-none text-paper md:text-4xl">
        {value}
      </p>
      {hint && <p className="mt-2 line-clamp-2 text-xs text-paper-dim md:text-sm">{hint}</p>}
    </div>
  );
}
