// lib/waitlist.js
// Waitlist capture. Set WAITLIST_ENDPOINT to a form endpoint (e.g. Formspree:
// https://formspree.io/f/XXXXXXXX — free tier, 2-minute setup) and every
// signup POSTs there as JSON. Until it's set, signups save to this device
// only, so the pages are fully testable before the endpoint exists.
export const WAITLIST_ENDPOINT = "";   // <- paste your Formspree (or similar) URL here

export async function submitWaitlist(email, source) {
  const entry = { email: email.trim(), source, ts: new Date().toISOString() };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email)) return { ok: false, reason: "invalid" };
  if (WAITLIST_ENDPOINT) {
    try {
      const r = await fetch(WAITLIST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(entry),
      });
      return { ok: r.ok, reason: r.ok ? "sent" : "endpoint" };
    } catch { return { ok: false, reason: "network" }; }
  }
  try {
    const k = "teamsheet:waitlist";
    const list = JSON.parse(localStorage.getItem(k) || "[]");
    if (!list.some((e) => e.email === entry.email)) list.push(entry);
    localStorage.setItem(k, JSON.stringify(list));
    return { ok: true, reason: "local" };
  } catch { return { ok: false, reason: "storage" }; }
}

export const PRIZES = [
  { club: "Arsenal", emoji: "🔴", line: "Two tickets to an Arsenal home game, 2026/27 season", extra: "+ overnight hotel stay in London" },
  { club: "Manchester United", emoji: "🔴", line: "Two tickets to a Manchester United home game, 2026/27 season", extra: "+ overnight hotel stay in Manchester" },
  { club: "Tottenham Hotspur", emoji: "⚪", line: "Two tickets to a Spurs home game, 2026/27 season", extra: "+ overnight hotel stay in London" },
];
