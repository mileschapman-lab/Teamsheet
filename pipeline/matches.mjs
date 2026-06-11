// pipeline/matches.mjs
// Build MATCH MODE data from real FPL gameweek files: actual fixtures with real
// lineups, scorers, assists and bookings. Selection prefers memorable games
// (goals, big clubs). Consistency rule: only keep fixtures where each team's
// player goals sum EXACTLY to the recorded score (i.e. no own goals anywhere),
// so every shown fact is internally verifiable from the data itself.
// Limitation (honest): FPL records per-match event COUNTS, not minutes — clues
// say "scored 2", not "scored 67'". Event minutes arrive with the
// Transfermarkt game_events adapter.

import fs from "fs";
import { CANON, FLAGS } from "./nationalities.mjs";

const SEASONS = ["2019-20", "2020-21", "2021-22", "2022-23", "2023-24", "2024-25"];
const BIG = new Set(["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs", "Newcastle"]);

function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ""; }
    else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ""; }
    else if (ch !== '\r') f += ch;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

// per-season maps from players_raw: full name -> web display, and -> now_cost
function displayMap(season) {
  const rows = parseCSV(fs.readFileSync(`raw/${season}.csv`, "utf8"));
  const h = rows[0], iF = h.indexOf("first_name"), iS = h.indexOf("second_name"),
        iW = h.indexOf("web_name"), iC = h.indexOf("now_cost");
  const m = {}, cost = {};
  for (const r of rows.slice(1)) {
    if (!r[iF]) continue;
    const full = `${r[iF]} ${r[iS]}`.trim();
    let web = (r[iW] || "").replace(/^[A-Z]\./, "");
    const first = full.split(/\s+/)[0];
    const d = web.includes(" ") ? web
      : web.toLowerCase() === first.toLowerCase() ? web
      : !full.toLowerCase().split(/\s+/).includes(web.toLowerCase()) ? web
      : `${first} ${web}`;
    m[full] = d;
    const c = parseInt(r[iC] || "0", 10);
    cost[full] = c; cost[d] = c;
  }
  return { m, cost };
}

// FPL price -> prime-ish 70-90 rating band (same shape as the generated bank)
function costRating(c) {
  if (!c) return 78;
  return Math.max(70, Math.min(90, Math.round(70 + ((c - 40) / 95) * 20)));
}


// ---- Transfermarkt detailed positions (ewenme/transfers mirror, 1992+) -------
const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/\u00f8/g, "o").replace(/\u0111/g, "d").replace(/\u0142/g, "l");
const TM_ALIAS = { "alisson becker": "alisson", "edward nketiah": "eddie nketiah",
  "heung-min son": "son heung-min", "matthew cash": "matty cash" };
const TMPOS_ABBR = { "Goalkeeper":"GK","Centre-Back":"CB","Left-Back":"LB","Right-Back":"RB",
  "Defensive Midfield":"CDM","Central Midfield":"CM","Attacking Midfield":"CAM",
  "Left Midfield":"LM","Right Midfield":"RM","Left Winger":"LW","Right Winger":"RW",
  "Centre-Forward":"ST","Second Striker":"SS","Sweeper":"CB" };
const TMPOS = {};
{
  const lines = fs.readFileSync("raw/tm_transfers_pl.csv", "utf8").split("\n").slice(1);
  for (const l of lines) {
    const c = l.split(",");
    if (c[1] && c[3] && TMPOS_ABBR[c[3]]) TMPOS[fold(c[1])] = TMPOS_ABBR[c[3]];
  }
}
const tmPos = (name, fb) => TMPOS[fold(name)] || TMPOS[TM_ALIAS[fold(name)]] || fb;

const matches = [];
const namePool = new Set();

