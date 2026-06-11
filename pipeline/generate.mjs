// pipeline/generate.mjs
// Stage 2: build the teammate graph from appearances and generate verified
// 4-clue puzzles. Uniqueness is verified against the FULL player set (all
// ~1900 players with minutes), not just famous ones — that's the single-answer
// guarantee. Difficulty derives from the answer's fame (max FPL price) and
// career minutes; clue recognizability is enforced so puzzles are fair.

import fs from "fs";

const apps = JSON.parse(fs.readFileSync("appearances.json", "utf8"));

// ---- build per-player profile ------------------------------------------------
const P = {}; // code -> { name, stints:Set("club|season"), clubs:Map(club->[seasons]), minutes, maxCost, pos:Map }
for (const a of apps) {
  const p = (P[a.code] ||= { name: a.name, web: a.web, stints: new Set(), clubs: new Map(), minutes: 0, maxCost: 0, pos: {} });
  p.name = a.name; if (a.web) p.web = a.web; // latest name wins (accents stable across seasons)
  p.stints.add(`${a.club}|${a.season}`);
  if (!p.clubs.has(a.club)) p.clubs.set(a.club, []);
  p.clubs.get(a.club).push(a.season);
  p.minutes += a.minutes;
  p.maxCost = Math.max(p.maxCost, a.cost);
  p.pos[a.pos] = (p.pos[a.pos] || 0) + a.minutes;
}
const ALL = Object.keys(P);
for (const c of ALL) {
  const p = P[c];
  p.mainPos = Object.entries(p.pos).sort((a, b) => b[1] - a[1])[0][0];
}

// ---- teammate graph (stint-key index -> neighbor sets) ------------------------
const byStint = new Map(); // "club|season" -> [codes]
for (const c of ALL) for (const s of P[c].stints) {
  if (!byStint.has(s)) byStint.set(s, []);
  byStint.get(s).push(c);
}
const NB = new Map(); // code -> Set of teammate codes
for (const c of ALL) NB.set(c, new Set());
for (const list of byStint.values())
  for (const a of list) { const s = NB.get(a); for (const b of list) if (b !== a) s.add(b); }

function sharedClubSeasons(a, b) { // -> { club, seasons:[...] } best shared club
  const out = new Map();
  for (const s of P[a].stints) if (P[b].stints.has(s)) {
    const [club, season] = s.split("|");
    if (!out.has(club)) out.set(club, []);
    out.get(club).push(season);
  }
  if (!out.size) return null;
  const best = [...out.entries()].sort((x, y) => y[1].length - x[1].length)[0];
  return { club: best[0], seasons: best[1].sort() };
}

function solve(clues) { // all players who are teammates of every clue
  let cand = null;
  for (const c of clues) {
    const nb = NB.get(c);
    cand = cand === null ? new Set(nb) : new Set([...cand].filter(x => nb.has(x)));
    if (!cand.size) return [];
  }
  for (const c of clues) cand.delete(c);
  return [...cand];
}

// ---- fame & eligibility --------------------------------------------------------
// Position-relative fame: FPL prices defenders/GKs systematically lower, so
// fame is the player's price percentile WITHIN their position group, blended
// with career minutes (longevity = recognisability).
const fameScore = {};
{
  const groups = {};
  for (const c of ALL) (groups[P[c].mainPos] ||= []).push(c);
  for (const [pos, list] of Object.entries(groups)) {
    const sorted = [...list].sort((a, b) => P[a].maxCost - P[b].maxCost);
    sorted.forEach((c, i) => {
      const pricePct = i / (sorted.length - 1 || 1);
      const minPct = Math.min(P[c].minutes / 18000, 1); // ~200 full games caps it
      fameScore[c] = 0.65 * pricePct + 0.35 * minPct;
    });
  }
}
function fame(c) { const f = fameScore[c]; return f >= 0.93 ? 3 : f >= 0.72 ? 2 : 1; }
const ANSWER_MIN = 5400;   // ~60 full games: answers are real, established players
const CLUE_MIN = 3600;     // clues must be recognizable squad regulars
const answers = ALL.filter(c => P[c].minutes >= ANSWER_MIN && NB.get(c).size >= 8);
const cluePool = new Set(ALL.filter(c => P[c].minutes >= CLUE_MIN));

