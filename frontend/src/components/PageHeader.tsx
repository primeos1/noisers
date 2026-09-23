import type { ReactNode } from "react";

export default function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="border-b border-ink-line bg-ink px-6 pb-10 pt-36 md:px-10 md:pt-44">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-paper-dim">{eyebrow}</p>
          <h1 className="mt-3 font-display text-5xl text-paper md:text-6xl">
            {title}
          </h1>
        </div>
        {description && (
          <p className="max-w-sm text-sm text-paper-dim">{description}</p>
        )}
      </div>
    </div>
  );
}
