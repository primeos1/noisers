# Noisers FC — Web Frontend

React + TypeScript + Vite + Tailwind CSS v4. Public marketing site today;
the authenticated admin dashboard (squad, cards/fines, sets & matches,
goals/assists, team randomizer) gets built out here next, ahead of the
Laravel API described in [../roadmap.txt](../roadmap.txt).

## Develop

```
npm install
npm run dev
```

Runs at http://localhost:5173.

## Build

```
npm run build
```

Type-checks with `tsc -b` then builds with Vite into `dist/`.

## Structure

```
src/
  assets/brand/   club crest (white + navy transparent variants), favicon
  components/     home page sections (Hero, Gallery, SquadPreview, ...)
  lib/            clubData.ts (sample data, shaped like the future API
                   response) and photos.ts (curated match photography)
  pages/          route-level pages (Home, Login)
```

`src/lib/clubData.ts` is intentionally shaped like the JSON the Laravel
API will eventually return, so wiring up real data later is a matter of
replacing the static exports with `fetch` calls, not rewriting the
components.
