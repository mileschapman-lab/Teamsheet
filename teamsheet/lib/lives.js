// lib/lives.js
// Lives system: a steady pool that refills over time. Timestamp-based so it
// survives refreshes/closes (we store when lives were last full-calculated and
// recompute on load, rather than running a live countdown that resets).

export const MAX_LIVES = 5;
export const REFILL_MS = 25 * 60 * 1000; // one life every 25 minutes
export const GUESSES_PER_PUZZLE = 3;

// Given stored {lives, livesAt}, return the CURRENT lives and the timestamp
// from which the next life is counting. Pure function — call on load and after
// any change.
export function computeLives(lives, livesAt, now = Date.now()) {
  if (lives >= MAX_LIVES) return { lives: MAX_LIVES, livesAt: now, msToNext: 0 };
  if (!livesAt) livesAt = now;
  const elapsed = now - livesAt;
  const gained = Math.floor(elapsed / REFILL_MS);
  if (gained <= 0) {
    return { lives, livesAt, msToNext: REFILL_MS - elapsed };
  }
  const newLives = Math.min(MAX_LIVES, lives + gained);
  // carry the remainder so refills don't "round down" time you've already waited
  const newAt = newLives >= MAX_LIVES ? now : livesAt + gained * REFILL_MS;
  const msToNext = newLives >= MAX_LIVES ? 0 : REFILL_MS - (now - newAt);
  return { lives: newLives, livesAt: newAt, msToNext };
}

export function spendLife(lives, livesAt, now = Date.now()) {
  // when spending from a full pool, start the refill clock now
  const startedAt = lives >= MAX_LIVES ? now : livesAt;
  return { lives: Math.max(0, lives - 1), livesAt: startedAt };
}

export function refillToFull(now = Date.now()) {
  return { lives: MAX_LIVES, livesAt: now };
}

export function fmtCountdown(ms) {
  if (ms <= 0) return "00:00";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
