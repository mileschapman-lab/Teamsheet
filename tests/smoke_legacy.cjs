// Legacy-profile smoke: simulates a long-time player's saved profile (missing
// every field added since launch) and walks ALL tabs + a transfer level.
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
global.window = dom.window; global.document = dom.window.document;
global.navigator = dom.window.navigator; global.localStorage = dom.window.localStorage;
global.Element = dom.window.Element; global.HTMLElement = dom.window.HTMLElement;
window.HTMLElement.prototype.scrollIntoView = function(){};
// OLD-SHAPE profile: pre-boosters, pre-challenge, pre-popup eras; mid-ladder at a TRANSFER level (index 2: T M W)
localStorage.setItem("teamsheet:v1", JSON.stringify({
  seenOnboarding: true, coins: 130, lives: 2, livesAt: Date.now() - 50 * 60 * 1000,
  streak: 4, best: 6, collected: 31, played: 9,
  dayCurrent: 0, dayResults: [], dayFinished: false, lastDay: null,
  levelReached: 2, clearedLevels: [0, 1], matchesSolved: [0],
}));
const React = require("react");
const { createRoot } = require("react-dom/client");
const { act } = React;
const Page = require("./page.bundle.cjs").default;
const click = async (btn) => act(async () => { btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
const find = (re) => [...document.querySelectorAll("button")].find(b => re.test(b.textContent));
(async () => {
  try {
    const root = createRoot(document.getElementById("root"));
    await act(async () => { root.render(React.createElement(Page)); });
    console.log("L1 ✓ legacy profile renders");
    const later = find(/LATER/); if (later) { await click(later); console.log("L2 ✓ daily popup ok"); }
    for (const [label, re] of [["levels", /Levels/], ["compete", /Compete/], ["store", /Store/], ["stats", /Stats/], ["daily", /Daily/]]) {
      const t = find(re); if (!t) throw new Error(label + " tab missing");
      await click(t);
      console.log("L3 ✓ tab renders:", label);
    }
    // open the current (transfer) level through the popup
    await click(find(/Levels/));
    const lvl = find(/▶/);
    if (!lvl) throw new Error("open level not found");
    await click(lvl);
    const play = find(/PLAY →/);
    if (!play) throw new Error("pre-level popup missing");
    await click(play);
    if (!/TRANSFER WINDOW/.test(document.body.textContent)) throw new Error("transfer level did not render");
    console.log("L4 ✓ transfer level renders on legacy profile");
    // COMPLETE the transfer level with the real answers (crash class: undefined refs on completion)
    const { TRANSFER_BANK } = require("./transfers.bundle.cjs");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    for (let qi = 0; qi < 3; qi++) {
      const ans = TRANSFER_BANK[qi].to;
      const input = document.querySelector("input");
      await act(async () => { setter.call(input, ans); input.dispatchEvent(new window.Event("input", { bubbles: true })); });
      const sg = [...document.querySelectorAll(".sugg button")].find(b => b.textContent.trim() === ans) || document.querySelector(".sugg button");
      if (!sg) throw new Error("no club suggestion for " + ans);
      await click(sg);
      await new Promise(r => setTimeout(r, 1600)); await act(async () => {});
    }
    await new Promise(r => setTimeout(r, 1700)); await act(async () => {});
    if (!/COMPLETE|CONTINUE/.test(document.body.textContent)) throw new Error("transfer LevelComplete missing");
    console.log("L4b ✓ transfer level COMPLETES to LevelComplete");
    const back = find(/CONTINUE →/); if (back) { await click(back); console.log("L4c ✓ back to map after completion"); }
    // back out and FINISH the daily via give-up x3 (covers DailyDone + banner)
    await click(find(/← Levels/) || find(/Levels/));
    await click(find(/Daily/));
    for (let i = 0; i < 3; i++) {
      const g = find(/Give up/);
      if (!g) break;
      await click(g);
      await new Promise(r => setTimeout(r, 1100));   // outcome dwell
      await act(async () => {});
    }
    await new Promise(r => setTimeout(r, 1300)); await act(async () => {});
    if (!/MATCHDAY .* COMPLETE|Come back tomorrow|streak/i.test(document.body.textContent)) throw new Error("daily completion screen missing");
    console.log("L5 ✓ daily completes to DailyDone");
    console.log("LEGACY SMOKE PASS");
  } catch (e) {
    console.log("LEGACY SMOKE FAIL:", (e && (e.stack || e.message) || "").split("\n").slice(0, 8).join("\n"));
  }
})();
