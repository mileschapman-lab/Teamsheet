# Content Pipeline

Generates verified puzzles from real data. This is the production content engine:
the app's `data/generated.js` is this pipeline's output, never hand-edited.

## Current data source (live now)

Real FPL season data from `vaastav/Fantasy-Premier-League` (GitHub), seasons
2016-17 → 2025-26: ~5,300 player-season appearances, ~1,900 players, with
stable cross-season player IDs (`code`), minutes, positions and prices.

```
raw/*.csv  →  ingest.mjs  →  appearances.json
           →  generate.mjs →  bank_generated.json   (teammate graph + solver)
           →  emit.mjs     →  generated.js          (app data module)
```

Rules enforced by `generate.mjs`:
- Teammates = same club + same season + both actually played (minutes > 0).
- Every puzzle verified **single-answer against the full ~1,900-player graph**.
- 4 clues, ≥2 clubs spread (3-4 preferred), ≥3 of 4 clues are recognisable
  (position-relative fame percentile — FPL prices defenders lower, so fame is
  percentile *within* position, blended with career minutes).
- Difficulty = answer's fame tier. Era = median of clue-overlap seasons.

To refresh content: re-download the season CSVs into `raw/`, then
`node ingest.mjs && node generate.mjs && node emit.mjs` and copy
`generated.js` into `data/`.

## Extending to 1992 (server phase): the Transfermarkt adapter

The full-history source is `dcaribou/transfermarkt-datasets` (37k+ players,
1.8M+ appearances, 1992→now, refreshed weekly; includes nationality, which
fixes the flag fallback, and `game_lineups`/`game_events`, which power the
future Match Mode). Its data files are hosted on r2/Kaggle/data.world —
outside this build environment's network allowlist, which is why the live
source today is FPL. The adapter job, runnable on any normal machine or the
production server:

1. Download `transfermarkt-datasets.zip` (link in their README).
2. Filter `appearances` to `competition_id = GB1` (Premier League).
3. Map rows to this pipeline's appearance shape:
   `{ code: player_id, name, web: player_name, season: derived from date,
      club: club name, pos: position, minutes: minutes_played, cost: market_value_proxy }`
4. Run the SAME `generate.mjs` + `emit.mjs` — nothing else changes.

That single swap extends coverage to 1992, replaces the curated classics with
generated-and-verified equivalents, unifies the player universe (removing the
small cross-set alternate-answer edge case noted below), and adds real
nationalities.

## Known limitation (current build, honest note)

Curated classics (pre-2016, hand-verified) and generated puzzles (2016+, FPL
graph) are verified within their own universes. The app resolves player
identity by NAME (so the same person under two internal ids is handled), but a
theoretical cross-universe alternate answer can't be machine-checked until both
eras live in one graph — which the Transfermarkt adapter provides. Risk is low
(requires a real player to be teammates with all four clues across datasets);
the live "also correct!" design plus the single-universe upgrade is the fix.
