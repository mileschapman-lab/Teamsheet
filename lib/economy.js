// lib/economy.js
// THE ECONOMY — one config object so every number is tunable in one place.
// Everything is anchored to the per-level earn rate so prices stay in proportion.
// These are defensible STARTING values; tune from real play data.

export const ECONOMY = {
  // ---- earning (flat, not difficulty-scaled) ----
  earn: {
    levelComplete: 40,        // coins for clearing a level
    adDoubleTo: 80,           // watch an ad to double a level reward
    firstClearBonus: 40,      // one-off extra the FIRST time you clear a given level
    dailyComplete: 60,        // finishing the daily matchday
  },

  // ---- spending (helps), priced as multiples of the 40 earn unit ----
  // Moderate gap: each help is a few levels of earning, not dozens.
  // per-puzzle time limits (seconds): harder = more thinking time
  timeLimits: { easy: 60, medium: 75, hard: 90, match: 120 },
  boostSeconds: 30,
  spend: {
    boosterFreeze: 150,   // store item: freeze the clock for one puzzle
    boosterTime: 80,      // store item: +30 seconds
    clueName: 200,        // connect: reveal answer's first name
    clueFlag: 80,         // connect (hard): reveal answer's nationality
    matchFlag: 80,        // match: show missing players' flags
    matchInitial: 120,    // match: show missing players' surname initials
    matchReveal: 300,     // match: reveal one missing player outright
    clueClubs: 80,            // ~2 levels — show clubs/eras on the clue cards
    clueHint: 120,            // ~3 levels — narrowing hint
    refillOneLife: 160,       // ~4 levels — one life back
    refillAllLives: 300,      // ~7-8 levels — full pool
  },

  // ---- buying coins (career-ladder bundles); value-per-pound rises each tier ----
  bundles: [
    { id: "debut",    name: "Make Your Debut", coins: 900,   price: "£1.99",  tag: "" },
    { id: "bench",    name: "Off the Bench",   coins: 2500,  price: "£4.99",  tag: "POPULAR" },
    { id: "firstgoal",name: "First Goal",      coins: 5500,  price: "£9.99",  tag: "" },
    { id: "hattrick", name: "Hat-Trick Hero",  coins: 12000, price: "£19.99", tag: "BEST VALUE" },
  ],

  // ---- subscription ----
  pro: { name: "Winner's Medal", price: "£4.99/mo", perks: ["No ads", "Unlimited lives", "Daily coin bonus"] },

  startingCoins: 200,   // enough to learn the clue system (clubs 80 + initial 120), not enough for a reveal
};

// coins-per-pound, for showing players the value ladder (optional display)
export function valuePerPound(bundle) {
  const p = parseFloat(bundle.price.replace(/[^0-9.]/g, ""));
  return Math.round(bundle.coins / p);
}
