import { photos } from "../lib/photos";

export default function AtmosphereBreak() {
  return (
    <section className="relative h-[60vh] min-h-[22rem] overflow-hidden border-b border-ink-line md:h-[80vh]">
      <img
        src={photos.tunnel}
        alt="Players walking out through the tunnel before a match"
        className="duotone absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
      <div className="duotone-wash pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/80 to-transparent" />
      <p className="absolute bottom-6 left-6 text-sm text-paper-dim md:bottom-10 md:left-10">
        Same tunnel, every week.
      </p>
    </section>
  );
}
