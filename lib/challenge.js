// lib/challenge.js
// Head-to-head challenges, Wordle-style: no server needed — the LINK carries
// the challenge. Creator plays a seeded 3-puzzle gauntlet, the link encodes
// the seed + their result; the opponent plays the SAME puzzles and their app
// declares the result. Points framing: WIN 3 · DRAW 1 · LOSS 0 (league tables
// with persistent standings arrive with accounts in the server phase).

import { BANK, DAILY_BANK } from "../data/players";

export const CHALLENGE_SIZE = 3;
export const POINTS = { win: 3, draw: 1, loss: 0 };

// challenge pool: the daily reserve + levels bank (both verified single-answer)
const POOL = [...DAILY_BANK, ...BANK];

// deterministic PRNG so both phones derive identical puzzles from the seed
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}

export function newSeed() {
  return Math.floor(Math.random() * 2147483646) + 1;
}

export function challengePuzzles(seed) {
  const r = rng(seed);
  const idx = new Set();
  while (idx.size < CHALLENGE_SIZE) idx.add(Math.floor(r() * POOL.length));
  return [...idx].map((i) => POOL[i]);
}

// ---- link payload ----
// { v: pool length (version guard), s: seed, n: name, r: [solved, wrongGuesses, secondsUsed] }
export function encodeChallenge(seed, name, result) {
  const payload = { v: POOL.length, s: seed, n: (name || "PLAYER").slice(0, 14), r: [result.solved, result.wrong, result.secs] };
  const json = JSON.stringify(payload);
  const b64 = (typeof window === "undefined" ? Buffer.from(json).toString("base64") : window.btoa(unescape(encodeURIComponent(json))));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeChallenge(code) {
  try {
    let b64 = code.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = (typeof window === "undefined" ? Buffer.from(b64, "base64").toString() : decodeURIComponent(escape(window.atob(b64))));
    const p = JSON.parse(json);
    if (!p || typeof p.s !== "number" || !Array.isArray(p.r) || p.r.length !== 3) return null;
    return {
      seed: p.s,
      name: String(p.n || "A RIVAL").slice(0, 14),
      versionOk: p.v === POOL.length,
      result: { solved: p.r[0], wrong: p.r[1], secs: p.r[2] },
    };
  } catch {
    return null;
  }
}

// ---- head-to-head verdict, from the perspective of `mine` ----
// more puzzles solved wins; tie → fewer wrong guesses; tie → faster; else draw
export function verdict(mine, theirs) {
  if (mine.solved !== theirs.solved) return mine.solved > theirs.solved ? "win" : "loss";
  if (mine.wrong !== theirs.wrong) return mine.wrong < theirs.wrong ? "win" : "loss";
  if (mine.secs !== theirs.secs) return mine.secs < theirs.secs ? "win" : "loss";
  return "draw";
}

export function challengeShareText(myName, oppName, v, mine, theirs, url) {
  const line = v === "win" ? `${myName} beats ${oppName}!` : v === "loss" ? `${oppName} holds off ${myName}!` : "All square!";
  return `THE TEAM SHEET ⚔️ ${line}\n${myName}: ${mine.solved}/${CHALLENGE_SIZE} · ${mine.wrong} wrong · ${mine.secs}s\n${oppName}: ${theirs.solved}/${CHALLENGE_SIZE} · ${theirs.wrong} wrong · ${theirs.secs}s\n${v === "win" ? "+3 pts" : v === "draw" ? "+1 pt" : "0 pts"}${url ? `\nRematch: ${url}` : ""}`;
}
