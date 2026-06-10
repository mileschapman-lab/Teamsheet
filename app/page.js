// app/page.js
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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

const DIFFC = { easy: "var(--grass)", medium: "var(--gold)", hard: "var(--red)" };

// Flag emoji → ISO code, so we can render real flag images (Windows browsers
// don't render flag emoji — they show letter pairs). flagcdn serves PNGs.
const FLAG_CODE = {
  "🏴": "gb-eng", "🇫🇷": "fr", "🇳🇱": "nl", "🇷🇸": "rs", "🇮🇪": "ie",
  "🇨🇿": "cz", "🇩🇪": "de", "🇪🇸": "es", "🇺🇾": "uy", "🇸🇳": "sn",
  "🇧🇪": "be", "🇦🇷": "ar", "🇨🇮": "ci", "🇪🇬": "eg", "🇫🇮": "fi",
  "🇰🇷": "kr", "🇭🇷": "hr", "🇩🇰": "dk", "🇸🇪": "se", "🇩🇿": "dz", "🇹🇬": "tg",
  "🇦🇺": "au", "🇧🇦": "ba", "🇧🇷": "br", "🇬🇭": "gh", "🇵🇹": "pt",
};
function Flag({ emoji, size = 30 }) {
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
  lives: 5, livesAt: Date.now(), levelReached: 0, clearedLevels: [],
});

