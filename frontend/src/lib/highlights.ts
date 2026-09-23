// Matchday highlights gallery — sample content shaped like the future API
// response. Photos are placeholder Unsplash stock (see photos.ts) until
// the club's own match photography is uploaded; the "video" media type
// is already wired up end-to-end and will populate the same way once
// match footage is available.

import { photos } from "./photos";

export type MediaType = "photo" | "video";

export type HighlightCategory =
  | "Goals"
  | "Saves"
  | "Skills"
  | "Matchday"
  | "Behind the scenes";

export interface HighlightItem {
  id: string;
  type: MediaType;
  src: string;
  alt: string;
  caption: string;
  category: HighlightCategory;
  date: string;
  tall?: boolean;
}

export const highlights: HighlightItem[] = [
  { id: "h1", type: "photo", src: photos.keeperSave, alt: "Goalkeeper diving to make a save", caption: "Adaralegbe's full-stretch save vs Dockside", category: "Saves", date: "20 Sep 2026", tall: true },
  { id: "h2", type: "photo", src: photos.scissorKick, alt: "Player attempting an overhead kick", caption: "Fashola's scissor-kick attempt", category: "Skills", date: "20 Sep 2026", tall: true },
  { id: "h3", type: "photo", src: photos.dribbleClose, alt: "Close-up of a player dribbling the ball", caption: "Owolabi driving through midfield", category: "Skills", date: "20 Sep 2026" },
  { id: "h4", type: "photo", src: photos.tackleChallenge, alt: "Two players challenging for the ball", caption: "Obinna wins the challenge", category: "Matchday", date: "20 Sep 2026" },
  { id: "h5", type: "photo", src: photos.bootOnBall, alt: "Boot striking the ball on turf", caption: "Idehen's second of the afternoon", category: "Goals", date: "20 Sep 2026" },
  { id: "h6", type: "photo", src: photos.stadiumCrowd, alt: "Crowd watching a match from the stands", caption: "A full touchline for the Dockside away day", category: "Matchday", date: "20 Sep 2026", tall: true },
  { id: "h7", type: "photo", src: photos.tackleTwo, alt: "Players in a tackle during a match", caption: "Bakare closes it down", category: "Matchday", date: "13 Sep 2026" },
  { id: "h8", type: "photo", src: photos.dribbleAlt, alt: "Player's boots controlling the ball on grass", caption: "Uzo's first touch, under pressure", category: "Skills", date: "13 Sep 2026" },
  { id: "h9", type: "photo", src: photos.ballInNet, alt: "Ball resting in the back of the net", caption: "3-1. Game over.", category: "Goals", date: "13 Sep 2026" },
  { id: "h10", type: "photo", src: photos.floodlitGroundskeeper, alt: "Groundskeeper preparing the pitch under floodlights", caption: "Pitch prep before kick-off", category: "Behind the scenes", date: "13 Sep 2026" },
  { id: "h11", type: "photo", src: photos.grassrootsPitch, alt: "Grassroots football pitch and goal", caption: "Zenith Astro, matchday morning", category: "Behind the scenes", date: "06 Sep 2026" },
  { id: "h12", type: "photo", src: photos.bootTexture, alt: "Close-up of a boot resting on a match ball", caption: "Warm-up, five minutes to kick-off", category: "Behind the scenes", date: "06 Sep 2026" },
  { id: "h13", type: "photo", src: photos.ballOnPitch, alt: "Match ball sitting on the pitch", caption: "Set point, ready to go", category: "Matchday", date: "06 Sep 2026" },
  { id: "h14", type: "photo", src: photos.emptyPitchNight, alt: "Empty floodlit pitch before kick-off", caption: "Lights on, tunnel out in ten", category: "Behind the scenes", date: "06 Sep 2026", tall: true },
  { id: "h15", type: "photo", src: photos.stadiumFloodlights, alt: "Floodlights over an empty stadium bowl", caption: "Post-match, Zenith empties out", category: "Matchday", date: "30 Aug 2026" },
  { id: "h16", type: "photo", src: photos.tunnel, alt: "Players walking out through the tunnel before a match", caption: "Same tunnel, every week", category: "Behind the scenes", date: "30 Aug 2026", tall: true },
];

export const categories: HighlightCategory[] = [
  "Goals",
  "Saves",
  "Skills",
  "Matchday",
  "Behind the scenes",
];
