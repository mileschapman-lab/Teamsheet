const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
global.window = dom.window; global.document = dom.window.document;
global.navigator = dom.window.navigator; global.localStorage = dom.window.localStorage;
global.Element = dom.window.Element; global.HTMLElement = dom.window.HTMLElement;
window.HTMLElement.prototype.scrollIntoView = function(){};
const React = require("react");
const { createRoot } = require("react-dom/client");
const { act } = React;
const Page = require("./page.bundle.cjs").default;
(async () => {
  try {
    const root = createRoot(document.getElementById("root"));
    await act(async () => { root.render(React.createElement(Page)); });
    console.log("step1 ✓ initial render");
    const start = [...document.querySelectorAll("button")].find(b => /START PLAYING/.test(b.textContent));
    if (start) { await act(async () => { start.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); console.log("step1b ✓ onboarding done"); }
    const later = [...document.querySelectorAll("button")].find(b => /LATER/.test(b.textContent));
    if (later) { await act(async () => { later.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); console.log("step2 ✓ daily popup dismissed"); }
    const tab = [...document.querySelectorAll("button")].find(b => b.textContent.trim().toLowerCase().includes("levels"));
    if (!tab) { console.log("buttons:", [...document.querySelectorAll("button")].map(b => b.textContent.trim()).slice(0, 20).join(" | ")); throw new Error("levels tab not found"); }
    await act(async () => { tab.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
    console.log("step3 ✓ levels tab rendered");
    const play = [...document.querySelectorAll("button")].find(b => /▶/.test(b.textContent));
    if (play) {
      await act(async () => { play.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
      console.log("step4 ✓ level click ->", document.querySelector(".modal") ? "popup visible" : "NO POPUP");
      const playBtn = [...document.querySelectorAll("button")].find(b => /PLAY →/.test(b.textContent));
      if (playBtn) { await act(async () => { playBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); console.log("step5 ✓ entered level:", /FIND THE MISSING PLAYER|name the missing two/i.test(document.body.textContent) ? "puzzle visible" : "??"); }
    }
    // ---- challenge lobby + incoming-invite popup ----
    const comp = [...document.querySelectorAll("button")].find(b => b.textContent.trim().toLowerCase().includes("competitions"));
    if (comp) {
      await act(async () => { comp.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
      const startBtn = [...document.querySelectorAll("button")].find(b => /START ⚔️/.test(b.textContent));
      if (!startBtn) throw new Error("challenge lobby missing");
      await act(async () => { startBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
      const inRun = /CHALLENGE · 1\//.test(document.body.textContent);
      console.log("step6 ✓ challenge run started:", inRun ? "yes" : "NO");
      const quit = [...document.querySelectorAll("button")].find(b => /← Quit/.test(b.textContent));
      if (quit) await act(async () => { quit.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
    }
    console.log("SMOKE PASS");
  } catch (e) {
    console.log("SMOKE FAIL:", e && (e.stack || "").split("\n").slice(0,6).join("\n"));
  }
})();
