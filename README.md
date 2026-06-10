# The Team Sheet

A daily football connections game. You're shown three real footballers — name the one who played with all of them. New puzzles daily, streaks, practice mode, shareable results.

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Deploy to Vercel
1. Push this folder to a new GitHub repo.
2. In Vercel, "Add New Project" → import the repo.
3. Framework preset: **Next.js** (auto-detected). No env vars needed yet.
4. Deploy. Done.

## What's built (this version)
- Daily game: 3 puzzles ("matchday"), the same for everyone, rotating by date.
- Onboarding / how-to-play on first visit.
- Practice mode: random puzzles any time (no streak impact).
- Stats: streak, best streak, stickers, matchdays played.
- Coins + two paid clues (clubs/eras, and a narrowing hint).
- Shareable spoiler-free result (uses native share or clipboard).
- Saves progress on the device via localStorage.

## What's NOT built yet (next phases — need a server)
- **Accounts / cross-device sync.** Today, progress is per-device (localStorage).
  Next: a database + auth so a player's record follows them.
- **Server-hosted daily puzzle.** Today the puzzle bank ships in the client, so
  a determined user could inspect answers. Next: serve the daily from an API and
  validate guesses server-side. (Scaffolding note: `app/api/daily` and
  `app/api/profile` folders exist as placeholders for this.)
- **Payments** (coins, Pro/no-ads subscription) — wire Stripe via its official
  SDK, with secret keys set in Vercel env vars, never in code.
- **Ads** — integrate via an ad/mediation provider in the app shell.
- **Weekly skill competition** — separate, age-gated, and on hold pending a
  gambling solicitor's sign-off on the mechanic.

## Project structure
- `app/page.js` — the whole game UI (client component).
- `app/layout.js`, `app/globals.css` — shell, fonts, design system.
- `data/players.js` — player database + verified puzzle bank.
- `lib/game.js` — pure game logic (search, daily selection, guess checking).
- `app/api/*` — placeholders for the server phase.

## Note on puzzle data
Every puzzle in `data/players.js` has been validated so the answer genuinely
shared a club in an overlapping season with all clue players, with clues spanning
at least two clubs. In production this bank is the human-reviewed output of the
generator running against the full player-history dataset.
