# Noisers FC — mobile app

React Native (Expo SDK 57, Expo Router) app for the club. It uses the same
Laravel API as the web app in `../frontend`.

## What's in it

| Tab / screen | What it shows | API |
| --- | --- | --- |
| **Welcome** | Squad passcode entry, or committee sign-in | `POST /player-login`, `POST /login` |
| **Squad** | Your shirt (rating, form, fines owed), the latest match day, and the squad grouped by position with search | `GET /players`, `/cards`, `/match-day-events` |
| **Player** | Rating, stats, and Overview / Games / Form / Fines tabs | same data |
| **Matches** | Match-day history, filtered by All / Results / Live | `GET /match-day-events` |
| **Match sheet** | Game scores with goal and card timelines, contributions, card fines, and team rosters | plus `GET /settings` |
| **Stats** | Overview, leaderboards, positions, and recent activity | same data |
| **Club** | Committee sign-in, then a fines dashboard and the squad passcode to read out to players | `POST /login`, `GET /user`, `GET /settings/passcode`, `POST /logout` |
| **Cards & fines** | Filter unpaid/paid. Tap a card to toggle paid; long-press to delete it | `PUT` / `DELETE /cards/{id}` |
| **Log a card** | Pick a player, choose the card type, and optionally add a reason. The fine starts at the club default | `POST /cards` |

- The app works like the web portal. You need the squad passcode, or a committee sign-in, before any screen opens.
- The passcode is checked by the API, so changing it in web Settings affects every phone at once.
- Once accepted, the passcode stays unlocked on that phone until someone taps **Leave** on the Club tab.
- The gate is enforced with `Stack.Protected` in `src/app/_layout.tsx`.
- The "your shirt" choice is saved only on the phone.
- Committee sign-in uses a Sanctum token named `mobile-ios` or `mobile-android`. It's stored in the Keychain / Keystore through `expo-secure-store`.
- The app refreshes data when you pull down on a screen. While a match day is live, it also refreshes every 30 seconds.

## Running it

1. **Serve the API so the phone can reach it.** The API has to listen on your LAN, not only on localhost:

   ```sh
   cd backend
   php artisan serve --host 0.0.0.0 --port 8000
   ```

2. **Start Expo:**

   ```sh
   cd mobile
   npm install
   npm start          # scan the QR code with Expo Go, or press a / i / w
   ```

   In development the app calls `http://<the machine running Metro>:8000/api`,
   so a phone on the same Wi-Fi works without any setup. To use a different
   server, set `EXPO_PUBLIC_API_URL` (see `.env.example`). The Club tab shows
   which server the app is using.

   Photo URLs that Laravel builds from `APP_URL=http://localhost...` are
   rewritten to that same host, so player photos load on a real device.

## Checks

```sh
npm run typecheck    # tsc --noEmit
npx expo-doctor      # dependency / config health
```

## Layout

```
src/app/            routes (Expo Router): (tabs)/, player/[number], match/[id], admin/
src/components/ui   shared building blocks (Group, Row, Figures, Segmented, chips…)
src/lib/            api client, auth, club data provider, types, derivations
src/theme.ts        brand colours and fonts (same tokens as the web app)
```

`src/lib/derive.ts` is ported from `frontend/src/lib/portal.ts`. If you change
how form, fines or contributions are calculated, update both files.

## Not built yet

- Running a live match day from the phone (team picking, the clock, recording goals). This is still web-only in `/admin/matchday`.
- Squad editing, CMS content, and settings. These are also web-only.
- Push notifications.
- A proper app icon. The Expo default icon is still in place. Add a 1024×1024 crest at `assets/icon.png` before building for the stores.
