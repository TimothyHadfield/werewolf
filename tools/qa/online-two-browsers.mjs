import { createRequire } from "node:module";
const require = createRequire("C:/Users/timha/.claude/tools/package.json");
const { webkit, devices } = require("playwright");
const URL = process.argv[2] || "http://localhost:8620/?fast";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await webkit.launch();
const mk = async (tag) => {
  const ctx = await browser.newContext({ ...devices["iPhone 15"] });
  const page = await ctx.newPage();
  page.errs = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") page.errs.push(tag + " " + m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => page.errs.push(tag + " EXC: " + e.message));
  await page.goto(URL);
  return page;
};
const A = await mk("A"), B = await mk("B");
const vis = (p, sel) => ({ count: () => p.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null).length, sel).catch(() => 0) });
const tap = (p, sel) => p.evaluate((s) => { const e = [...document.querySelectorAll(s)].find((e) => e.offsetParent !== null && !e.disabled); if (e) { e.click(); return true; } return false; }, sel).catch(() => false);
// Host: name, create a 6-seat room
await tap(A, "[data-act=online]"); await A.fill("[data-name='0']", "Tim");
await tap(A, "[data-act=onCreate]");
await A.evaluate(() => { __ww.S().onCount = 6; }); 
await tap(A, "[data-act=setupNext]"); await tap(A, "[data-act=startGame]");
let code = null;
for (let i = 0; i < 60 && !code; i++) { await sleep(500); code = await A.evaluate(() => __ww.ui.osnap && __ww.ui.osnap.code); }
console.log("room", code);
await A.screenshot({ path: "online-lobby-host.png" });
// Joiner
await tap(B, "[data-act=online]"); await B.fill("[data-name='0']", "Sam"); await B.fill("#joinCode", code.toLowerCase()); await tap(B, "[data-act=onJoin]");
for (let i = 0; i < 60; i++) { await sleep(500); const n = await A.evaluate(() => __ww.ui.osnap.seats.filter((s) => s.kind === "human").length); if (n === 2) break; }
await sleep(800);
await B.screenshot({ path: "online-lobby-joiner.png" });
// Host makes seat 3 a computer explicitly, then starts (rest fill)
await tap(A, "[data-act=seatKind][data-i='2']"); await sleep(1500);
await tap(A, "[data-act=onStart]");
const drive = async (p, tag, reloadAtDay) => {
  let reloaded = false; let idle = 0; const trail = [];
  for (let i = 0; i < 1500; i++) {
    const st = await p.evaluate(() => { const s = __ww.ui.osnap; const g = __ww.ui.og; return { status: s && s.status, phase: g && g.phase, day: g && g.day, winner: g && g.winner, view: __ww.ui.view, mode: __ww.ui.mode }; }).catch(() => ({}));
    if (st.winner || st.status === "finished") { trail.push("END " + st.winner); break; }
    if (!reloaded && reloadAtDay && st.phase === "day" && st.day >= reloadAtDay) {
      reloaded = true; trail.push("RELOAD");
      await p.reload(); await sleep(800);
      await tap(p, "[data-act=resumeOnline]"); await sleep(1500); continue;
    }
    if (st.phase === "day" && !p.shotDay) { p.shotDay = 1; await sleep(600); await p.screenshot({ path: "online-day-" + tag + ".png" }); }
    if (st.phase === "night" && !p.shotNight && st.day >= 1) { p.shotNight = 1; await sleep(600); await p.screenshot({ path: "online-night-" + tag + ".png" }); }
    let did = "";
    if (await tap(p, "[data-act=cpuBegin]")) did = "card";
    else if (await tap(p, "[data-act=cpuHeal][data-v='1']:not([disabled])")) did = "heal";
    else if (await tap(p, "[data-act=cpuPoison][data-v=none]")) did = "poison";
    else if (await vis(p, "[data-act=cpuPick]").count()) { await tap(p, ".pane .pbtn:not([disabled])"); await sleep(100); await tap(p, "[data-act=cpuPick]:not([disabled])"); did = "pick"; }
    else if (await tap(p, "[data-act=cpuDone]")) did = "done";
    else if (await vis(p, "[data-act=shoot]").count()) { await tap(p, "[data-act=shootAir]"); did = "shoot"; }
    else if (await vis(p, "[data-act=cpuVote]").count()) { await tap(p, ".pane .pbtn:not([disabled])"); await sleep(100); await tap(p, "[data-act=cpuVote]:not([disabled])"); did = "vote"; }
    if (did) { trail.push(did + "@" + st.phase + st.day); idle = 0; } else idle++;
    if (idle > 400) { trail.push("STUCK " + JSON.stringify(st)); break; }
    await sleep(did ? 400 : 150);
  }
  return trail;
};
const [ta, tb] = await Promise.all([drive(A, "A", 0), drive(B, "B", 2)]);
await sleep(1500);
await A.screenshot({ path: "online-end-host.png" }); await B.screenshot({ path: "online-end-joiner.png" });
const info = await Promise.all([A, B].map((p) => p.evaluate(() => ({ status: __ww.ui.osnap && __ww.ui.osnap.status, winner: __ww.ui.og && __ww.ui.og.winner, mySeat: __ww.ui.osnap && __ww.ui.osnap.mySeat, text: document.querySelector(".main").innerText.slice(0, 160) }))));
console.log(JSON.stringify({ A: ta.slice(-6), B: tb.slice(-8), info, errs: A.errs.concat(B.errs) }, null, 1));
// host closes the room (cleanup)
await A.evaluate(() => __ww.room() && __ww.room().close());
await sleep(1500);
await browser.close();
