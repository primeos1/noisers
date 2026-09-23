import { photos } from "../lib/photos";
import { useHomeContent } from "../lib/HomeContentContext";

export default function StorySection() {
  const { content } = useHomeContent();
  const { story } = content;

  return (
    <section id="story" className="border-b border-ink-line">
      <div className="mx-auto grid max-w-7xl md:grid-cols-2">
        <div className="relative min-h-[22rem] overflow-hidden border-b border-ink-line md:min-h-[32rem] md:border-b-0 md:border-r">
          <img
            src={story.imageUrl || photos.zenithStadium}
            alt="Floodlit stadium bowl viewed from above"
            className="duotone h-full w-full object-cover"
            loading="lazy"
          />
          <div className="duotone-wash pointer-events-none absolute inset-0" />
        </div>

        <div className="flex flex-col justify-center px-6 py-16 md:px-16 md:py-0">
          <p className="text-sm text-paper-dim">{story.eyebrow}</p>
          <h2 className="mt-4 max-w-md font-display text-5xl leading-[0.98] text-paper md:text-6xl">
            {story.headline}
          </h2>
          <div className="mt-6 max-w-md space-y-4 text-base leading-relaxed text-paper-dim">
            <p>{story.paragraph1}</p>
            <p>{story.paragraph2}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
