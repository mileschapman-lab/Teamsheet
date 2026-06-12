"use client";
// Route error boundary: most common cause in production is a stale tab after a
// deploy (old chunk 404s on navigation). Chunk errors auto-reload once; other
// errors get a branded recovery screen instead of Next's grey banner.
import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    const msg = String(error?.message || "");
    const chunky = /ChunkLoadError|Loading chunk|failed to fetch dynamically imported|import\(\) failed/i.test(msg);
    const k = "teamsheet:autoreload";
    if (chunky && !sessionStorage.getItem(k)) {
      sessionStorage.setItem(k, "1");           // reload once, never loop
      window.location.reload();
    }
  }, [error]);
  return (
    <div className="wrap center" style={{ paddingTop: 60 }}>
      <div style={{ fontSize: 44 }}>🔄</div>
      <div className="disp" style={{ fontSize: 28, color: "var(--cream)", margin: "10px 0 4px", textShadow: "3px 3px 0 var(--red)" }}>NEW VERSION ON THE PITCH</div>
      <p className="muted" style={{ color: "var(--line)", maxWidth: 340, margin: "0 auto" }}>
        The game updated while this tab was open. One tap puts you back on — your progress is saved.
      </p>
      <button className="big" onClick={() => { try { sessionStorage.removeItem("teamsheet:autoreload"); } catch {} window.location.reload(); }}
        style={{ maxWidth: 260, margin: "18px auto 0", background: "var(--gold)", color: "var(--navy)", boxShadow: "3px 3px 0 var(--navy)" }}>
        REFRESH &amp; PLAY ON →
      </button>
      <button className="btn ghost" onClick={reset} style={{ marginTop: 12 }}>try without refreshing</button>
    </div>
  );
}