export default function Page() {
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("daily");
  const matchday = useMemo(() => matchdayNumber(), []);
  const puzzles = useMemo(() => dailyPuzzles(matchday), [matchday]);

  // hydrate from localStorage on mount
  useEffect(() => {
    let p = loadProfile() || freshProfile();
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
      <div className="tabs">
        {["daily", "levels", "competitions", "store", "stats"].map((t) => (
          <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === "daily" && <Daily profile={profile} setProfile={setProfile} matchday={matchday} puzzles={puzzles} />}
      {tab === "levels" && <Levels profile={profile} setProfile={setProfile} />}
      {tab === "competitions" && <Competitions />}
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
        <span className="pill lives">❤️ {profile.lives}/{MAX_LIVES}</span>
        <span className="pill"><span className="coin" />{profile.coins}</span>
        <span className="pill">🔥 {profile.streak}</span>
      </div>
    </div>
  );
}

function Onboarding({ onStart }) {
  return (
    <div className="ob paper">
      <h2>HOW TO PLAY</h2>
      <div className="step"><span className="n">1</span><div className="t"><b>Read the team sheet</b><p>You're shown three real footballers — like cards in a sticker album.</p></div></div>
      <div className="step"><span className="n">2</span><div className="t"><b>Name the missing player</b><p>One player was a teammate of all three. Type their name — pick from the list.</p></div></div>
      <div className="step"><span className="n">3</span><div className="t"><b>Any correct link counts</b><p>If more than one player genuinely links all three, any of them is accepted.</p></div></div>
      <div className="step"><span className="n">4</span><div className="t"><b>Come back daily</b><p>Three new puzzles every day. Keep your streak alive and collect stickers.</p></div></div>
      <button className="big" onClick={onStart} style={{ marginTop: 16 }}>START PLAYING →</button>
    </div>
  );
}

// ---- a reusable single-puzzle player -------------------------------------
function PuzzleView({ puzzle, profile, setProfile, onResolve, header, maxGuesses = MAX_GUESSES, hideGiveUp = false }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [guesses, setGuesses] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [shake, setShake] = useState(false);
  const [posClue, setPosClue] = useState(false);
  const [cardClue, setCardClue] = useState(false);
  const inputRef = useRef(null);

  const ans = PLAYERS[puzzle.answer];
  const sugg = open ? search(query) : [];
  const solved = guesses.some((g) => g.s !== "wrong");
  const finished = solved || revealed;
  const remaining = maxGuesses - guesses.length;

  function submit(id) {
    if (!id || finished) return;
    const s = checkGuess(puzzle, id);
    const next = [...guesses, { id, s }];
    setGuesses(next); setQuery(""); setOpen(false);
    if (s !== "wrong") {
      onResolve(true, s === "correct_alternate" ? "alt" : "win");
    } else if (next.length >= maxGuesses) {
      setRevealed(true); onResolve(false, "miss");
    } else { setShake(true); setTimeout(() => setShake(false), 420); }
  }
  function buyCard() { if (profile.coins >= ECONOMY.spend.clueClubs && !cardClue) { setProfile((p) => ({ ...p, coins: p.coins - ECONOMY.spend.clueClubs })); setCardClue(true); } }
  function buyPos() { if (profile.coins >= ECONOMY.spend.clueHint && !posClue) { setProfile((p) => ({ ...p, coins: p.coins - ECONOMY.spend.clueHint })); setPosClue(true); } }

  return (
    <div style={{ animation: "pop .3s ease both" }}>
      {header}
      <div className="card paper" style={{ animation: shake ? "shake .42s" : "none" }}>
        <div className="center" style={{ marginBottom: 14 }}>
          <div className="disp" style={{ fontSize: 23, color: "var(--navy)" }}>FIND THE MISSING PLAYER</div>
          <div className="muted" style={{ marginTop: 6 }}>One player played with <b style={{ color: "var(--navy)" }}>all three</b>. Who links them?</div>
          {puzzle.era && (
            <div style={{ display: "inline-block", marginTop: 10, fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: "var(--navyDeep)", background: "var(--paperDk)", border: "2px solid var(--line)", borderRadius: 999, padding: "4px 12px" }}>
              ⏱ {puzzle.era}
            </div>
          )}
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
                  <div className="spos">{POSNAME[p[2]]}{cardClue && puzzle.sharedClubs ? ` · played here: ${puzzle.sharedClubs[i]}` : ""}</div>
                </div>
                <span className="stag">{p[2]}</span>
              </div>
            </div>
          );
        })}
        {finished ? (
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
          <div className="slot">
            {puzzle.diff === "easy" ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div className="sflag" style={{ width: 44, height: 44 }}><Flag emoji={ans[3]} size={36} /></div>
                <div className="q disp" style={{ fontSize: 24 }}>?</div>
              </div>
            ) : (
              <div className="q disp">?</div>
            )}
            <div className="hint">{POSNAME[ans[2]]} · Premier League{posClue ? ` · ${ans[3]}` : ""}</div>
          </div>
        )}
      </div>

      {guesses.length > 0 && (
        <div className="guesses">
          {guesses.map((g, i) => (
            <span key={i} className={`chip ${g.s === "wrong" ? "bad" : "good"}`}>
              {g.s === "wrong" ? "✕" : "✓"} {PLAYERS[g.id][0]}
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
                    <span className="m">{PLAYERS[id][1].split(" / ")[0]} · {PLAYERS[id][2]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="toolbar">
            <span className="muted" style={{ color: "var(--cream)" }}>{remaining} guess{remaining !== 1 ? "es" : ""} left</span>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {!hideGiveUp && <button className="btn ghost" onClick={() => { setRevealed(true); onResolve(false, "miss"); }}>Give up</button>}
              <button className="btn cream" onClick={buyCard} disabled={cardClue || profile.coins < ECONOMY.spend.clueClubs}>{cardClue ? "Clubs shown" : `🏟️ Shared clubs · ${ECONOMY.spend.clueClubs}`}</button>
              <button className="btn gold" onClick={buyPos} disabled={posClue || profile.coins < ECONOMY.spend.clueHint}>{posClue ? "Clue used" : `💡 Hint · ${ECONOMY.spend.clueHint}`}</button>
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
      <div className="disp" style={{ fontSize: 26, color: "var(--navy)" }}>{solved ? (alt ? "SHARP ONE!" : "STICKER FOUND!") : "MISSED IT"}</div>
      <div className="muted" style={{ color: solved ? "var(--navyDeep)" : "var(--dim)", marginTop: 5 }}>
        {solved ? (alt ? `Also played with all three. We had ${ans[0]}.` : `${ans[0]} — nice one.`) : `The missing player was ${ans[0]}.`}
      </div>
    </div>
  );
}

// ---- DAILY mode ----------------------------------------------------------
function Daily({ profile, setProfile, matchday, puzzles }) {
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

  return <PuzzleView key={current} puzzle={puzzle} profile={profile} setProfile={setProfile} onResolve={resolve} header={header} />;
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
        <div><div className="disp" style={{ fontSize: 28, color: "var(--cream)" }}>📖{profile.collected}</div><div className="muted" style={{ color: "var(--line)" }}>stickers</div></div>
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
function Levels({ profile, setProfile }) {
  const [activeLevel, setActiveLevel] = useState(null); // index into LEVELS, or null = map

  if (activeLevel === null) {
    return <LevelMap profile={profile} onPlay={(i) => setActiveLevel(i)} />;
  }
  return (
    <LevelRun
      key={activeLevel}
      levelIndex={activeLevel}
      profile={profile}
      setProfile={setProfile}
      onExit={() => setActiveLevel(null)}
    />
  );
}

function LevelMap({ profile, onPlay }) {
  const reached = profile.levelReached;
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
          <button key={i} disabled={locked} onClick={() => onPlay(i)}
            className="card paper" style={{
              display: "block", width: "100%", textAlign: "left", marginBottom: 12,
              opacity: locked ? .5 : 1, cursor: locked ? "default" : "pointer",
              boxShadow: open ? "6px 6px 0 var(--gold)" : "6px 6px 0 var(--red)",
            }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="disp" style={{ fontSize: 22, color: "var(--navy)" }}>{lvl.name}</div>
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
        Each level is 3 puzzles. 3 guesses per puzzle — miss all 3 and you lose a life. Run out of lives and the level resets.
      </p>
    </div>
  );
}

function LevelRun({ levelIndex, profile, setProfile, onExit }) {
  const level = LEVELS[levelIndex];
  const setPuzzles = level.puzzles.map((idx) => BANK[idx]);
  const [step, setStep] = useState(0);     // which puzzle in the set
  const [failed, setFailed] = useState(false);
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

  function onResolve(solved) {
    if (solved) {
      const isLast = step + 1 >= setPuzzles.length;
      if (isLast) {
        // level complete
        setDone(true);
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
      // whiffed the puzzle → lose a life
      const s = spendLife(profile.lives, profile.livesAt);
      setProfile((p) => ({ ...p, lives: s.lives, livesAt: s.livesAt }));
      if (s.lives <= 0) {
        setFailed(true); // will show gate on next render via lives<=0
      } else {
        // continue to next puzzle in the set (or finish if last)
        const isLast = step + 1 >= setPuzzles.length;
        if (isLast) { setDone(true); }
        else setTimeout(() => setStep((s2) => s2 + 1), 900);
      }
    }
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
    <PuzzleView key={step} puzzle={puzzle} profile={profile} setProfile={setProfile}
      onResolve={(solved) => onResolve(solved)} header={header} maxGuesses={GUESSES_PER_PUZZLE} hideGiveUp />
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
  return (
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
  );
}

function Competitions() {
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
