import { Link } from "react-router-dom";
import { photos } from "../lib/photos";

const shots = [
  { src: photos.keeperSave, alt: "Goalkeeper diving to make a save", span: "row-span-2" },
  { src: photos.dribbleClose, alt: "Close-up of a player dribbling the ball", span: "" },
  { src: photos.tackleChallenge, alt: "Two players challenging for the ball", span: "" },
  { src: photos.scissorKick, alt: "Player attempting an overhead kick", span: "row-span-2" },
  { src: photos.bootOnBall, alt: "Boot striking the ball on turf", span: "" },
  { src: photos.floodlitGroundskeeper, alt: "Groundskeeper preparing the pitch under floodlights", span: "" },
  { src: photos.stadiumCrowd, alt: "Crowd watching a match from the stands", span: "row-span-2" },
  { src: photos.tackleTwo, alt: "Players in a tackle during a match", span: "" },
  { src: photos.dribbleAlt, alt: "Player's boots controlling the ball on grass", span: "" },
  { src: photos.grassrootsPitch, alt: "Grassroots football pitch and goal", span: "" },
  { src: photos.ballInNet, alt: "Ball resting in the back of the net", span: "" },
  { src: photos.bootTexture, alt: "Close-up of a boot resting on a match ball", span: "" },
  { src: photos.ballOnPitch, alt: "Match ball sitting on the pitch", span: "" },
];

export default function Gallery() {
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
          {shots.map((shot) => (
            <div
              key={shot.src}
              className={`relative overflow-hidden ${shot.span}`}
            >
              <img
                src={shot.src}
                alt={shot.alt}
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
