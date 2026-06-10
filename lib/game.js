// lib/game.js
// Pure game logic shared by client and (later) server. No DOM, no React.

import { PLAYERS, BANK } from "../data/players";

export const PER_DAY = 3;       // a "matchday" = 3 puzzles
export const MAX_GUESSES = 4;

const IDS = Object.keys(PLAYERS);
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Fame-ranked, typo-tolerant search across full name / surname / first name.
export function search(query) {
  const q = norm(query.trim());
  if (q.length < 2) return [];
  const hits = [];
  for (const id of IDS) {
    const n = norm(PLAYERS[id][0]);
    const parts = n.split(" ");
    let score = -1;
    if (n.startsWith(q)) score = 4;
    else if (parts[parts.length - 1].startsWith(q)) score = 3;
    else if (parts[0].startsWith(q)) score = 2;
    else if (n.includes(q)) score = 1;
    if (score >= 0) hits.push({ id, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, 6).map((h) => h.id);
}

// Deterministic matchday number from a date (UTC), epoch 2026-01-01.
export function matchdayNumber(date = new Date()) {
  const epoch = Date.UTC(2026, 0, 1);
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((day - epoch) / 86400000) + 1;
}

// Deterministic puzzle indices for a given matchday — same for everyone.
export function dailyPuzzleIndices(matchday) {
  let s = (matchday * 2654435761) % 2147483647;
  const pool = Array.from({ length: BANK.length }, (_, i) => i);
  const out = [];
  for (let i = 0; i < PER_DAY; i++) {
    s = (s * 48271) % 2147483647;
    const j = s % pool.length;
    out.push(pool.splice(j, 1)[0]);
  }
  return out;
}

export function dailyPuzzles(matchday) {
  return dailyPuzzleIndices(matchday).map((i) => BANK[i]);
}

// Live guess check: accept ANY genuinely-valid answer, not just the intended one.
// Returns 'correct_intended' | 'correct_alternate' | 'wrong'.
export function checkGuess(puzzle, guessId) {
  if (puzzle.clues.includes(guessId)) return "wrong";
  if (guessId === puzzle.answer) return "correct_intended";
  if (puzzle.valid.includes(guessId)) return "correct_alternate";
  return "wrong";
}

export function todayKey(date = new Date()) {
  return [date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")].join("-");
}
