// pipeline/emit.mjs
// Stage 3: emit the app's generated-data module and merged level structure.
// Generated puzzles (real FPL data, 2016-now) + curated classics (hand-verified
// 1992-2016) = the app's full bank. Generated player IDs are "g<code>" so they
// can never collide with curated keys.

import fs from "fs";
import { DISPLAY_FIX, PLAYER_FLAGS } from "./players_meta.mjs";
const TM_FLAGS = JSON.parse(fs.readFileSync("tm/flags_by_name.json", "utf8"));
import { FLAGS as MATCH_FLAGS } from "./nationalities.mjs";

const { bank, players } = JSON.parse(fs.readFileSync("bank_generated.json", "utf8"));
const POSMAP = { GK: "GK", DEF: "DF", MID: "MF", FWD: "FW" };
const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/\u00f8/g, "o").replace(/\u0111/g, "d").replace(/\u0142/g, "l");
const TMPOS_ABBR = { "Goalkeeper":"GK","Centre-Back":"CB","Left-Back":"LB","Right-Back":"RB",
  "Defensive Midfield":"CDM","Central Midfield":"CM","Attacking Midfield":"CAM",
  "Left Midfield":"LM","Right Midfield":"RM","Left Winger":"LW","Right Winger":"RW",
  "Centre-Forward":"ST","Second Striker":"SS","Sweeper":"CB" };
const TMPOS = {};
for (const l of fs.readFileSync("raw/tm_transfers_pl.csv", "utf8").split("\n").slice(1)) {
  const c = l.split(",");
  if (c[1] && c[3] && TMPOS_ABBR[c[3]]) TMPOS[fold(c[1])] = TMPOS_ABBR[c[3]];
}

// ---- curate: balanced selection from the 180 -----------------------------------
const byDiff = { easy: [], medium: [], hard: [] };
for (const b of bank) byDiff[b.diff].push(b);          // already quality-sorted
// diversity-capped greedy: quality order, but no player may appear in more
// than CAP chosen puzzles — kills the "same faces over and over" effect.
function pickDiverse(cands, n, used, cap = 2) {
  const out = [], rest = [...cands];
  for (let pass = 0; pass < 3 && out.length < n; pass++) {
    const limit = cap + pass;                       // relax only if quota can't fill
    for (let i = 0; i < rest.length && out.length < n; ) {
      const b = rest[i], ids = [...b.clues, b.answer];
      if (ids.every((id) => (used.get(id) || 0) < limit)) {
        ids.forEach((id) => used.set(id, (used.get(id) || 0) + 1));
        out.push(b); rest.splice(i, 1);
      } else i++;
    }
  }
  return out;
}
const usedLvl = new Map();
const chosen = [
  ...pickDiverse(byDiff.easy, 15, usedLvl),
  ...pickDiverse(byDiff.medium, 30, usedLvl),
  ...pickDiverse(byDiff.hard, 24, usedLvl),
];
const lvlSet = new Set(chosen);
const remaining = (d) => byDiff[d].filter((b) => !lvlSet.has(b));
const usedDaily = new Map();
const daily = [
  ...pickDiverse(remaining("easy"), 12, usedDaily),
  ...pickDiverse(remaining("medium"), 20, usedDaily),
  ...pickDiverse(remaining("hard"), 16, usedDaily),
];
console.log(`Reserved ${daily.length} puzzles for the daily pool`);
console.log(`Curated ${chosen.length} generated puzzles for the app (of ${bank.length})`);

// ---- player entries: everyone appearing in chosen puzzles + search depth -------
const usedIds = new Set();
for (const b of [...chosen, ...daily]) { usedIds.add(b.answer); b.clues.forEach(c => usedIds.add(c)); }
// add extra well-known players purely for search/guess depth (good wrong guesses)
const extras = Object.keys(players)
  .filter(c => !usedIds.has(c) && players[c].minutes >= 9000)
  .sort((a, b) => players[b].minutes - players[a].minutes)
  .slice(0, 150);
const allIds = [...usedIds, ...extras];

function rating(c) {
  // fame-derived prime-ish rating band 70-90 (approximate by construction)
  const p = players[c];
  const pct = Math.min(p.minutes / 18000, 1) * 0.35 + Math.min(p.maxCost / 130, 1) * 0.65;
  return Math.round(70 + pct * 20);
}
function clubsSummary(c) { return Object.keys(players[c].clubs).join(" / "); }

// canonical display + flags (confident-only; absent = hidden in app)
for (const c of allIds) {
  const p = players[c];
  p.display = DISPLAY_FIX[p.display] || p.display;
  if (p.display === "Martinez") p.display = p.mainPos === "GK" ? "Emiliano Martínez" : "Lisandro Martínez";
}
let plines = [];
for (const c of allIds.sort((a, b) => players[a].display.localeCompare(players[b].display))) {
  const p = players[c];
  const flag = TM_FLAGS[p.display] || PLAYER_FLAGS[p.display] || MATCH_FLAGS[p.display] || "";
  plines.push(`  g${c}: [${JSON.stringify(p.display)}, ${JSON.stringify(clubsSummary(c))}, ${JSON.stringify(POSMAP[p.mainPos])}, ${JSON.stringify(flag)}, ${JSON.stringify(TMPOS[fold(p.display)] || p.mainPos)}, ${rating(c)}],`);
}

const lineFor = (b) =>
  `  {clues:[${b.clues.map(c => JSON.stringify("g" + c)).join(",")}],answer:${JSON.stringify("g" + b.answer)},valid:[${JSON.stringify("g" + b.answer)}],diff:${JSON.stringify(b.diff)},sharedClubs:[${b.sharedClubs.map(x => JSON.stringify(x)).join(",")}],era:${JSON.stringify(b.era)}},`;
let dlines = daily.map(lineFor);
let blines = chosen.map(b =>
  `  {clues:[${b.clues.map(c => JSON.stringify("g" + c)).join(",")}],answer:${JSON.stringify("g" + b.answer)},valid:[${JSON.stringify("g" + b.answer)}],diff:${JSON.stringify(b.diff)},sharedClubs:[${b.sharedClubs.map(s => JSON.stringify(s)).join(",")}],era:${JSON.stringify(b.era)}},`
);

const file = `// data/generated.js
// AUTO-GENERATED by the content pipeline (pipeline/) from real FPL season data
// (vaastav/Fantasy-Premier-League, seasons 2016-17..2025-26). Every puzzle is
// verified single-answer against the full ${Object.keys(players).length}-player teammate graph.
// Do not hand-edit; re-run the pipeline instead. Historic (pre-2016) puzzles
// live in data/players.js as the curated classics set. The same pipeline
// ingests the full Transfermarkt dataset in the server phase to extend
// coverage to 1992 (see pipeline/README.md).

export const GEN_PLAYERS = {
${plines.join("\n")}
};

export const GEN_BANK = [
${blines.join("\n")}
];

// Reserved for the DAILY mode only — never appears in levels, so daily answers
// stay fresh relative to the ladder.
export const GEN_DAILY = [
${dlines.join("\n")}
];
`;
fs.writeFileSync("generated.js", file);
const mix = {}; chosen.forEach(b => mix[b.diff] = (mix[b.diff] || 0) + 1);
console.log(`Emitted generated.js | players ${plines.length} | puzzles ${blines.length} | mix ${JSON.stringify(mix)}`);
