import type { ReactNode } from "react";
import { useEffect } from "react";

export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/90 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-ink-line bg-ink-raised p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-line pb-4">
          <h2 className="font-display text-2xl text-paper">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-paper-dim hover:text-paper"
          >
            ✕
          </button>
        </div>
        <div className="pt-6">{children}</div>
      </div>
    </div>
  );
}
