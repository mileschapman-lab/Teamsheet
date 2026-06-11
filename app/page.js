// app/page.js
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { PLAYERS, POSNAME, BANK, LEVELS } from "../data/players";
import {
  search, matchdayNumber, dailyPuzzles, checkGuess,
  todayKey, PER_DAY, MAX_GUESSES,
} from "../lib/game";
import {
  computeLives, spendLife, refillToFull, fmtCountdown,
  MAX_LIVES, GUESSES_PER_PUZZLE,
} from "../lib/lives";
import { ECONOMY, valuePerPound } from "../lib/economy";
import { MATCHES, MATCH_NAMES, MATCH_META } from "../data/matches";
import { TRANSFER_BANK, TRANSFER_CLUBS, CLUB_ALIASES } from "../data/transfers";
import { newSeed, challengePuzzles, encodeChallenge, decodeChallenge, verdict, challengeShareText, CHALLENGE_SIZE, POINTS } from "../lib/challenge";

const DIFFC = { easy: "var(--grass)", medium: "var(--gold)", hard: "var(--red)" };

// Flag emoji → ISO code, so we can render real flag images (Windows browsers
// don't render flag emoji — they show letter pairs). flagcdn serves PNGs.
const FLAG_CODE = {
  "🏴": "gb-eng", "🇫🇷": "fr", "🇳🇱": "nl", "🇷🇸": "rs", "🇮🇪": "ie",
  "🇨🇿": "cz", "🇩🇪": "de", "🇪🇸": "es", "🇺🇾": "uy", "🇸🇳": "sn",
  "🇧🇪": "be", "🇦🇷": "ar", "🇨🇮": "ci", "🇪🇬": "eg", "🇫🇮": "fi",
  "🇰🇷": "kr", "🇭🇷": "hr", "🇩🇰": "dk", "🇸🇪": "se", "🇩🇿": "dz", "🇹🇬": "tg",
  "🇦🇺": "au", "🇧🇦": "ba", "🇧🇷": "br", "🇬🇭": "gh", "🇵🇹": "pt",
  "🇳🇴": "no", "🇨🇭": "ch", "🇸🇰": "sk", "🇵🇱": "pl", "🇵🇾": "py", "🇪🇨": "ec",
  "🇺🇦": "ua", "🇯🇵": "jp", "🇮🇹": "it", "🇭🇺": "hu", "🇨🇴": "co", "🇲🇽": "mx",
  "🇮🇸": "is", "🇯🇲": "jm", "🇳🇬": "ng", "🇲🇱": "ml", "🇻🇪": "ve", "🇿🇼": "zw",
  "🇨🇲": "cm", "🇬🇦": "ga", "🇳🇿": "nz", "🇺🇸": "us", "🇬🇧": "gb", "🇹🇹": "tt",
  "🏴󠁧󠁢󠁳󠁣󠁴󠁿": "gb-sct", "🏴󠁧󠁢󠁷󠁬󠁳󠁿": "gb-wls",
};

// Popups render via portal: an animated ancestor's transform otherwise becomes
// the containing block for position:fixed and strands the modal off-screen.
function Overlay({ onClose, children }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="overlay" onClick={onClose}>{children}</div>,
    document.body
  );
}

function Flag({ emoji, size = 30 }) {
  if (!emoji || emoji === "⚽") return null;   // unknown nationality: show nothing, not a placeholder
  const code = FLAG_CODE[emoji];
  if (!code) return <span style={{ fontSize: size * 0.7 }}>{emoji}</span>;
  return (
    <img
      src={`https://flagcdn.com/h40/${code}.png`}
      alt=""
      width={size}
      height={size * 0.67}
      style={{ borderRadius: 3, objectFit: "cover", display: "block" }}
      loading="lazy"
    />
  );
}

// Which shared clubs are shown FREE, by difficulty:
//  easy = all four shown, medium = first two shown, hard = none (buy to reveal).
// Buying the Clubs hint (bought=true) reveals all of them on any difficulty.
function showClub(puzzle, i, bought) {
  if (!puzzle.sharedClubs) return false;
  if (bought) return true;
  if (puzzle.diff === "easy") return true;
  if (puzzle.diff === "medium") return i < 2;
  return false; // hard
}
const LS = "teamsheet:v1"; // localStorage key for the whole profile

function loadProfile() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(LS)) || null; } catch { return null; }
}
function saveProfile(p) {
  try { localStorage.setItem(LS, JSON.stringify(p)); } catch {}
}
const freshProfile = () => ({
  coins: ECONOMY.startingCoins, streak: 0, best: 0, played: 0, lastDay: null,
  collected: 0, seenOnboarding: false,
  day: null, dayResults: [], dayCurrent: 0, dayFinished: false,
  lives: 5, livesAt: Date.now(), levelReached: 0, clearedLevels: [], matchesSolved: [],
  boosters: { freeze: 1, boost: 2 }, lastDailyPopup: null,
});

