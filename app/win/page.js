"use client";
// /win — the shareable launch landing page: planned Weekly Cup prizes + waitlist.
// No payment is taken, no competition is open; this page builds the launch list.
import { useState } from "react";
import Link from "next/link";
import { submitWaitlist, PRIZES } from "../../lib/waitlist";

function WaitlistForm({ source }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | busy | done | error
  async function go() {
    if (state === "busy") return;
    setState("busy");
    const r = await submitWaitlist(email, source);
    setState(r.ok ? "done" : "error");
  }
  if (state === "done") {
    return (
      <div className="center" style={{ animation: "pop .35s ease both" }}>
        <div className="disp" style={{ fontSize: 22, color: "var(--gold)" }}>✓ YOU'RE ON THE LIST</div>
        <div className="muted" style={{ color: "var(--line)", marginTop: 4 }}>We'll email you the moment the Weekly Cup opens. Until then — the daily game is live.</div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 8, maxWidth: 420, margin: "0 auto" }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email"
          placeholder="your@email.com" onKeyDown={(e) => { if (e.key === "Enter") go(); }}
          style={{ flex: 1, border: "3px solid var(--navy)", borderRadius: 12, padding: "12px 14px", fontWeight: 700, background: "var(--cream)", color: "var(--navy)", fontSize: 15, minWidth: 0 }} />
        <button className="btn gold" onClick={go} disabled={state === "busy"} style={{ fontSize: 14, padding: "0 18px" }}>
          {state === "busy" ? "…" : "JOIN"}
        </button>
      </div>
      {state === "error" && <div className="center muted" style={{ color: "var(--red)", marginTop: 6, fontWeight: 800 }}>That email didn't look right — try again.</div>}
    </div>
  );
}

export default function Win() {
  return (
    <div className="wrap" style={{ paddingBottom: 40 }}>
      <div className="center" style={{ paddingTop: 26 }}>
        <div className="logo disp" style={{ display: "inline-block" }}>THE TEAM SHEET<small>★ THE DAILY FOOTBALL CONNECTIONS GAME ★</small></div>
      </div>

      <div className="center" style={{ margin: "22px 0 6px" }}>
        <div className="disp" style={{ fontSize: "clamp(26px,7vw,40px)", color: "var(--cream)", lineHeight: 1.04, textShadow: "3px 3px 0 var(--red)" }}>
          WIN FOOTBALL TRIPS<br />WITH FOOTBALL KNOWLEDGE
        </div>
        <p className="muted" style={{ color: "var(--line)", maxWidth: 460, margin: "12px auto 0", fontSize: 14 }}>
          The Weekly Cup is coming: a skill competition where the fan with the best
          football brain — not the luckiest ticket — takes the prize. These are the
          planned launch prizes.
        </p>
      </div>

      <div style={{ display: "grid", gap: 12, maxWidth: 460, margin: "18px auto" }}>
        {PRIZES.map((p) => (
          <div key={p.club} className="card paper" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ fontSize: 34 }}>{p.emoji}</div>
            <div>
              <div className="disp" style={{ fontSize: 19, color: "var(--navy)", lineHeight: 1.05 }}>{p.club.toUpperCase()}</div>
              <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: 13.5, marginTop: 3 }}>{p.line}</div>
              <div className="muted" style={{ marginTop: 2 }}>{p.extra}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card paper" style={{ maxWidth: 460, margin: "0 auto", textAlign: "center" }}>
        <div className="disp" style={{ fontSize: 22, color: "var(--navy)" }}>JOIN THE WAITING LIST</div>
        <div className="muted" style={{ margin: "4px 0 12px" }}>First in line when the Weekly Cup opens — plus early-bird perks for the launch list.</div>
        <WaitlistForm source="win-page" />
      </div>

      <div className="center" style={{ marginTop: 16 }}>
        <Link href="/" className="btn cream" style={{ textDecoration: "none", display: "inline-block", padding: "10px 18px", fontSize: 13 }}>⚽ PLAY THE FREE DAILY GAME →</Link>
      </div>

      <p className="muted" style={{ color: "var(--line)", opacity: .75, fontSize: 10.5, textAlign: "center", maxWidth: 460, margin: "18px auto 0", lineHeight: 1.5 }}>
        The Weekly Cup is a skill-based competition and is not yet open — no entries are being
        taken and no payment is required to join the waiting list. Planned prizes shown; final
        prizes, dates and full terms will be confirmed at launch. 18+, UK residents.
        The Team Sheet is not affiliated with or endorsed by any football club; club names are
        used solely to describe prizes.
      </p>
    </div>
  );
}
