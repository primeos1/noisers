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
    <div className="border-b border-ink-line bg-ink px-5 pb-8 pt-[calc(env(safe-area-inset-top)+5.5rem)] md:px-10 md:pb-10 md:pt-44">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-paper-dim">{eyebrow}</p>
          <h1 className="mt-2 font-display text-[2.75rem] leading-none text-paper md:mt-3 md:text-6xl">
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
