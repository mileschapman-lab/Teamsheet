// pipeline/ingest.mjs
// Stage 1: parse raw FPL season files into normalized appearances.
// Output: appearances.json = [{ code, name, season, club, pos, minutes, cost }]
// `code` is FPL's permanent cross-season player ID (stable identity).
// Teammate rule downstream: same club + same season + both minutes > 0.

import fs from "fs";

const SEASONS = ["2016-17","2017-18","2018-19","2019-20","2020-21","2021-22","2022-23","2023-24","2024-25","2025-26"];
const POS = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

// Minimal CSV parser handling quoted fields with commas.
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(field); field = ""; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch !== '\r') field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// team id -> name maps
function loadTeams() {
  const map = {}; // season -> id -> name
  // master list covers early seasons
  const master = parseCSV(fs.readFileSync("raw/master_team_list.csv", "utf8"));
  for (const [season, id, name] of master.slice(1)) {
    (map[season] ||= {})[id] = name;
  }
  // per-season teams.csv (2019-20+) override/extend
  for (const s of SEASONS) {
    const p = `raw/teams-${s}.csv`;
    if (!fs.existsSync(p)) continue;
    const rows = parseCSV(fs.readFileSync(p, "utf8"));
    if (rows.length < 2) continue;
    const hdr = rows[0]; const idI = hdr.indexOf("id"), nameI = hdr.indexOf("name");
    for (const r of rows.slice(1)) if (r[idI]) (map[s] ||= {})[r[idI]] = r[nameI];
  }
  return map;
}

const teams = loadTeams();
const out = [];
let skippedNoTeam = 0, skippedNoMinutes = 0;

for (const season of SEASONS) {
  const rows = parseCSV(fs.readFileSync(`raw/${season}.csv`, "utf8"));
  const hdr = rows[0];
  const col = (n) => hdr.indexOf(n);
  const iCode = col("code"), iFirst = col("first_name"), iSecond = col("second_name"),
        iTeam = col("team"), iType = col("element_type"), iMin = col("minutes"), iCost = col("now_cost"), iWeb = col("web_name");
  for (const r of rows.slice(1)) {
    if (!r[iCode]) continue;
    const minutes = parseInt(r[iMin] || "0", 10);
    if (!minutes) { skippedNoMinutes++; continue; }            // never played that season
    const club = teams[season]?.[r[iTeam]];
    if (!club) { skippedNoTeam++; continue; }
    out.push({
      code: r[iCode],
      name: `${r[iFirst]} ${r[iSecond]}`.trim(), web: r[iWeb] || "",
      season, club,
      pos: POS[r[iType]] || "MID",
      minutes,
      cost: parseInt(r[iCost] || "0", 10),
    });
  }
}

fs.writeFileSync("appearances.json", JSON.stringify(out));
const players = new Set(out.map(a => a.code));
const clubs = new Set(out.map(a => a.club));
console.log(`Ingested ${out.length} appearances | ${players.size} players | ${clubs.size} clubs | ${SEASONS.length} seasons`);
console.log(`Skipped: ${skippedNoMinutes} zero-minute rows, ${skippedNoTeam} unmapped-team rows`);