function eraBand(seasons) {
  const years = seasons.map(s => parseInt(s.slice(0, 4), 10));
  const mid = years.sort((a, b) => a - b)[Math.floor(years.length / 2)];
  if (mid >= 2023) return "Mid 2020s";
  if (mid >= 2020) return "Early 2020s";
  return "Late 2010s";
}

// ---- generator -----------------------------------------------------------------
function rng(seed) { let s = seed; return () => (s = (s * 48271) % 2147483647) / 2147483647; }
const rand = rng(20260611);

function tryBuild(ans) {
  const mates = [...NB.get(ans)].filter(c => cluePool.has(c));
  if (mates.length < 4) return null;
  // shuffle per attempt (Fisher-Yates with the seeded rng)
  const sh = [...mates];
  for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [sh[i], sh[j]] = [sh[j], sh[i]]; }
  const clues = [], clubs = new Set();
  for (let pass = 0; pass < 2 && clues.length < 4; pass++) {
    for (const m of sh) {
      if (clues.length >= 4) break;
      if (clues.includes(m)) continue;
      const sc = sharedClubSeasons(ans, m);
      if (pass === 0 && clubs.has(sc.club)) continue;
      clues.push(m); clubs.add(sc.club);
    }
  }
  if (clues.length < 4) return null;
  const sol = solve(clues);
  if (sol.length !== 1 || sol[0] !== ans) return null;
  if (clubs.size < 2) return null;
  // no club may dominate: at most 2 of the 4 clues from any one shared club
  const perClub = {};
  for (const sc of clues.map(m2 => sharedClubSeasons(ans, m2))) perClub[sc.club] = (perClub[sc.club] || 0) + 1;
  if (Math.max(...Object.values(perClub)) >= 3) return null;
  // clue recognizability: at least 3 of 4 clues fame>=2
  const famous = clues.filter(c => fame(c) >= 2).length;
  if (famous < 3) return null;
  const shared = clues.map(m => sharedClubSeasons(ans, m));
  const allSeasons = shared.flatMap(s => s.seasons);
  return {
    answer: ans, clues,
    sharedClubs: shared.map(s => s.club),
    spread: clubs.size,
    era: eraBand(allSeasons),
    diff: fame(ans) >= 3 ? "easy" : fame(ans) >= 2 ? "medium" : "hard",
    quality: clubs.size * 10 + famous * 3 + Math.min(P[ans].clubs.size, 4),
  };
}

function disp(c) {
  const p = P[c]; const name = p.name.trim();
  if (!p.web) return name;
  let web = p.web.replace(/^[A-Z]\./, "");            // "B.Fernandes" -> "Fernandes"
  const toks = name.split(/\s+/);
  const nameL = name.toLowerCase(), webL = web.toLowerCase();
  if (web.includes(" ")) {
    // surname-with-space ("De Bruyne", "Van Dijk"): if it ENDS the full name,
    // prepend the first name; otherwise it's already a display name ("Bernardo Silva").
    if (nameL.endsWith(webL) && nameL !== webL) return `${toks[0]} ${web}`;
    return web;
  }
  if (webL === toks[0].toLowerCase()) return name;      // first-name web ("Virgil") -> full name
  if (!toks.map(t => t.toLowerCase()).includes(webL)) return web; // nickname mononym (Fabinho)
  return `${toks[0]} ${web}`;                           // "Bruno Fernandes", "Mohamed Salah"
}

const bank = []; const used = new Set();
for (const a of answers) {
  if (used.has(a)) continue;
  for (let t = 0; t < 30; t++) {
    const p = tryBuild(a);
    if (p) { bank.push(p); used.add(a); break; }
  }
}
bank.sort((a, b) => b.quality - a.quality);
const mix = {}; bank.forEach(b => mix[b.diff] = (mix[b.diff] || 0) + 1);
console.log(`Generated ${bank.length} verified single-answer puzzles | mix ${JSON.stringify(mix)}`);
console.log(`Answer pool was ${answers.length} eligible of ${ALL.length} total players`);
for (const c of ALL) P[c].display = disp(c);
fs.writeFileSync("bank_generated.json", JSON.stringify({ bank, players: P, order: ALL }, (k, v) =>
  v instanceof Set ? [...v] : v instanceof Map ? Object.fromEntries(v) : v));
// preview
for (const b of bank.slice(0, 12))
  console.log(`  [${b.diff}] ${disp(b.answer)}  <-  ${b.clues.map(disp).join(", ")}  (${b.sharedClubs.join("/")})`);
