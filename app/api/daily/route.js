// app/api/daily/route.js
// PLACEHOLDER for the server phase.
//
// Today the daily puzzle is computed client-side from data/players.js, which is
// fine for testing but means answers ship to the browser. In the server phase,
// this route will return ONLY the day's clue players (not the answer), and a
// companion route will validate a submitted guess server-side so answers are
// never exposed. Left here to mark the architecture; not yet wired up.

import { NextResponse } from "next/server";
import { matchdayNumber, dailyPuzzles } from "../../../lib/game";
import { PLAYERS } from "../../../data/players";

export async function GET() {
  const md = matchdayNumber();
  const puzzles = dailyPuzzles(md);
  // NOTE: for now this echoes the same client data. In production, strip
  // `answer`/`valid` and validate guesses via a separate POST route.
  const safe = puzzles.map((p) => ({
    clues: p.clues.map((id) => ({ id, name: PLAYERS[id][0], pos: PLAYERS[id][2], flag: PLAYERS[id][3] })),
    diff: p.diff,
    answerPos: PLAYERS[p.answer][2], // scaffold hint only
  }));
  return NextResponse.json({ matchday: md, puzzles: safe });
}