export default function Page() {
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("daily");
  const [showDailyPopup, setShowDailyPopup] = useState(false);
  const [challenge, setChallenge] = useState(null);   // { seed, opp: {name, result} | null }
  const [invite, setInvite] = useState(null);          // decoded incoming challenge
  useEffect(() => {
    // a challenge link carries everything: ?c=<payload>
    const params = new URLSearchParams(window.location.search);
    const c = params.get("c");
    if (c) {
      const dec = decodeChallenge(c);
      if (dec) setInvite(dec);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  useEffect(() => {
    if (profile && profile.lastDailyPopup !== todayKey()) setShowDailyPopup(true);
  }, []);
  function dismissDailyPopup(play) {
    setShowDailyPopup(false);
    setProfile((pr) => ({ ...pr, lastDailyPopup: todayKey() }));
    if (play) setTab("daily");
  }
  const matchday = useMemo(() => matchdayNumber(), []);
  const puzzles = useMemo(() => dailyPuzzles(matchday), [matchday]);

  // hydrate from localStorage on mount
  useEffect(() => {
    let p = loadProfile() || freshProfile();
    // TESTING ONLY — remove before launch: top up existing profiles so hints,
    // refills and the store can actually be tested. (startingCoins only
    // applies to brand-new profiles.)
    if ((p.coins || 0) < ECONOMY.startingCoins) p = { ...p, coins: ECONOMY.startingCoins };
    const tk = todayKey();
    if (p.day !== tk) { // new day → reset daily progress (keep streak/coins)
      p = { ...p, day: tk, dayResults: [], dayCurrent: 0, dayFinished: false };
    }
    // regenerate any lives earned while away (timestamp-based)
    if (typeof p.lives !== "number") { p.lives = MAX_LIVES; p.livesAt = Date.now(); }
    const lv = computeLives(p.lives, p.livesAt);
    p = { ...p, lives: lv.lives, livesAt: lv.livesAt };
    setProfile(p);
  }, []);

  useEffect(() => { if (profile) saveProfile(profile); }, [profile]);

  if (!profile) return <div className="wrap" style={{ padding: "40px 0", color: "var(--cream)" }}>Loading…</div>;

  // onboarding gate (first visit)
  if (!profile.seenOnboarding) {
    return (
      <div className="wrap">
        <Header profile={profile} />
        <Onboarding onStart={() => setProfile({ ...profile, seenOnboarding: true })} />
      </div>
    );
  }

  return (
    <div className="wrap">
      <Header profile={profile} />
      {invite && (
        <Overlay onClose={() => setInvite(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="center">
              <div style={{ fontSize: 38 }}>⚔️</div>
              <div className="disp" style={{ fontSize: 24 }}>{invite.name} CHALLENGED YOU</div>
              <div className="muted" style={{ marginTop: 6 }}>Same {CHALLENGE_SIZE} puzzles, head to head. Win 3pts · draw 1 · loss 0.</div>
              {!invite.versionOk && <div className="muted" style={{ marginTop: 6, color: "var(--red)" }}>Heads up: different game versions — puzzles may not match exactly.</div>}
            </div>
            <button className="big" onClick={() => { setChallenge({ seed: invite.seed, opp: { name: invite.name, result: invite.result } }); setInvite(null); setTab("competitions"); }} style={{ marginTop: 14, background: "var(--gold)", color: "var(--navy)", boxShadow: "3px 3px 0 var(--navy)" }}>ACCEPT ⚔️</button>
            <button className="big" onClick={() => setInvite(null)} style={{ marginTop: 8, background: "var(--cream)", color: "var(--navy)" }}>NOT NOW</button>
          </div>
        </Overlay>
      )}
      {showDailyPopup && (
        <Overlay onClose={() => dismissDailyPopup(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="center">
              <div style={{ fontSize: 38 }}>📅</div>
              <div className="disp" style={{ fontSize: 26 }}>MATCHDAY {matchday}</div>
              <div className="muted" style={{ marginTop: 4 }}>3 fresh daily puzzles are waiting — keep the streak alive.</div>
              <div style={{ marginTop: 8, fontWeight: 800 }}>🔥 streak: {profile.streak}</div>
            </div>
            <button className="big" onClick={() => dismissDailyPopup(true)} style={{ marginTop: 14, background: "var(--gold)", color: "var(--navy)", boxShadow: "3px 3px 0 var(--navy)" }}>PLAY TODAY'S →</button>
            <button className="big" onClick={() => dismissDailyPopup(false)} style={{ marginTop: 8, background: "var(--cream)", color: "var(--navy)" }}>LATER</button>
          </div>
        </Overlay>
      )}

      <div className="tabs">
        {["daily", "levels", "competitions", "store", "stats"].map((t) => (
          <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === "daily" && <Daily profile={profile} setProfile={setProfile} matchday={matchday} puzzles={puzzles} goStore={() => setTab("store")} />}
      {tab === "levels" && <Levels profile={profile} setProfile={setProfile} goStore={() => setTab("store")} />}
      {tab === "competitions" && <Competitions profile={profile} setProfile={setProfile} challenge={challenge} setChallenge={setChallenge} goStore={() => setTab("store")} />}
      {tab === "store" && <Store profile={profile} setProfile={setProfile} />}
      {tab === "stats" && <Stats profile={profile} />}
    </div>
  );
}

function Header({ profile }) {
  return (
    <div className="hdr">
      <div className="logo disp">THE TEAM SHEET<small>★ THE DAILY FOOTBALL CONNECTIONS GAME ★</small></div>
      <div className="stats">
        <button className="pill lives" onClick={() => setTab("store")} style={{ cursor: "pointer" }}>❤️ {profile.lives}/{MAX_LIVES} <b style={{ color: "var(--grass)" }}>＋</b></button>
        <button className="pill" onClick={() => setTab("store")} style={{ cursor: "pointer" }}><span className="coin" />{profile.coins} <b style={{ color: "var(--grass)" }}>＋</b></button>
        <span className="pill">🔥 {profile.streak}</span>
      </div>
    </div>
  );
}

function Onboarding({ onStart }) {
  return (
    <div className="ob paper">
      <h2>HOW TO PLAY</h2>
      <div className="step"><span className="n">1</span><div className="t"><b>Read the team sheet</b><p>You're shown four real footballers — presented like collectible cards.</p></div></div>
      <div className="step"><span className="n">2</span><div className="t"><b>Name the missing player</b><p>One player was a teammate of all four. Type their name — pick from the list.</p></div></div>
      <div className="step"><span className="n">3</span><div className="t"><b>Any correct link counts</b><p>If more than one player genuinely links all four, any of them is accepted.</p></div></div>
      <div className="step"><span className="n">4</span><div className="t"><b>Come back daily</b><p>Three new puzzles every day. Keep your streak alive and climb the levels.</p></div></div>
      <button className="big" onClick={onStart} style={{ marginTop: 16 }}>START PLAYING →</button>
    </div>
  );
}

// ---- a reusable single-puzzle player -------------------------------------

// Initials clue progression: "S…" -> "R S…" -> "R Sa…" (mononyms just extend)
function initialsHint(fullName, n) {
  if (n <= 0) return "";
  const parts = fullName.trim().split(/\s+/);
  const sur = parts[parts.length - 1], first = parts[0], mono = parts.length === 1;
  const surN = mono ? n : (n === 1 ? 1 : n - 1);
  const f = !mono && n >= 2 ? first[0] + " " : "";
  return `${f}${sur.slice(0, Math.min(surN, sur.length - 1))}…`;
}


// ---- puzzle timer: difficulty-based countdown with freeze/boost boosters ----
function usePuzzleTimer(limitSeconds, active) {
  const [left, setLeft] = useState(limitSeconds);
  const [frozen, setFrozen] = useState(false);
  useEffect(() => {
    if (!active || frozen || left <= 0) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [active, frozen, left <= 0]);
  return { left, setLeft, frozen, setFrozen, expired: left <= 0 };
}
function TimerPill({ left, frozen }) {
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, "0");
  return <span className={`timerpill ${left <= 10 && !frozen ? "low" : ""}`}>{frozen ? "❄️" : "⏱"} {mm}:{ss}</span>;
}
function BoosterButtons({ profile, setProfile, frozen, setFrozen, addTime, goStore, disabled }) {
  const inv = profile.boosters || { freeze: 0, boost: 0 };
  function useFreeze() {
    if (frozen || disabled) return;
    if ((inv.freeze || 0) <= 0) { goStore && goStore(); return; }
    setProfile((pr) => ({ ...pr, boosters: { ...inv, freeze: inv.freeze - 1 } }));
    setFrozen(true);
  }
  function useBoost() {
    if (disabled) return;
    if ((inv.boost || 0) <= 0) { goStore && goStore(); return; }
    setProfile((pr) => ({ ...pr, boosters: { ...inv, boost: inv.boost - 1 } }));
    addTime(ECONOMY.boostSeconds);
  }
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button className="btn cream" onClick={useFreeze} disabled={frozen || disabled} style={{ padding: "4px 9px" }}>❄️ {inv.freeze > 0 ? `×${inv.freeze}` : "＋"}</button>
      <button className="btn cream" onClick={useBoost} disabled={disabled} style={{ padding: "4px 9px" }}>⏱+30 {inv.boost > 0 ? `×${inv.boost}` : "＋"}</button>
    </span>
  );
}

function PuzzleView({ puzzle, profile, setProfile, onResolve, header, maxGuesses = GUESSES_PER_PUZZLE, hideGiveUp = false, goStore, livesMode, revealAnswer = true }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [guesses, setGuesses] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [shake, setShake] = useState(false);
  const [initLetters, setInitLetters] = useState(0);   // surname revealed letter-by-letter
  const [nameClue, setNameClue] = useState(false);
  const [cardClue, setCardClue] = useState(false);
  const [short, setShort] = useState(false);            // not-enough-coins banner
  const [flagBought, setFlagBought] = useState(false);   // hard puzzles: nationality is a paid clue
  const inputRef = useRef(null);

  const ans = PLAYERS[puzzle.answer];
  const sugg = open ? search(query) : [];
  const solved = guesses.some((g) => g.s !== "wrong");
  const finished = solved || revealed;
  const timeLimit = ECONOMY.timeLimits[puzzle.diff] || 75;
  const timer = usePuzzleTimer(timeLimit, !finished);
  useEffect(() => {
    if (timer.expired && !finished) {
      // time up = the puzzle is missed; costs one life in levels
      if (livesMode) {
        const sp = spendLife(profile.lives, profile.livesAt);
        setProfile((pr) => ({ ...pr, lives: sp.lives, livesAt: sp.livesAt }));
      }
      setRevealed(true); onResolve(false, "miss", { wrong: guesses.filter((g) => g.s === "wrong").length, secs: timeLimit });
    }
  }, [timer.expired]);
  const remaining = maxGuesses - guesses.length;

  function submit(id, free) {
    if (!id || finished) return;
    const s = checkGuess(puzzle, id);
    const next = [...guesses, { id, s, free }];
    setGuesses(next); setQuery(""); setOpen(false);
    if (s !== "wrong") {
      onResolve(true, s === "correct_alternate" ? "alt" : "win", { wrong: next.filter((g) => g.s === "wrong").length, secs: timeLimit - timer.left });
      return;
    }
    // in levels, EVERY wrong guess costs a life (daily stays life-free)
    if (livesMode) {
      const sp = spendLife(profile.lives, profile.livesAt);
      setProfile((pr) => ({ ...pr, lives: sp.lives, livesAt: sp.livesAt }));
    }
    if (next.length >= maxGuesses) {
      setRevealed(true); onResolve(false, "miss", { wrong: next.filter((g) => g.s === "wrong").length, secs: timeLimit - timer.left });
    } else { setShake(true); setTimeout(() => setShake(false), 420); }
  }
  const surname = ans[0].split(" ").slice(-1)[0];
  const clueBuys = (cardClue ? 1 : 0) + initLetters + (nameClue ? 1 : 0) + (flagBought ? 1 : 0);
  function pay(cost) {
    if (profile.coins < cost) { setShort(true); setTimeout(() => setShort(false), 4000); return false; }
    setProfile((p) => ({ ...p, coins: p.coins - cost })); return true;
  }
  function buyCard() { if (!cardClue && clueBuys < 3 && pay(ECONOMY.spend.clueClubs)) setCardClue(true); }
  function buyInitial() { if (initLetters < surname.length - 1 && clueBuys < 3 && pay(ECONOMY.spend.clueHint)) setInitLetters(n => n + 1); }
  function buyName() { if (!nameClue && clueBuys < 3 && pay(ECONOMY.spend.clueName)) setNameClue(true); }
  function buyFlag() { if (!flagBought && clueBuys < 3 && pay(ECONOMY.spend.clueFlag)) setFlagBought(true); }
  function buyReveal() { if (!finished && pay(ECONOMY.spend.matchReveal)) submit(puzzle.answer, true); }

  return (
    <div style={{ animation: "pop .3s ease both" }}>
      {header}
      <div className="card paper" style={{ animation: shake ? "shake .42s" : "none" }}>
        <div className="center" style={{ marginBottom: "clamp(6px,1.2vh,14px)" }}>
          <div className="disp" style={{ fontSize: "clamp(17px, 2.6vh, 23px)", color: "var(--navy)" }}>FIND THE MISSING PLAYER</div>
          <div className="muted" style={{ marginTop: 3 }}>One player played with <b style={{ color: "var(--navy)" }}>all four</b>. Who links them?</div>
          {puzzle.era && (
            <div style={{ display: "inline-block", marginTop: 6, fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: "var(--navyDeep)", background: "var(--paperDk)", border: "2px solid var(--line)", borderRadius: 999, padding: "4px 12px" }}>
              ⏱ {puzzle.era}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 6 }}>
            <TimerPill left={timer.left} frozen={timer.frozen} />
            <BoosterButtons profile={profile} setProfile={setProfile} frozen={timer.frozen} setFrozen={timer.setFrozen}
              addTime={(s) => timer.setLeft((v) => v + s)} goStore={goStore} disabled={finished} />
          </div>
        </div>
        {puzzle.clues.map((id, i) => {
          const p = PLAYERS[id];
          return (
            <div className="sticker" key={id} style={{ transform: `rotate(${i % 2 ? 1 : -1}deg)` }}>
              <div className="foil" />
              <div className="srow">
                <span className="snum disp">{i + 1}</span>
                <div className="sflag"><Flag emoji={p[3]} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sname">{p[0]}</div>
                  <div className="spos">{p[4]} · <span style={{ color: "var(--grass)", fontWeight: 800 }}>{p[5]}</span>{showClub(puzzle, i, cardClue) ? ` · played here: ${puzzle.sharedClubs[i]}` : ""}</div>
                </div>
                <span className="stag">{p[2]}</span>
              </div>
            </div>
          );
        })}
        {finished ? (
          (solved || revealAnswer) ? (
          <div className="sticker" style={{ animation: "snap .5s ease both", background: solved ? "var(--gold)" : "var(--cream)" }}>
            <div className="srow">
              <span className="snum disp" style={{ opacity: .4 }}>4</span>
              <div className="sflag"><Flag emoji={ans[3]} /></div>
              <div style={{ flex: 1 }}>
                <div className="sname">{ans[0]}</div>
                <div className="spos" style={{ color: "var(--navyDeep)", fontWeight: 700 }}>{solved ? "GOT IT! ✓" : "the missing player"}</div>
              </div>
            </div>
          </div>
          ) : (
          <div className="sticker" style={{ animation: "snap .5s ease both", background: "var(--cream)", opacity: .92 }}>
            <div className="srow">
              <span className="snum disp" style={{ opacity: .4 }}>4</span>
              <div className="sflag" style={{ display: "grid", placeItems: "center", fontWeight: 900 }}>🔒</div>
              <div style={{ flex: 1 }}>
                <div className="sname">STAYS HIDDEN</div>
                <div className="spos" style={{ color: "var(--navyDeep)", fontWeight: 700 }}>crack it on the retry</div>
              </div>
            </div>
          </div>
          )
        ) : (
          <div className="slot">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              {(puzzle.diff !== "hard" || flagBought) ? (
                <div className="sflag" style={{ width: 44, height: 44 }}><Flag emoji={ans[3]} size={36} /></div>
              ) : (
                <div className="sflag" style={{ width: 44, height: 44, opacity: .45, display: "grid", placeItems: "center", color: "var(--cream)", fontWeight: 800 }}>🏳️</div>
              )}
              <div className="q disp" style={{ fontSize: 24 }}>?</div>
            </div>
            <div className="hint">{ans[4]} · Premier League{puzzle.diff === "easy" ? ` · rated ${ans[5]}` : ""}{initLetters > 0 ? ` · name "${initialsHint(ans[0], initLetters)}"` : ""}{nameClue ? ` · first name ${ans[0].split(" ")[0]}` : ""}</div>
          </div>
        )}
      </div>

      {guesses.length > 0 && (
        <div className="guesses">
          {guesses.map((g, i) => (
            <span key={i} className={`chip ${g.s === "wrong" ? "bad" : "good"}`}>
              {g.s === "wrong" ? "✕" : "✓"} {PLAYERS[g.id][0]}{g.free ? <em style={{ fontStyle: "normal", opacity: .7, fontSize: 11 }}> · revealed</em> : null}
              {g.s === "correct_alternate" && <em style={{ fontStyle: "normal", opacity: .75, fontSize: 11 }}>· also correct!</em>}
            </span>
          ))}
        </div>
      )}

      {finished ? (
        <Outcome solved={solved} alt={solved && guesses[guesses.length - 1].s === "correct_alternate"} ans={ans} />
      ) : (
        <>
          <div className="ibox">
            <input ref={inputRef} value={query} autoComplete="off"
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => { if (e.key === "Enter" && sugg[0]) submit(sugg[0]); }}
              placeholder="Type a player's name…"
              style={{ borderRadius: sugg.length ? "11px 11px 0 0" : 11 }} />
            {sugg.length > 0 && (
              <div className="sugg">
                {sugg.map((id) => (
                  <button key={id} onClick={() => submit(id)}>
                    <span className="n" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Flag emoji={PLAYERS[id][3]} size={20} /> {PLAYERS[id][0]}</span>
                    <span className="m">{PLAYERS[id][1].split(" / ")[0]} · {PLAYERS[id][4]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="toolbar">
            <span className="muted" style={{ color: "var(--cream)" }}>{remaining} guess{remaining !== 1 ? "es" : ""} left</span>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {!hideGiveUp && <button className="btn ghost" onClick={() => { setRevealed(true); onResolve(false, "miss", { wrong: guesses.filter((g) => g.s === "wrong").length, secs: timeLimit - timer.left }); }}>Give up</button>}
              <span className="muted" style={{ fontSize: 10.5, alignSelf: "center", marginRight: 4 }}>CLUES {clueBuys}/3</span>{puzzle.diff !== "easy" && <button className="btn cream" onClick={buyCard} disabled={cardClue || clueBuys >= 3}>{cardClue ? "✓ Clubs" : `🏟️ Reveal other clubs · ${ECONOMY.spend.clueClubs}`}</button>}
              {puzzle.diff === "hard" && <button className="btn cream" onClick={buyFlag} disabled={flagBought || clueBuys >= 3}>{flagBought ? "✓ Nationality" : `🏳️ Nationality · ${ECONOMY.spend.clueFlag}`}</button>}
              <button className="btn gold" onClick={buyInitial} disabled={initLetters >= 3 || clueBuys >= 3}>{initLetters > 0 ? `💡 +1 letter · ${ECONOMY.spend.clueHint}` : `💡 Initial · ${ECONOMY.spend.clueHint}`}</button>
              <button className="btn gold" onClick={buyName} disabled={nameClue || clueBuys >= 3}>{nameClue ? "✓ First name" : `🎯 First name · ${ECONOMY.spend.clueName}`}</button>
              <button className="btn gold" onClick={buyReveal} disabled={finished} style={{ background: "var(--red)", color: "var(--cream)" }}>{`🎯 Reveal answer · ${ECONOMY.spend.matchReveal}`}</button>
              {short && (
                <div style={{ width: "100%", textAlign: "center", marginTop: 6 }}>
                  <span className="muted" style={{ color: "var(--red)", fontWeight: 800 }}>Not enough coins · </span>
                  <button className="btn gold" onClick={goStore}>＋ GET COINS</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Outcome({ solved, alt, ans }) {
  return (
    <div className="outcome" style={{ background: solved ? "var(--gold)" : "var(--cream)" }}>
      <div className="disp" style={{ fontSize: 26, color: "var(--navy)" }}>{solved ? (alt ? "SHARP ONE!" : "PLAYER FOUND!") : "MISSED IT"}</div>
      <div className="muted" style={{ color: solved ? "var(--navyDeep)" : "var(--dim)", marginTop: 5 }}>
        {solved ? (alt ? `Also played with all four. We had ${ans[0]}.` : `${ans[0]} — nice one.`) : revealAnswer ? `The missing player was ${ans[0]}.` : "Not this time — the answer stays hidden. Same questions on retry."}
      </div>
    </div>
  );
}

// ---- DAILY mode ----------------------------------------------------------
function Daily({ profile, setProfile, matchday, puzzles, goStore }) {
  const current = profile.dayCurrent;
  const finishedToday = profile.dayFinished;

  function resolve(solved, kind) {
    const results = [...profile.dayResults, kind];
    const isLast = current + 1 >= PER_DAY;
    if (isLast) {
      // finish matchday: update streak + collection once
      let p = { ...profile, dayResults: results, dayFinished: true };
      const tk = todayKey();
      if (p.lastDay !== tk) {
        const wins = results.filter((r) => r !== "miss").length;
        const y = new Date(); y.setUTCDate(y.getUTCDate() - 1);
        const yKey = [y.getUTCFullYear(), String(y.getUTCMonth() + 1).padStart(2, "0"), String(y.getUTCDate()).padStart(2, "0")].join("-");
        p.streak = p.lastDay === yKey ? p.streak + 1 : 1;
        p.best = Math.max(p.best, p.streak);
        p.collected += wins; p.played += 1; p.lastDay = tk;
        p.coins += ECONOMY.earn.dailyComplete;
      }
      setProfile(p);
    } else {
      setTimeout(() => setProfile({ ...profile, dayResults: results, dayCurrent: current + 1 }), 900);
      setProfile({ ...profile, dayResults: results });
    }
  }

  if (finishedToday) return <DailyDone profile={profile} matchday={matchday} />;

  const puzzle = puzzles[current];
  const header = (
    <>
      <div className="progress">
        {puzzles.map((_, i) => (
          <span key={i} className="pdot" style={{ background: i < current ? "var(--grass)" : i === current ? "var(--cream)" : "var(--line)" }} />
        ))}
      </div>
      <div className="center" style={{ margin: "8px 0 4px" }}>
        <span className="muted" style={{ letterSpacing: ".18em" }}>MATCHDAY {matchday} · PUZZLE {current + 1}/{PER_DAY}
          <span style={{ marginLeft: 8, fontWeight: 800, color: DIFFC[puzzle.diff], textTransform: "uppercase" }}>{puzzle.diff}</span>
        </span>
      </div>
    </>
  );

  return <PuzzleView key={current} puzzle={puzzle} profile={profile} setProfile={setProfile} onResolve={resolve} header={header} goStore={goStore} />;
}

function DailyDone({ profile, matchday }) {
  const [msg, setMsg] = useState("");
  const results = profile.dayResults;
  const wins = results.filter((r) => r !== "miss").length;
  const emoji = results.map((r) => (r === "miss" ? "🟥" : r === "alt" ? "🟦" : "🟩")).join("");
  const share = `THE TEAM SHEET ⚽ Matchday ${matchday}\n${emoji} ${wins}/${PER_DAY}\n🔥 Streak ${profile.streak}`;

  function doShare() {
    if (navigator.share) { navigator.share({ text: share }).catch(() => {}); return; }
    navigator.clipboard?.writeText(share).then(
      () => setMsg("Copied! Paste it anywhere ⚽"),
      () => setMsg(share)
    );
  }

  return (
    <div className="center" style={{ marginTop: 24, animation: "pop .4s ease both" }}>
      <div className="disp" style={{ fontSize: 15, letterSpacing: ".16em", color: "var(--gold)" }}>★ MATCHDAY {matchday} COMPLETE ★</div>
      <div className="disp" style={{ fontSize: 46, color: "var(--cream)", lineHeight: 1, margin: "8px 0", textShadow: "3px 3px 0 var(--red)" }}>{wins}/{PER_DAY}</div>
      <div className="gridres">{results.map((r, i) => <span key={i} style={{ background: r === "miss" ? "var(--red)" : r === "alt" ? "#6aa0d8" : "var(--gold)" }} />)}</div>
      <div style={{ display: "flex", gap: 18, justifyContent: "center", margin: "6px 0 18px" }}>
        <div><div className="disp" style={{ fontSize: 28, color: "var(--cream)" }}>🔥{profile.streak}</div><div className="muted" style={{ color: "var(--line)" }}>streak</div></div>
        <div><div className="disp" style={{ fontSize: 28, color: "var(--cream)" }}>📖{profile.collected}</div><div className="muted" style={{ color: "var(--line)" }}>found</div></div>
        <div><div className="disp" style={{ fontSize: 28, color: "var(--cream)" }}>🏆{profile.best}</div><div className="muted" style={{ color: "var(--line)" }}>best</div></div>
      </div>
      <button className="big" onClick={doShare} style={{ maxWidth: 280, margin: "0 auto", background: "var(--gold)", color: "var(--navy)", boxShadow: "3px 3px 0 var(--navy)" }}>SHARE RESULT</button>
      {msg && <div className="muted" style={{ color: "var(--line)", marginTop: 12, whiteSpace: "pre-line" }}>{msg}</div>}
      <p className="muted" style={{ color: "var(--line)", marginTop: 16, opacity: .8, maxWidth: 330, marginInline: "auto", fontSize: 11 }}>
        Come back tomorrow for a new matchday. Try Practice mode for more puzzles any time.
      </p>
    </div>
  );
}

// ---- LEVELS mode (progression with lives) --------------------------------
function Levels({ profile, setProfile, goStore }) {
  const [activeLevel, setActiveLevel] = useState(null); // index into LEVELS, or null = map

  if (activeLevel === null) {
    return <LevelMap profile={profile} setProfile={setProfile} goStore={goStore} onPlay={(i) => setActiveLevel(i)} />;
  }
  return (
    <LevelRun goStore={goStore}
      key={activeLevel}
      levelIndex={activeLevel}
      profile={profile}
      setProfile={setProfile}
      onExit={() => setActiveLevel(null)}
    />
  );
}

function LevelMap({ profile, setProfile, onPlay, goStore }) {
  const reached = profile.levelReached;
  const [pending, setPending] = useState(null);        // level index awaiting the pre-level popup
  const openRef = useRef(null);
  useEffect(() => { openRef.current?.scrollIntoView({ block: "center", behavior: "instant" }); }, []);
  const inv = profile.boosters || { freeze: 0, boost: 0 };
  return (
    <div style={{ marginTop: 6, animation: "pop .3s ease both" }}>
      <div className="center" style={{ margin: "6px 0 14px" }}>
        <span className="muted" style={{ letterSpacing: ".18em", color: "var(--gold)" }}>LEVELS · {reached}/{LEVELS.length} COMPLETE</span>
      </div>
      {LEVELS.map((lvl, i) => {
        const done = i < reached;
        const open = i === reached;
        const locked = i > reached;
        return (
          <button key={i} ref={open ? openRef : null} disabled={locked} onClick={() => setPending(i)}
            className="card paper" style={{
              display: "block", width: "100%", textAlign: "left", marginBottom: 12,
              opacity: locked ? .5 : 1, cursor: locked ? "default" : "pointer",
              boxShadow: open ? "6px 6px 0 var(--gold)" : "6px 6px 0 var(--red)",
            }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="disp" style={{ fontSize: 22, color: "var(--navy)" }}>{lvl.name}
                  <span style={{ fontSize: 11, verticalAlign: "middle", marginLeft: 8, background: "var(--navy)", color: lvl.type === "match" ? "var(--gold)" : "var(--cream)", borderRadius: 5, padding: "3px 7px", letterSpacing: ".08em" }}>{lvl.type === "match" ? "🏟 MATCH DAY" : lvl.type === "transfer" ? "🔁 TRANSFER" : "⚽ TRAINING"}</span>
                </div>
                <div className="muted" style={{ marginTop: 2 }}>{lvl.theme}</div>
              </div>
              <div className="disp" style={{ fontSize: 30, color: done ? "var(--grass)" : open ? "var(--red)" : "var(--line)" }}>
                {done ? "✓" : open ? "▶" : "🔒"}
              </div>
            </div>
          </button>
        );
      })}
      <p className="muted" style={{ color: "var(--line)", textAlign: "center", fontSize: 11, opacity: .8, marginTop: 6 }}>
        Connection levels: 3 puzzles, 3 guesses each. Match levels: name the fixture's two missing players. Every wrong guess costs a life, and the clock is ticking.
      </p>

      {pending !== null && (
        <Overlay onClose={() => setPending(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="center">
              <div className="disp" style={{ fontSize: 24 }}>{LEVELS[pending].name}{LEVELS[pending].type === "match" ? " 🏟" : ""}</div>
              <div className="muted" style={{ marginTop: 2 }}>{LEVELS[pending].theme}</div>
              <div style={{ marginTop: 8 }}>❤️ {profile.lives}/{MAX_LIVES} · ⏱ {LEVELS[pending].type === "match" ? ECONOMY.timeLimits.match : LEVELS[pending].type === "transfer" ? ECONOMY.timeLimits.transfer : "60-90"}s per puzzle</div>
            </div>
            <div className="boostrow">
              <div><b>❄️ Time Freeze</b> <span className="muted">×{inv.freeze || 0}</span></div>
              <button className="btn gold" onClick={goStore}>{inv.freeze > 0 ? "READY" : "＋"}</button>
            </div>
            <div className="boostrow">
              <div><b>⏱ Time Boost +{ECONOMY.boostSeconds}s</b> <span className="muted">×{inv.boost || 0}</span></div>
              <button className="btn gold" onClick={goStore}>{inv.boost > 0 ? "READY" : "＋"}</button>
            </div>
            <button className="big" onClick={() => { const i = pending; setPending(null); onPlay(i); }} style={{ marginTop: 14, background: "var(--gold)", color: "var(--navy)", boxShadow: "3px 3px 0 var(--navy)" }}>PLAY →</button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function LevelRun({ levelIndex, profile, setProfile, onExit, goStore }) {
  const level = LEVELS[levelIndex];
  const setPuzzles = (level.puzzles || []).map((idx) => BANK[idx]);   // match levels have no puzzles array
  const [step, setStep] = useState(0);     // which puzzle in the set
  const [failed, setFailed] = useState(false);
  const [failedDone, setFailedDone] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [done, setDone] = useState(false);

  // live countdown tick for the out-of-lives screen
  const [, force] = useState(0);
  useEffect(() => {
    if (profile.lives > 0) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [profile.lives]);

  // out of lives → gate
  if (profile.lives <= 0 && !done) {
    const lv = computeLives(profile.lives, profile.livesAt);
    // a life may have regenerated while sitting here
    if (lv.lives > 0 && lv.lives !== profile.lives) {
      setProfile((p) => ({ ...p, lives: lv.lives, livesAt: lv.livesAt }));
    }
    return <OutOfLives profile={profile} setProfile={setProfile} onExit={onExit} msToNext={lv.msToNext} />;
  }

  if (level.type === "match") {
    return <MatchLevel level={level} levelIndex={levelIndex} profile={profile} setProfile={setProfile} onExit={onExit} goStore={goStore} />;
  }
  if (level.type === "transfer") {
    return <TransferLevel level={level} levelIndex={levelIndex} profile={profile} setProfile={setProfile} onExit={onExit} goStore={goStore} />;
  }

  function onResolve(solved) {
    if (solved) {
      const isLast = step + 1 >= setPuzzles.length;
      if (isLast) {
        // let the PLAYER FOUND banner breathe before the level-complete screen
        setTimeout(() => setDone(true), 1600);
        setProfile((p) => {
          const firstTime = !(p.clearedLevels || []).includes(levelIndex);
          const reward = ECONOMY.earn.levelComplete + (firstTime ? ECONOMY.earn.firstClearBonus : 0);
          return {
            ...p,
            coins: p.coins + reward,
            levelReached: Math.max(p.levelReached, levelIndex + 1),
            collected: p.collected + setPuzzles.length,
            clearedLevels: firstTime ? [...(p.clearedLevels || []), levelIndex] : (p.clearedLevels || []),
            lastReward: reward,
          };
        });
      } else {
        setTimeout(() => setStep((s) => s + 1), 900);
      }
    } else {
      // a whiffed puzzle FAILS the level (lives were charged per guess already);
      // let the reveal banner breathe, then the failed screen — retry = same questions
      if (profile.lives <= 0) {
        setFailed(true); // gate shows on next render
      } else {
        setTimeout(() => setFailedDone(true), 1700);
      }
    }
  }

  if (failedDone) {
    return (
      <div className="center" style={{ marginTop: 26, animation: "pop .4s ease both" }}>
        <div className="disp" style={{ fontSize: 15, letterSpacing: ".16em", color: "var(--red)" }}>FULL TIME</div>
        <div className="disp" style={{ fontSize: 34, color: "var(--cream)", margin: "8px 0 4px" }}>{level.name} FAILED</div>
        <div className="muted" style={{ color: "var(--line)" }}>Same questions when you retry — crack them this time.</div>
        <button className="big" onClick={() => { setStep(0); setFailedDone(false); setAttempt((a) => a + 1); }} style={{ maxWidth: 280, margin: "16px auto 0", background: "var(--gold)", color: "var(--navy)", boxShadow: "3px 3px 0 var(--navy)" }}>↻ RETRY LEVEL</button>
        <button className="big" onClick={onExit} style={{ maxWidth: 280, margin: "10px auto 0", background: "var(--cream)", color: "var(--navy)" }}>BACK TO LEVELS</button>
      </div>
    );
  }

  if (done) {
    const cleared = profile.levelReached > levelIndex;
    return <LevelComplete level={level} cleared={cleared} onExit={onExit} profile={profile} setProfile={setProfile} />;
  }

  const puzzle = setPuzzles[step];
  const header = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 0 8px" }}>
        <button className="btn ghost" onClick={onExit}>← Pages</button>
        <span className="muted" style={{ color: "var(--cream)" }}>{"❤️".repeat(profile.lives)}</span>
      </div>
      <div className="progress">
        {setPuzzles.map((_, i) => (
          <span key={i} className="pdot" style={{ background: i < step ? "var(--grass)" : i === step ? "var(--cream)" : "var(--line)" }} />
        ))}
      </div>
      <div className="center" style={{ margin: "8px 0 4px" }}>
        <span className="muted" style={{ letterSpacing: ".16em" }}>{level.name} · {step + 1}/{setPuzzles.length}
          <span style={{ marginLeft: 8, fontWeight: 800, color: DIFFC[puzzle.diff], textTransform: "uppercase" }}>{puzzle.diff}</span>
        </span>
      </div>
    </>
  );

  return (
    <PuzzleView key={`${attempt}-${step}`} puzzle={puzzle} profile={profile} setProfile={setProfile} goStore={goStore} revealAnswer={false} livesMode
      onResolve={(solved) => onResolve(solved)} header={header} maxGuesses={GUESSES_PER_PUZZLE} hideGiveUp />
  );
}


// ---- MATCH LEVEL: real fixture, name the missing two; 3 misses = 1 life ----

// ---- TRANSFER WINDOW levels: real deals, name the buying club -------------
function clubNorm(q) {
  return q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}
function clubSearch(q) {
  const n = clubNorm(q);
  if (!n) return [];
  if (CLUB_ALIASES[n]) return [CLUB_ALIASES[n], ...TRANSFER_CLUBS.filter(c => clubNorm(c).includes(n) && c !== CLUB_ALIASES[n])].slice(0, 6);
  return TRANSFER_CLUBS.filter(c => clubNorm(c).includes(n)).slice(0, 6);
}
function TransferLevel({ level, levelIndex, profile, setProfile, onExit, goStore }) {
  const qs = level.qs.map(i => TRANSFER_BANK[i]);
  const [step, setStep] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [done, setDone] = useState(false);
  const [failedDone, setFailedDone] = useState(false);
  if (done) return <LevelComplete level={level} cleared onExit={onExit} profile={profile} setProfile={setProfile} />;
  if (failedDone) return (
    <div className="center" style={{ marginTop: 26, animation: "pop .4s ease both" }}>
      <div className="disp" style={{ fontSize: 15, letterSpacing: ".16em", color: "var(--red)" }}>WINDOW SLAMMED SHUT</div>
      <div className="disp" style={{ fontSize: 34, color: "var(--cream)", margin: "8px 0 4px" }}>{level.name} FAILED</div>
      <div className="muted" style={{ color: "var(--line)" }}>Same deals when you retry — the destination stays hidden.</div>
      <button className="big" onClick={() => { setStep(0); setFailedDone(false); setAttempt(a => a + 1); }} style={{ maxWidth: 280, margin: "16px auto 0", background: "var(--gold)", color: "var(--navy)", boxShadow: "3px 3px 0 var(--navy)" }}>↻ RETRY LEVEL</button>
      <button className="big" onClick={onExit} style={{ maxWidth: 280, margin: "10px auto 0", background: "var(--cream)", color: "var(--navy)" }}>BACK TO LEVELS</button>
    </div>
  );
  function advance(won) {
    if (!won) { setTimeout(() => setFailedDone(true), 1500); return; }
    const isLast = step + 1 >= qs.length;
    if (isLast) {
      setProfile(pr => {
        const firstTime = !(pr.clearedLevels || []).includes(levelIndex);
        const reward = ECONOMY.earn.levelComplete + (firstTime ? ECONOMY.earn.firstClearBonus : 0);
        return { ...pr, coins: pr.coins + reward, levelReached: Math.max(pr.levelReached, levelIndex + 1),
          collected: pr.collected + qs.length,
          clearedLevels: firstTime ? [...(pr.clearedLevels || []), levelIndex] : (pr.clearedLevels || []), lastReward: reward };
      });
      setTimeout(() => setDone(true), 1500);
    } else setTimeout(() => setStep(s2 => s2 + 1), 1500);
  }
  return <TransferQ key={`${attempt}-${step}`} q={qs[step]} step={step} total={qs.length}
    profile={profile} setProfile={setProfile} onDone={advance} onExit={onExit} goStore={goStore} />;
}
function TransferQ({ q, step, total, profile, setProfile, onDone, onExit, goStore }) {
  const [query, setQuery] = useState("");
  const [guesses, setGuesses] = useState([]);
  const [outcome, setOutcome] = useState(null);   // "win" | "miss"
  const [shake, setShake] = useState(false);
  const [short, setShort] = useState(false);
  const [initBought, setInitBought] = useState(false);
  const timer = usePuzzleTimer(ECONOMY.timeLimits.transfer, !outcome);
  useEffect(() => {
    if (timer.expired && !outcome) {
      const s = spendLife(profile.lives, profile.livesAt);
      setProfile(pr => ({ ...pr, lives: s.lives, livesAt: s.livesAt }));
      setOutcome("miss"); onDone(false);
    }
  }, [timer.expired]);
  const sugg = clubSearch(query);
  function submit(club) {
    if (!club || outcome) return;
    setQuery("");
    if (clubNorm(club) === clubNorm(q.to)) {
      setGuesses(g => [...g, { n: club, ok: true }]);
      setOutcome("win"); onDone(true);
      return;
    }
    setGuesses(g => [...g, { n: club, ok: false }]);
    const s = spendLife(profile.lives, profile.livesAt);
    setProfile(pr => ({ ...pr, lives: s.lives, livesAt: s.livesAt }));
    setShake(true); setTimeout(() => setShake(false), 420);
    if (guesses.filter(g => !g.ok).length + 1 >= 3) { setOutcome("miss"); onDone(false); }
  }
  function buyInit() {
    if (initBought) return;
    if (profile.coins < ECONOMY.spend.clueHint) { setShort(true); setTimeout(() => setShort(false), 4000); return; }
    setProfile(pr => ({ ...pr, coins: pr.coins - ECONOMY.spend.clueHint })); setInitBought(true);
  }
  return (
    <div style={{ animation: "pop .3s ease both" }}>
      <div className="center" style={{ marginBottom: 8 }}>
        <button className="btn ghost" onClick={onExit} style={{ float: "left" }}>← Levels</button>
        <span className="muted" style={{ letterSpacing: ".18em" }}>🔁 TRANSFER WINDOW · {step + 1}/{total}</span>
        <span style={{ float: "right", display: "inline-flex", alignItems: "center", gap: 8 }}>
          <TimerPill left={timer.left} frozen={timer.frozen} />
          <span className="muted" style={{ color: "var(--cream)" }}>{"❤️".repeat(profile.lives)}</span>
        </span>
      </div>
      <div className="card paper" style={{ animation: shake ? "shake .42s" : "none", textAlign: "center" }}>
        <div className="muted">REAL DEAL · {q.win}</div>
        <div style={{ margin: "10px 0 4px", display: "flex", justifyContent: "center" }}><Flag emoji={q.flag} size={34} /></div>
        <div className="disp" style={{ fontSize: "clamp(20px,3vh,28px)", color: "var(--navy)" }}>{q.p}</div>
        <div className="muted" style={{ marginTop: 6 }}>left <b style={{ color: "var(--navy)" }}>{q.from}</b> in {q.win}…</div>
        <div className="disp" style={{ fontSize: "clamp(15px,2.2vh,19px)", marginTop: 10, color: "var(--red)" }}>WHERE DID HE GO?</div>
        {initBought && !outcome && <div className="muted" style={{ marginTop: 6 }}>destination starts "{q.to[0]}…"</div>}
        {outcome && (
          <div style={{ marginTop: 10, animation: "snap .4s ease both", fontWeight: 800, color: outcome === "win" ? "var(--grass)" : "var(--red)" }}>
            {outcome === "win" ? `✓ ${q.to} · ${q.fee}` : "✕ Deal stays under wraps — retry the level."}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 7, justifyContent: "center", margin: "8px 0 2px" }}>
        <button className="btn gold" onClick={buyInit} disabled={initBought || !!outcome}>{initBought ? "✓ Initial" : `💡 Initial · ${ECONOMY.spend.clueHint}`}</button>
        <BoosterButtons profile={profile} setProfile={setProfile} frozen={timer.frozen} setFrozen={timer.setFrozen}
          addTime={(s) => timer.setLeft(v => v + s)} goStore={goStore} disabled={!!outcome} />
      </div>
      {short && (
        <div className="center" style={{ marginTop: 4 }}>
          <span className="muted" style={{ color: "var(--red)", fontWeight: 800 }}>Not enough coins · </span>
          <button className="btn gold" onClick={goStore}>＋ GET COINS</button>
        </div>
      )}
      <div className="ibox">
        <input value={query} autoComplete="off" onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && sugg[0]) submit(sugg[0]); }}
          placeholder="Name the buying club…" disabled={!!outcome} />
        {sugg.length > 0 && !outcome && (
          <div className="sugg">{sugg.map(c => <button key={c} onClick={() => submit(c)}><span className="n">{c}</span></button>)}</div>
        )}
      </div>
      <div className="center" style={{ marginTop: 6 }}>
        <span className="muted" style={{ color: profile.lives <= 1 ? "var(--red)" : "var(--cream)", fontWeight: 800 }}>every wrong guess costs ❤️ · {profile.lives} left</span>
      </div>
      {guesses.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
          {guesses.map((g, i) => <span key={i} className={`chip ${g.ok ? "good" : "bad"}`}>{g.ok ? "✓" : "✕"} {g.n}</span>)}
        </div>
      )}
    </div>
  );
}

const POS_ORDER = { GK: 0, LB: 1, LWB: 2, CB: 3, DEF: 4, RB: 5, RWB: 6, CDM: 7, CM: 8, MID: 9, LM: 10, RM: 11, CAM: 12, LW: 13, RW: 14, SS: 15, FWD: 16, ST: 17 };

function MatchLevel({ level, levelIndex, profile, setProfile, onExit, goStore }) {
  const m = MATCHES[level.match];
  const lineup = [...m.lineup].sort((a, b) => (POS_ORDER[a.pos] ?? 9) - (POS_ORDER[b.pos] ?? 9));
  const blanks = m.lineup.filter(p => p.missing);
  const [found, setFound] = useState([]);
  const [query, setQuery] = useState("");
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  const [flagClue, setFlagClue] = useState(false);
  const [initLetters, setInitLetters] = useState(0);
  const [revealUsed, setRevealUsed] = useState(false);
  const [short, setShort] = useState(false);
  const [guessLog, setGuessLog] = useState([]);
  const [timedOut, setTimedOut] = useState(false);
  const solvedAll = found.length >= blanks.length;
  const timer = usePuzzleTimer(ECONOMY.timeLimits.match, !solvedAll && !done && !timedOut);
  useEffect(() => {
    if (timer.expired && !solvedAll && !timedOut) {
      const s = spendLife(profile.lives, profile.livesAt);
      setProfile(pr => ({ ...pr, lives: s.lives, livesAt: s.livesAt }));
      setTimedOut(true);
    }
  }, [timer.expired]);
  const clueBuys = (flagClue ? 1 : 0) + initLetters;
  function pay(cost) {
    if (profile.coins < cost) { setShort(true); setTimeout(() => setShort(false), 4000); return false; }
    setProfile(p => ({ ...p, coins: p.coins - cost })); return true;
  }
  function buyFlagClue() { if (!flagClue && clueBuys < 3 && pay(ECONOMY.spend.matchFlag)) setFlagClue(true); }
  function buyInitClue() { if (clueBuys < 3 && pay(ECONOMY.spend.matchInitial)) setInitLetters(n => n + 1); }
  function buyReveal() {
    if (revealUsed) return;
    const next = blanks.find(b => !found.includes(matchNorm(b.name)));
    if (!next) return;
    if (!pay(ECONOMY.spend.matchReveal)) return;
    setRevealUsed(true);
    submitName(next.name, true);
  }

  function submitName(name, free) {
    if (!name || done) return;
    const g = matchNorm(name);
    setQuery("");
    if (found.includes(g)) return;
    const hit = blanks.find(b => matchNorm(b.name) === g);
    if (hit) {
      const nf = [...found, g];
      setFound(nf);
      setGuessLog(l => [...l, { n: hit.name, ok: true, free }]);
      if (nf.length >= blanks.length) {
        // stay on the board so the final name is SEEN; CONTINUE advances
        setProfile(p => {
          const firstTime = !(p.clearedLevels || []).includes(levelIndex);
          const reward = ECONOMY.earn.levelComplete + (firstTime ? ECONOMY.earn.firstClearBonus : 0);
          return { ...p, coins: p.coins + reward,
            levelReached: Math.max(p.levelReached, levelIndex + 1),
            collected: p.collected + blanks.length,
            clearedLevels: firstTime ? [...(p.clearedLevels || []), levelIndex] : (p.clearedLevels || []),
            lastReward: reward };
        });
      }
    } else {
      setGuessLog(l => [...l, { n: name, ok: false }]);
      setShake(true); setTimeout(() => setShake(false), 420);
      const s = spendLife(profile.lives, profile.livesAt);
      setProfile(p => ({ ...p, lives: s.lives, livesAt: s.livesAt }));
      // lives<=0 → parent LevelRun shows the OutOfLives gate on re-render
    }
  }
  const sugg = query ? matchSearch(query) : [];

  if (timedOut) return (
    <div className="center" style={{ marginTop: 26, animation: "pop .4s ease both" }}>
      <div className="disp" style={{ fontSize: 15, letterSpacing: ".16em", color: "var(--red)" }}>FULL TIME</div>
      <div className="disp" style={{ fontSize: 34, color: "var(--cream)", margin: "8px 0 4px" }}>OUT OF TIME</div>
      <div className="muted" style={{ color: "var(--line)" }}>The missing two stay hidden — run it back.</div>
      <button className="big" onClick={onExit} style={{ maxWidth: 280, margin: "16px auto 0", background: "var(--gold)", color: "var(--navy)", boxShadow: "3px 3px 0 var(--navy)" }}>BACK TO LEVELS →</button>
    </div>
  );

  if (done) return <LevelComplete level={level} cleared onExit={onExit} profile={profile} setProfile={setProfile} />;

  return (
    <div style={{ animation: "pop .3s ease both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 0 8px" }}>
        <button className="btn ghost" onClick={onExit}>← Levels</button>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <TimerPill left={timer.left} frozen={timer.frozen} />
          <BoosterButtons profile={profile} setProfile={setProfile} frozen={timer.frozen} setFrozen={timer.setFrozen}
            addTime={(s) => timer.setLeft((v) => v + s)} goStore={goStore} disabled={solvedAll || timedOut} />
          <span className="muted" style={{ color: "var(--cream)" }}>{"❤️".repeat(profile.lives)}</span>
        </span>
      </div>
      <div className="center" style={{ margin: "0 0 6px" }}>
        <span className="muted" style={{ letterSpacing: ".16em" }}>{level.name} · REAL FIXTURE
          <span style={{ marginLeft: 8, fontWeight: 800, color: "var(--gold)" }}>{m.season} GW{m.gw}</span>
        </span>
      </div>
      <div className="card paper" style={{ animation: shake ? "shake .42s" : "none" }}>
        <div className="center">
          <div className="disp" style={{ fontSize: 22, color: "var(--navy)" }}>{m.home} {m.score} {m.away}</div>
          <div className="muted" style={{ fontSize: 11, letterSpacing: ".1em", marginTop: 2 }}>{m.featured} XI — name the missing two</div>
        </div>
        <div style={{ marginTop: 13, display: "grid", gap: 6 }}>
          {lineup.map((p, i) => {
            const isFound = p.missing && found.includes(matchNorm(p.name));
            const show = !p.missing || isFound;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", border: "2px solid var(--navy)", borderRadius: 9, background: p.missing ? "var(--gold)" : "var(--cream)", borderStyle: p.missing && !isFound ? "dashed" : "solid" }}>
                <span className="disp" style={{ fontSize: 11, color: "var(--navy)", background: "var(--paperDk)", border: "1.5px solid var(--line)", borderRadius: 5, padding: "2px 6px", minWidth: 38, textAlign: "center" }}>{p.pos}</span>
                {show && <Flag emoji={p.flag} size={18} />}
                {!show && flagClue && <Flag emoji={p.flag} size={18} />}
                <span style={{ fontWeight: show ? 700 : 800, fontSize: "clamp(11.5px,1.6vh,13.5px)", color: "var(--navy)", flex: 1 }}>
                  {show ? p.name : (initLetters > 0 ? `❓ "${initialsHint(p.name, initLetters)}"` : "❓ who's missing?")}{isFound ? " ✓" : ""}
                  {show && <span style={{ marginLeft: 6, color: "var(--grass)", fontWeight: 800, fontSize: 12 }}>{p.rating}</span>}
                </span>
                <span style={{ fontSize: 12.5 }}>{show ? evIcons(p.events) : (evIcons(p.events) ? "👀 " + evIcons(p.events) : "")}</span>
              </div>
            );
          })}
        </div>
        <p className="muted" style={{ fontSize: 10.5, marginTop: 10, textAlign: "center" }}>⚽ scored · 🅰️ assisted · 🟨🟥 booked — 👀 events belong to a missing player · every wrong guess costs a ❤️</p>
      </div>
      {solvedAll ? (
        <div className="center" style={{ marginTop: 12, animation: "pop .35s ease both" }}>
          <div className="disp" style={{ fontSize: 17, letterSpacing: ".14em", color: "var(--gold)" }}>★ FULL TEAM SHEET ★</div>
          <button className="big" onClick={() => setDone(true)} style={{ maxWidth: 280, margin: "10px auto 0", background: "var(--gold)", color: "var(--navy)", boxShadow: "3px 3px 0 var(--navy)" }}>CONTINUE →</button>
        </div>
      ) : (<>
      <div style={{ display: "flex", gap: 7, justifyContent: "center", flexWrap: "wrap", margin: "10px 0 2px" }}>
        <span className="muted" style={{ fontSize: 10.5, alignSelf: "center", color: "var(--line)" }}>CLUES {clueBuys}/3</span>
        <button className="btn cream" onClick={buyFlagClue} disabled={flagClue || clueBuys >= 3}>{flagClue ? "✓ Flags" : `🏳️ Flags · ${ECONOMY.spend.matchFlag}`}</button>
        <button className="btn gold" onClick={buyInitClue} disabled={clueBuys >= 3}>{initLetters > 0 ? `💡 +1 letter · ${ECONOMY.spend.matchInitial}` : `💡 Initials · ${ECONOMY.spend.matchInitial}`}</button>
        <button className="btn gold" onClick={buyReveal} disabled={revealUsed || solvedAll} style={{ background: "var(--red)", color: "var(--cream)" }}>{revealUsed ? "✓ Revealed" : `🎯 Reveal one · ${ECONOMY.spend.matchReveal}`}</button>
      </div>
      {short && (
        <div className="center" style={{ marginTop: 6 }}>
          <span className="muted" style={{ color: "var(--red)", fontWeight: 800 }}>Not enough coins · </span>
          <button className="btn gold" onClick={goStore}>＋ GET COINS</button>
        </div>
      )}
      <div className="ibox">
        <input value={query} autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && sugg[0]) submitName(sugg[0]); }}
          placeholder={`Name ${m.featured}'s missing players…`}
          style={{ borderRadius: sugg.length ? "11px 11px 0 0" : 11 }} />
        {sugg.length > 0 && (
          <div className="sugg">
            {sugg.map(n => {
              const meta = MATCH_META[n] || {};
              return (
                <button key={n} onClick={() => submitName(n)}>
                  <span className="n" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                    {meta.flag ? <Flag emoji={meta.flag} size={18} /> : null} {n}
                  </span>
                  {(meta.pos || meta.rating) ? <span className="m">{meta.pos}{meta.rating ? ` · ${meta.rating}` : ""}</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
      </>)}
      {!solvedAll && (
        <div className="center" style={{ marginTop: 8 }}>
          <span className="muted" style={{ color: profile.lives <= 1 ? "var(--red)" : "var(--cream)", fontWeight: 800 }}>
            every wrong guess costs ❤️ · {profile.lives} left
          </span>
        </div>
      )}
      {guessLog.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
          {guessLog.map((g, i) => (
            <span key={i} className={`chip ${g.ok ? "good" : "bad"}`}>{g.ok ? "✓" : "✕"} {g.n}{g.free ? " · revealed" : ""}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function LevelComplete({ level, cleared, onExit, profile, setProfile }) {
  const [doubled, setDoubled] = useState(false);
  const reward = profile.lastReward || ECONOMY.earn.levelComplete;
  function watchAdDouble() {
    // placeholder: real rewarded-ad SDK later. Doubles this level's reward.
    if (doubled) return;
    setProfile((p) => ({ ...p, coins: p.coins + reward }));
    setDoubled(true);
  }
  return (
    <div className="center" style={{ marginTop: 24, animation: "pop .4s ease both" }}>
      <div className="disp" style={{ fontSize: 15, letterSpacing: ".16em", color: "var(--gold)" }}>★ {level.name} COMPLETE ★</div>
      <div className="disp" style={{ fontSize: 56, color: "var(--gold)", lineHeight: 1, margin: "10px 0 2px", textShadow: "3px 3px 0 var(--red)" }}>+{doubled ? reward * 2 : reward}</div>
      <div className="muted" style={{ color: "var(--line)" }}>coins earned</div>
      {!doubled && (
        <button className="big" onClick={watchAdDouble} style={{ maxWidth: 280, margin: "16px auto 0", background: "var(--grass)", color: "var(--cream)", boxShadow: "3px 3px 0 var(--navy)" }}>▶ WATCH AD — DOUBLE TO {reward * 2}</button>
      )}
      <button className="big" onClick={onExit} style={{ maxWidth: 280, margin: "10px auto 0", background: "var(--gold)", color: "var(--navy)", boxShadow: "3px 3px 0 var(--navy)" }}>CONTINUE →</button>
    </div>
  );
}

function OutOfLives({ profile, setProfile, onExit, msToNext }) {
  function refillPaid() {
    // paid refill placeholder — costs coins for now; real money via Stripe later
    if (profile.coins >= ECONOMY.spend.refillAllLives) {
      const r = refillToFull();
      setProfile((p) => ({ ...p, coins: p.coins - ECONOMY.spend.refillAllLives, lives: r.lives, livesAt: r.livesAt }));
    }
  }
  function refillAd() {
    // watch-an-ad placeholder → grants one life. Real ad SDK later.
    setProfile((p) => {
      const s = computeLives(p.lives, p.livesAt);
      return { ...p, lives: Math.min(MAX_LIVES, Math.max(s.lives, 0) + 1), livesAt: p.lives >= MAX_LIVES ? Date.now() : p.livesAt };
    });
  }
  return (
    <div className="center" style={{ marginTop: 24, animation: "pop .4s ease both" }}>
      <div className="disp" style={{ fontSize: 40, color: "var(--cream)" }}>🖤</div>
      <div className="disp" style={{ fontSize: 26, color: "var(--cream)", marginTop: 4 }}>OUT OF LIVES</div>
      <div className="muted" style={{ color: "var(--line)", marginTop: 6 }}>Next life in <b style={{ color: "var(--cream)" }}>{fmtCountdown(msToNext)}</b></div>
      <div className="card paper" style={{ marginTop: 18, textAlign: "left" }}>
        <button className="big" onClick={refillAd} style={{ background: "var(--grass)", color: "var(--cream)", boxShadow: "3px 3px 0 var(--navy)" }}>▶ WATCH AD FOR A LIFE</button>
        <button className="big" onClick={refillPaid} disabled={profile.coins < ECONOMY.spend.refillAllLives} style={{ background: profile.coins < ECONOMY.spend.refillAllLives ? "var(--line)" : "var(--gold)", color: "var(--navy)", boxShadow: profile.coins < ECONOMY.spend.refillAllLives ? "none" : "3px 3px 0 var(--navy)", marginTop: 10 }}>♥ REFILL ALL · {ECONOMY.spend.refillAllLives} COINS</button>
        <p className="muted" style={{ marginTop: 12, fontSize: 11, textAlign: "center" }}>
          Demo: ad and coin refill are placeholders. Real ads & payments come in the server phase. Pro members get unlimited lives.
        </p>
      </div>
      <button className="btn ghost" onClick={onExit} style={{ marginTop: 16 }}>← Back to pages</button>
    </div>
  );
}


// ---- STORE (coin bundles + Pro). Real money plugs in via Stripe later. ----
function Store({ profile, setProfile }) {
  const [msg, setMsg] = useState("");
  function buyBundle(b) {
    // PLACEHOLDER: in production this opens Stripe checkout. For testing, it
    // simply grants the coins so the economy can be felt end-to-end.
    setProfile((p) => ({ ...p, coins: p.coins + b.coins }));
    setMsg(`(Demo) ${b.name} added ${b.coins.toLocaleString()} coins. Real payment via Stripe comes in the server phase.`);
  }
  function buyBooster(kind, cost) {
    if (profile.coins < cost) { setMsg("Not enough coins — grab a bundle below."); return; }
    setProfile((pr) => ({ ...pr, coins: pr.coins - cost, boosters: { freeze: 0, boost: 0, ...(pr.boosters || {}), [kind]: ((pr.boosters || {})[kind] || 0) + 1 } }));
    setMsg(kind === "freeze" ? "❄️ Time Freeze added to your kit." : "⏱ +30s Time Boost added to your kit.");
  }
  function buyHealth() {
    if (profile.lives >= MAX_LIVES) { setMsg("Lives already full."); return; }
    if (profile.coins < ECONOMY.spend.refillAllLives) { setMsg("Not enough coins — grab a bundle below."); return; }
    const r = refillToFull();
    setProfile((p) => ({ ...p, coins: p.coins - ECONOMY.spend.refillAllLives, lives: r.lives, livesAt: r.livesAt }));
    setMsg("❤️ Health boost — lives refilled!");
  }
  return (
    <div>
    <div className="card paper" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <div>
        <div className="disp" style={{ fontSize: 20, color: "var(--navy)" }}>❤️ HEALTH BOOST</div>
        <div className="muted" style={{ marginTop: 2 }}>Refill all lives instantly · {profile.lives}/{MAX_LIVES} now</div>
      </div>
      <button className="btn gold" onClick={buyHealth} disabled={profile.lives >= MAX_LIVES}>{profile.lives >= MAX_LIVES ? "FULL" : `REFILL · ${ECONOMY.spend.refillAllLives}`}</button>
    </div>
    <div className="card paper" style={{ marginBottom: 14 }}>
      <div className="disp" style={{ fontSize: 20, color: "var(--navy)" }}>⚡ BOOSTERS</div>
      <div className="boostrow">
        <div><b>❄️ Time Freeze</b> <span className="muted">stops the clock · ×{(profile.boosters || {}).freeze || 0} owned</span></div>
        <button className="btn gold" onClick={() => buyBooster("freeze", ECONOMY.spend.boosterFreeze)}>{ECONOMY.spend.boosterFreeze}</button>
      </div>
      <div className="boostrow">
        <div><b>⏱ Time Boost</b> <span className="muted">+{ECONOMY.boostSeconds} seconds · ×{(profile.boosters || {}).boost || 0} owned</span></div>
        <button className="btn gold" onClick={() => buyBooster("boost", ECONOMY.spend.boosterTime)}>{ECONOMY.spend.boosterTime}</button>
      </div>
    </div>
    <div style={{ marginTop: 6, animation: "pop .3s ease both" }}>
      <div className="center" style={{ margin: "6px 0 14px" }}>
        <span className="muted" style={{ letterSpacing: ".18em", color: "var(--gold)" }}>THE CLUB SHOP</span>
      </div>

      {ECONOMY.bundles.map((b) => (
        <button key={b.id} className="card paper" onClick={() => buyBundle(b)}
          style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", textAlign: "left", marginBottom: 12, cursor: "pointer", boxShadow: b.tag === "BEST VALUE" ? "6px 6px 0 var(--gold)" : "6px 6px 0 var(--red)" }}>
          <div>
            <div className="disp" style={{ fontSize: 21, color: "var(--navy)" }}>{b.name}</div>
            <div className="muted" style={{ marginTop: 2 }}>{b.coins.toLocaleString()} coins · {valuePerPound(b)}/£</div>
            {b.tag && <span style={{ display: "inline-block", marginTop: 6, fontSize: 10, fontWeight: 800, letterSpacing: ".1em", color: "var(--navyDeep)", background: "var(--gold)", border: "2px solid var(--navy)", borderRadius: 5, padding: "2px 7px" }}>{b.tag}</span>}
          </div>
          <div className="disp" style={{ fontSize: 22, color: "var(--red)" }}>{b.price}</div>
        </button>
      ))}

      <div className="card paper" style={{ marginTop: 4, boxShadow: "6px 6px 0 var(--navy)", border: "3px solid var(--gold)" }}>
        <div className="disp" style={{ fontSize: 22, color: "var(--navy)" }}>{ECONOMY.pro.name} <span style={{ color: "var(--red)" }}>· {ECONOMY.pro.price}</span></div>
        <div style={{ marginTop: 8 }}>
          {ECONOMY.pro.perks.map((perk) => (
            <div key={perk} className="muted" style={{ color: "var(--navy)", fontWeight: 700, padding: "2px 0" }}>✓ {perk}</div>
          ))}
        </div>
        <button className="big" onClick={() => setMsg("(Demo) Pro subscription is set up via the app store / Stripe in the server phase.")} style={{ marginTop: 12, background: "var(--navy)" }}>GO PRO</button>
      </div>

      {msg && <p className="muted" style={{ color: "var(--line)", textAlign: "center", marginTop: 14, fontSize: 12 }}>{msg}</p>}
      <p className="muted" style={{ color: "var(--line)", textAlign: "center", marginTop: 10, fontSize: 11, opacity: .75 }}>
        Prices &amp; coin amounts are starting values, tuned from real play. Real payments are not yet live — these buttons grant coins so the economy can be tested.
      </p>
    </div>
  </div>
  );
}


// ---- MATCH MODE: real fixtures, name the missing players -------------------
const matchNorm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function matchSearch(q) {
  q = matchNorm(q.trim());
  if (q.length < 2) return [];
  const hits = [];
  for (const n of MATCH_NAMES) {
    const nn = matchNorm(n); const parts = nn.split(" ");
    let s = -1;
    if (nn.startsWith(q)) s = 3;
    else if (parts[parts.length - 1].startsWith(q)) s = 2;
    else if (nn.includes(q)) s = 1;
    if (s >= 0) hits.push({ n, s });
  }
  hits.sort((a, b) => b.s - a.s);
  return hits.slice(0, 6).map(h => h.n);
}
function evIcons(e) {
  let out = "";
  out += "⚽".repeat(e.g || 0);
  out += "🅰️".repeat(e.a || 0);
  if (e.y) out += "🟨";
  if (e.red) out += "🟥";
  return out;
}

function ChallengeRun({ seed, opp, profile, setProfile, goStore, onExit, onFinished }) {
  const puzzles = useMemo(() => challengePuzzles(seed), [seed]);
  const [step, setStep] = useState(0);
  const [stats, setStats] = useState({ solved: 0, wrong: 0, secs: 0 });
  const [done, setDone] = useState(false);
  function resolve(solved, kind, s) {
    const next = { solved: stats.solved + (solved ? 1 : 0), wrong: stats.wrong + ((s && s.wrong) || 0), secs: stats.secs + ((s && s.secs) || 0) };
    setStats(next);
    const isLast = step + 1 >= CHALLENGE_SIZE;
    setTimeout(() => { if (isLast) { setDone(true); onFinished(next); } else setStep(x => x + 1); }, 1400);
  }
  if (done) return null;
  const header = (
    <div className="center" style={{ marginBottom: 10 }}>
      <button className="btn ghost" onClick={onExit} style={{ float: "left" }}>← Quit</button>
      <span className="muted" style={{ letterSpacing: ".18em" }}>⚔️ CHALLENGE · {step + 1}/{CHALLENGE_SIZE}{opp ? ` · vs ${opp.name}` : ""}</span>
    </div>
  );
  return <PuzzleView key={`${seed}-${step}`} puzzle={puzzles[step]} profile={profile} setProfile={setProfile}
    onResolve={resolve} header={header} maxGuesses={GUESSES_PER_PUZZLE} hideGiveUp goStore={goStore} revealAnswer={false} />;
}

function shareOrCopy(text) {
  if (typeof navigator !== "undefined" && navigator.share) { navigator.share({ text }).catch(() => {}); return "shared"; }
  if (typeof navigator !== "undefined" && navigator.clipboard) { navigator.clipboard.writeText(text); return "copied"; }
  return "";
}

function Competitions({ profile, setProfile, challenge, setChallenge, goStore }) {
  const [name, setName] = useState(profile.challengeName || "");
  const [finished, setFinished] = useState(null);   // my stats after a run
  const [copied, setCopied] = useState("");
  const rec = profile.challengeRec || { p: 0, w: 0, d: 0, l: 0, pts: 0 };

  function start(opp) {
    const nm = (name || "PLAYER").trim().slice(0, 14);
    setProfile((pr) => ({ ...pr, challengeName: nm }));
    setFinished(null);
    setChallenge(opp ? challenge : { seed: newSeed(), opp: null });
  }
  function onFinished(stats) { setFinished(stats); }

  // ---- mid-run ----
  if (challenge && !finished) {
    return <ChallengeRun seed={challenge.seed} opp={challenge.opp} profile={profile} setProfile={setProfile} goStore={goStore}
      onExit={() => setChallenge(null)} onFinished={onFinished} />;
  }

  // ---- run finished: creator share OR head-to-head verdict ----
  if (challenge && finished) {
    const myName = profile.challengeName || "PLAYER";
    const url = `${window.location.origin}${window.location.pathname}?c=${encodeChallenge(challenge.seed, myName, finished)}`;
    if (!challenge.opp) {
      const text = `THE TEAM SHEET ⚔️ ${myName} challenges you!\n${finished.solved}/${CHALLENGE_SIZE} solved · ${finished.wrong} wrong · ${finished.secs}s\nBeat that: ${url}`;
      return (
        <div className="center" style={{ marginTop: 20, animation: "pop .35s ease both" }}>
          <div className="disp" style={{ fontSize: 30, color: "var(--cream)" }}>GAUNTLET LAID DOWN</div>
          <div className="muted" style={{ color: "var(--line)", marginTop: 6 }}>You went {finished.solved}/{CHALLENGE_SIZE} · {finished.wrong} wrong · {finished.secs}s. Now send it.</div>
          <button className="big" onClick={() => setCopied(shareOrCopy(text))} style={{ maxWidth: 300, margin: "14px auto 0", background: "var(--gold)", color: "var(--navy)", boxShadow: "3px 3px 0 var(--navy)" }}>{copied ? (copied === "shared" ? "✓ SHARED" : "✓ LINK COPIED") : "⚔️ SHARE CHALLENGE"}</button>
          <button className="big" onClick={() => { setChallenge(null); setFinished(null); setCopied(""); }} style={{ maxWidth: 300, margin: "10px auto 0", background: "var(--cream)", color: "var(--navy)" }}>DONE</button>
        </div>
      );
    }
    const v = verdict(finished, challenge.opp.result);
    if (!finished.recorded) {
      finished.recorded = true;
      setProfile((pr) => {
        const r = pr.challengeRec || { p: 0, w: 0, d: 0, l: 0, pts: 0 };
        return { ...pr, challengeRec: { p: r.p + 1, w: r.w + (v === "win" ? 1 : 0), d: r.d + (v === "draw" ? 1 : 0), l: r.l + (v === "loss" ? 1 : 0), pts: r.pts + POINTS[v] } };
      });
    }
    const text = challengeShareText(myName, challenge.opp.name, v, finished, challenge.opp.result, "");
    return (
      <div className="center" style={{ marginTop: 20, animation: "pop .35s ease both" }}>
        <div className="disp" style={{ fontSize: 15, letterSpacing: ".16em", color: "var(--gold)" }}>FULL TIME</div>
        <div className="disp" style={{ fontSize: 38, color: v === "win" ? "var(--grass)" : v === "loss" ? "var(--red)" : "var(--cream)", margin: "6px 0" }}>
          {v === "win" ? "YOU WIN! +3" : v === "loss" ? "DEFEAT · 0" : "DRAW · +1"}
        </div>
        <div className="card paper" style={{ maxWidth: 320, margin: "10px auto", textAlign: "left" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}><span>{profile.challengeName || "YOU"}</span><span>{finished.solved}/{CHALLENGE_SIZE} · {finished.wrong}✕ · {finished.secs}s</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, marginTop: 6, opacity: .8 }}><span>{challenge.opp.name}</span><span>{challenge.opp.result.solved}/{CHALLENGE_SIZE} · {challenge.opp.result.wrong}✕ · {challenge.opp.result.secs}s</span></div>
        </div>
        <button className="big" onClick={() => setCopied(shareOrCopy(text))} style={{ maxWidth: 300, margin: "8px auto 0", background: "var(--gold)", color: "var(--navy)", boxShadow: "3px 3px 0 var(--navy)" }}>{copied ? "✓ RESULT SHARED" : "📣 SHARE RESULT"}</button>
        <button className="big" onClick={() => { setFinished(null); setCopied(""); setChallenge({ seed: newSeed(), opp: null }); }} style={{ maxWidth: 300, margin: "10px auto 0", background: "var(--navy)", color: "var(--cream)" }}>↩ REMATCH — LAY A NEW GAUNTLET</button>
        <button className="big" onClick={() => { setChallenge(null); setFinished(null); setCopied(""); }} style={{ maxWidth: 300, margin: "10px auto 0", background: "var(--cream)", color: "var(--navy)" }}>DONE</button>
      </div>
    );
  }

  // ---- lobby ----
  return (
    <div style={{ marginTop: 6, animation: "pop .3s ease both" }}>
      <div className="card paper" style={{ marginBottom: 14 }}>
        <div className="disp" style={{ fontSize: 22, color: "var(--navy)" }}>⚔️ CHALLENGE A FRIEND</div>
        <div className="muted" style={{ marginTop: 4 }}>Play a {CHALLENGE_SIZE}-puzzle gauntlet, then send the link. They face the SAME puzzles — most solves wins, fewest wrong guesses breaks ties, then speed. Win 3pts · draw 1 · loss 0.</div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name for the teamsheet…" maxLength={14}
            style={{ flex: 1, border: "2px solid var(--line)", borderRadius: 10, padding: "10px 12px", fontWeight: 700, background: "var(--cream)", color: "var(--navy)" }} />
          <button className="btn gold" onClick={() => start(null)}>START ⚔️</button>
        </div>
        {rec.p > 0 && <div className="muted" style={{ marginTop: 10 }}>Your record: <b>{rec.w}W {rec.d}D {rec.l}L</b> · <b>{rec.pts} pts</b></div>}
      </div>

      <div className="card paper" style={{ marginBottom: 14, opacity: .92 }}>
        <div className="disp" style={{ fontSize: 22, color: "var(--navy)" }}>🏆 LEAGUES <span style={{ fontSize: 11, verticalAlign: "middle", background: "var(--navy)", color: "var(--gold)", borderRadius: 5, padding: "3px 7px", marginLeft: 6 }}>COMING SOON</span></div>
        <div className="muted" style={{ marginTop: 4 }}>Your WhatsApp group, one table. Weekly rounds, 3pts a win, 1 a draw — running standings all season. Leagues need player accounts, which arrive with the server update.</div>
      </div>

      <CompetitionsCup />
    </div>
  );
}

function CompetitionsCup() {
  const [notify, setNotify] = useState(false);
  return (
    <div style={{ marginTop: 6, animation: "pop .3s ease both" }}>
      <div className="center" style={{ margin: "6px 0 14px" }}>
        <span className="muted" style={{ letterSpacing: ".18em", color: "var(--gold)" }}>COMING SOON</span>
      </div>

      <div className="card paper" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>🏆</div>
        <div className="disp" style={{ fontSize: 30, color: "var(--navy)", lineHeight: .95, marginTop: 6 }}>THE WEEKLY CUP</div>
        <div className="muted" style={{ marginTop: 8, fontSize: 14 }}>
          Go head-to-head with players across the country in a weekly football-knowledge competition — and win real prizes.
        </div>

        <div style={{ borderTop: "2px solid var(--line)", margin: "16px 0", paddingTop: 16, textAlign: "left" }}>
          <div className="step" style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 0" }}>
            <span className="disp" style={{ fontSize: 20, color: "var(--red)", width: 24 }}>⚽</span>
            <div className="muted" style={{ color: "var(--navy)", fontWeight: 600 }}>Four hard puzzles. Same for everyone.</div>
          </div>
          <div className="step" style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 0" }}>
            <span className="disp" style={{ fontSize: 20, color: "var(--red)", width: 24 }}>⏱️</span>
            <div className="muted" style={{ color: "var(--navy)", fontWeight: 600 }}>Fastest correct run wins. Pure skill, no luck.</div>
          </div>
          <div className="step" style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 0" }}>
            <span className="disp" style={{ fontSize: 20, color: "var(--red)", width: 24 }}>🎟️</span>
            <div className="muted" style={{ color: "var(--navy)", fontWeight: 600 }}>Win football trips & matchday experiences.</div>
          </div>
        </div>

        <button className="big" onClick={() => setNotify(true)} disabled={notify} style={{ background: notify ? "var(--grass)" : "var(--navy)" }}>
          {notify ? "✓ WE'LL LET YOU KNOW" : "NOTIFY ME WHEN IT'S LIVE"}
        </button>
      </div>

      <p className="muted" style={{ color: "var(--line)", textAlign: "center", marginTop: 14, fontSize: 11, opacity: .8, maxWidth: 340, marginInline: "auto" }}>
        The Weekly Cup is a skill competition in development. It will be 18+, and launches once everything's in place. Not yet available.
      </p>
    </div>
  );
}


// ---- STATS ----------------------------------------------------------------
function Stats({ profile }) {
  const items = [
    ["🔥", profile.streak, "Current streak"],
    ["🏆", profile.best, "Best streak"],
    ["⚽", profile.collected, "Players found"],
    ["📅", profile.played, "Matchdays played"],
    ["⚔️", `${(profile.challengeRec || {}).w || 0}W ${(profile.challengeRec || {}).d || 0}D ${(profile.challengeRec || {}).l || 0}L`, `Challenges · ${(profile.challengeRec || {}).pts || 0} pts`],
  ];
  return (
    <div style={{ marginTop: 6, animation: "pop .3s ease both" }}>
      <div className="center"><span className="muted" style={{ letterSpacing: ".18em", color: "var(--gold)" }}>YOUR RECORD</span></div>
      <div className="statgrid">
        {items.map(([icon, v, k]) => (
          <div className="statbox" key={k}>
            <div className="v disp">{icon}{v}</div>
            <div className="k">{k}</div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ color: "var(--line)", marginTop: 16, textAlign: "center", fontSize: 11, opacity: .8 }}>
        Saved on this device. Accounts (so your record follows you everywhere) come in the next update.
      </p>
    </div>
  );
}
