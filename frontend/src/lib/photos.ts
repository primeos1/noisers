// Curated match-day photography, served from Unsplash's CDN and treated
// with the shared duotone filter in index.css so every photo reads as one
// consistent black / white / ink-navy system regardless of source color.
function unsplash(id: string, width: number) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=75`;
}

export const photos = {
  heroNight: unsplash("photo-1431324155629-1a6deb1dec8d", 1800),
  zenithStadium: unsplash("photo-1594470117722-de4b9a02ebed", 1200),
  grassrootsPitch: unsplash("photo-1550881111-7cfde14b8073", 1200),
  keeperSave: unsplash("photo-1517927033932-b3d18e61fb3a", 900),
  dribbleClose: unsplash("photo-1553778263-73a83bab9b0c", 900),
  bootOnBall: unsplash("photo-1606925797300-0b35e9d1794e", 900),
  scissorKick: unsplash("photo-1560272564-c83b66b1ad12", 900),
  tackleChallenge: unsplash("photo-1543326727-cf6c39e8f84c", 900),
  floodlitGroundskeeper: unsplash("photo-1607627000458-210e8d2bdb1d", 900),
  tackleTwo: unsplash("photo-1626248801379-51a0748a5f96", 900),
  bootTexture: unsplash("photo-1614632537423-1e6c2e7e0aab", 900),
  emptyPitchNight: unsplash("photo-1487466365202-1afdb86c764e", 1600),
  stadiumCrowd: unsplash("photo-1522778119026-d647f0596c20", 1200),
  stadiumFloodlights: unsplash("photo-1489944440615-453fc2b6a9a9", 1600),
  tunnel: unsplash("photo-1577223625816-7546f13df25d", 1800),
  dribbleAlt: unsplash("photo-1600679472829-3044539ce8ed", 900),
  ballInNet: unsplash("photo-1552318965-6e6be7484ada", 900),
  ballOnPitch: unsplash("photo-1486286701208-1d58e9338013", 900),
} as const;