for (const season of SEASONS) {
  const { m: dispM, cost } = displayMap(season);
  const disp = (full) => { const d = dispM[full] || full; return CANON[d] || d; };
  const rows = parseCSV(fs.readFileSync(`raw/gw-${season}.csv`, "utf8"));
  const h = rows[0];
  const c = (n) => h.indexOf(n);
  const iName = c("name"), iPos = c("position"), iTeam = c("team"), iFix = c("fixture"),
        iG = c("goals_scored"), iA = c("assists"), iY = c("yellow_cards"), iR = c("red_cards"),
        iOG = c("own_goals"), iMin = c("minutes"), iHome = c("was_home"),
        iHS = c("team_h_score"), iAS = c("team_a_score"), iRound = c("round");
  if ([iName, iPos, iTeam, iFix, iG, iHome, iHS, iAS].some(x => x < 0)) { console.log(`skip ${season}: columns missing`); continue; }

  const fixtures = new Map(); // fixture id -> rows
  for (const r of rows.slice(1)) {
    if (!r[iName] || !r[iFix]) continue;
    const min = parseInt(r[iMin] || "0", 10);
    if (!min) continue;
    const k = r[iFix];
    if (!fixtures.has(k)) fixtures.set(k, []);
    fixtures.get(k).push(r);
    namePool.add(disp(r[iName]));
  }

  for (const [fix, rs] of fixtures) {
    const home = rs.filter(r => r[iHome] === "True");
    const away = rs.filter(r => r[iHome] === "False");
    if (home.length < 11 || away.length < 11) continue;
    const hTeam = home[0][iTeam], aTeam = away[0][iTeam];
    const hs = parseInt(home[0][iHS], 10), as = parseInt(home[0][iAS], 10);
    if (Number.isNaN(hs) || Number.isNaN(as)) continue;
    // consistency: player goals must sum to score exactly (no own goals at all)
    const og = rs.reduce((t, r) => t + parseInt(r[iOG] || "0", 10), 0);
    if (og > 0) continue;
    const sum = (list) => list.reduce((t, r) => t + parseInt(r[iG] || "0", 10), 0);
    if (sum(home) !== hs || sum(away) !== as) continue;
    // memorability: goals or big clubs
    const interest = hs + as + (BIG.has(hTeam) ? 2 : 0) + (BIG.has(aTeam) ? 2 : 0);
    if (hs + as < 3 || interest < 5) continue;

    // featured side = winner if big, else the bigger club, else home
    const featured = (hs > as ? home : as > hs ? away : (BIG.has(hTeam) ? home : away));
    const featTeam = featured[0][iTeam];
    const xi = [...featured].sort((a, b) => parseInt(b[iMin], 10) - parseInt(a[iMin], 10)).slice(0, 11);

    const ev = (r) => ({
      g: parseInt(r[iG] || "0", 10), a: parseInt(r[iA] || "0", 10),
      y: parseInt(r[iY] || "0", 10), red: parseInt(r[iR] || "0", 10),
    });
    const withEvents = xi.filter(r => { const e = ev(r); return e.g || e.a || e.y || e.red; });
    if (withEvents.length < 2) continue;

    // blanks: one event player + one non-event player (knowledge test)
    const noEvents = xi.filter(r => !withEvents.includes(r));
    if (!noEvents.length) continue;
    const blank1 = withEvents[Math.floor(withEvents.length / 2)];
    const blank2 = noEvents[Math.floor(noEvents.length / 2)];

    const D = (r) => disp(r[iName]);
    matches.push({
      season, gw: parseInt(home[0][iRound] || "0", 10),
      home: hTeam, away: aTeam, score: `${hs}–${as}`,
      featured: featTeam,
      interest,
      lineup: xi.map(r => ({
        name: D(r), pos: tmPos(D(r), r[iPos]),
        flag: FLAGS[D(r)] || "⚽",
        rating: costRating(cost[r[iName]] || cost[D(r)]),
        missing: r === blank1 || r === blank2,
        events: ev(r),
      })),
      answers: [D(blank1), D(blank2)],
    });
  }
}

// pick the most interesting, spread across seasons
matches.sort((a, b) => b.interest - a.interest);
const perSeason = {};
const chosen = matches.filter(m => (perSeason[m.season] = (perSeason[m.season] || 0) + 1) <= 5).slice(0, 24);

// verify every chosen match
let bad = 0;
for (const m of chosen) {
  if (m.lineup.length !== 11) { bad++; console.log("lineup!=11", m.home, m.away); }
  if (m.lineup.filter(p => p.missing).length !== 2) { bad++; console.log("blanks!=2"); }
  for (const a of m.answers) if (!namePool.has(a)) { bad++; console.log("answer not in pool", a); }
}
fs.writeFileSync("matches_data.json", JSON.stringify({ chosen, namePool: [...namePool].sort() }));
console.log(`Fixtures scanned -> kept ${matches.length} consistent+memorable -> chose ${chosen.length} | verify bad=${bad}`);
console.log(`Guess pool: ${namePool.size} names`);
for (const m of chosen.slice(0, 8))
  console.log(`  ${m.season} GW${m.gw}: ${m.home} ${m.score} ${m.away}  [featured ${m.featured}; missing: ${m.answers.join(" & ")}]`);
