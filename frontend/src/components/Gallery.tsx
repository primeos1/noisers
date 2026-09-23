import { Link } from "react-router-dom";
import { useHomeContent } from "../lib/HomeContentContext";

export default function Gallery() {
  const { content } = useHomeContent();

  return (
    <section id="gallery" className="border-b border-ink-line bg-ink">
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-10">
        <div className="border-b border-ink-line pb-6">
          <p className="text-sm text-paper-dim">Matchday</p>
          <h2 className="mt-3 font-display text-5xl text-paper md:text-6xl">
            On the pitch
          </h2>
        </div>

        <div className="mt-10 grid auto-rows-[9rem] grid-cols-2 gap-2 sm:grid-cols-4 md:auto-rows-[11rem]">
          {content.gallery.map((shot, i) => (
            <div
              key={shot.id}
              className={`relative overflow-hidden ${i % 4 === 0 ? "row-span-2" : ""}`}
            >
              <img
                src={shot.imageUrl}
                alt={shot.alt ?? ""}
                loading="lazy"
                className="duotone h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
              <div className="duotone-wash pointer-events-none absolute inset-0" />
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-end">
          <Link
            to="/highlights"
            className="border border-paper/40 px-6 py-3 text-sm text-paper transition-colors hover:border-paper"
          >
            View all highlights →
          </Link>
        </div>
      </div>
    </section>
  );
}
