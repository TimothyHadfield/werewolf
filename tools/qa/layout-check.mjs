// Table layout check (visibility pass 2026-10-26): the table fills its space and every seat stays readable.
// usage: node tools/qa/layout-check.mjs [url] [webkit|chromium]   (exit 1 on any failure)
// Needs playwright (from ~/.claude/tools). Serve the folder first, e.g. python -m http.server <port>.
import { createRequire } from "node:module";
import os from "node:os";
const require = createRequire(os.homedir() + "/.claude/tools/package.json");
const pw = require("playwright");
const URL = process.argv[2] || "http://127.0.0.1:8000/?fast";
const ENGINE = process.argv[3] || "webkit";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const phone = (w, h) => ({ viewport: { width: w, height: h }, isMobile: ENGINE !== "firefox", hasTouch: true, deviceScaleFactor: 1 });
// [tag, context, players, rules: min card width px, min table height px, min letters of each name on its plate]
// Fit pass 2026-11-27: every name is 11-14 letters (the crowded worst case; cut14 caps names at 14),
// and each plate must show at least `name` of them (or the whole name), never a 1-2 letter stub.
const CASES = [
  ["393 x20", phone(393, 659), 20, { card: 22, tableH: 400, name: 6 }],
  ["393 x8", phone(393, 659), 8, { card: 40, tableH: 400, name: 4 }],
  ["320 x20", phone(320, 568), 20, { card: 14, tableH: 330, name: 4 }],
  ["landscape x20", phone(659, 393), 20, { card: 18, tableH: 270, name: 5 }],
  ["landscape x8", phone(659, 393), 8, { card: 28, tableH: 270, name: 7 }],
  ["1280 x20", { viewport: { width: 1280, height: 800 } }, 20, { card: 48, tableH: 600, name: 7 }],
  ["1280 x8", { viewport: { width: 1280, height: 800 } }, 8, { card: 80, tableH: 600, name: 14 }],
];
const NAMES = ["Christopherson", "Alexandriana", "Maximilianus", "Evangelinette", "Bartholomewsy", "Gwendolynne", "Rosalindabel", "Theodoricus", "Penelopeanne", "Montgomeryjr", "Isabellarose", "Benjaminsson", "Jacquelineva", "Fredericksen", "Sebastianito", "Anastasiaree", "Wilhelminaby", "Konstantinos", "Seraphinaria", "Nathanielsen"];
const browser = await pw[ENGINE].launch();
let fails = 0;
const check = (tag, ok, msg) => { if (!ok) { fails++; console.log("FAIL " + tag + ": " + msg); } };
for (const [tag, opts, N, rule] of CASES) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("requestfailed", (r) => console.log("  (request failed: " + r.url() + " " + (r.failure() || {}).errorText + ")"));
  const tap = async (sel) => { await sleep(30); return p.evaluate((s) => { const e = [...document.querySelectorAll(s)].find((e) => e.offsetParent !== null && !e.disabled); if (e) { e.click(); return true; } return false; }, sel); };
  await p.goto(URL); await sleep(800); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  await p.evaluate(([n, names]) => { const S = __ww.S(); S.count = n; S.names = names.slice(0, n); }, [N, NAMES]);
  await tap("[data-act=newTable]"); await tap("[data-act=setupNext]"); await sleep(100); await tap("[data-act=startGame]"); await sleep(200);
  // Skip the deal and the night straight to day 1 with two claims (state only; the rules engine is not touched).
  for (let i = 0; i < 400; i++) {
    const st = await p.evaluate(() => ({ ph: __ww.S().game.phase, open: __ww.ui.dealOpen }));
    if (st.ph !== "reveal") break;
    if (!st.open) await tap(".flip"); else await tap("[data-act=dealNext]");
  }
  await tap("[data-act=begin]");
  for (let i = 0; i < 300; i++) {
    await sleep(40);
    if (await tap("[data-act=nightDone]")) continue;
    if (await p.evaluate(() => !!document.querySelector("[data-act=seerCheck]"))) { await tap(".pbtn:not([disabled])"); await tap("[data-act=seerCheck]"); continue; }
    if (await p.evaluate(() => !!document.querySelector("[data-act=nightPick]"))) { await tap(".pbtn:not([disabled])"); await tap("[data-act=nightPick]"); continue; }
    if (await tap("[data-act=witchDone]")) continue;
    if (await p.evaluate(() => __ww.S().game.phase !== "night")) break;
  }
  for (let i = 0; i < 100; i++) { await sleep(60); if (await p.evaluate(() => __ww.S().game.phase) === "day") break; if (await tap("[data-act=shootAir]")) continue; await tap("[data-act=toDay]"); }
  await tap(".ww-seat:not([disabled])"); await sleep(500);
  const measure = () => p.evaluate(() => {
    const t = document.querySelector(".ww-table"), r = (e) => e.getBoundingClientRect();
    const seats = [...t.querySelectorAll(".ww-seat")];
    const vis = (sel) => seats.map((s) => s.querySelector(sel)).filter((e) => e && e.offsetParent !== null);
    const fs = (sel) => Math.min(...vis(sel).map((e) => parseFloat(getComputedStyle(e).fontSize)), 99);
    const boxes = [];
    seats.forEach((s, i) => s.querySelectorAll(".ww-card,.tbl-plate,.odds,.ps,.bar").forEach((e) => { if (e.offsetParent !== null) boxes.push({ i, b: r(e) }); }));
    let ov = 0, off = 0; const tr = r(t);
    boxes.forEach(({ b }) => { if (b.left < tr.left - 1 || b.right > tr.right + 1 || b.top < tr.top - 1 || b.bottom > tr.bottom + 1) off++; });
    for (let a = 0; a < boxes.length; a++) for (let c = a + 1; c < boxes.length; c++) {
      if (boxes[a].i === boxes[c].i) continue;
      const A = boxes[a].b, B = boxes[c].b;
      if (Math.min(A.right, B.right) - Math.max(A.left, B.left) > 1 && Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top) > 1) ov++;
    }
    const cards = seats.filter((s) => !s.classList.contains("me")).map((s) => r(s.querySelector(".ww-card")));
    const c = t.querySelector(".ww-center");
    // Letters of each name drawn inside its plate (the rest is cut off behind the "…").
    const shown = vis(".tbl-plate").map((e) => {
      const pr = r(e); let n = 0, len = 0;
      const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      for (let tn; (tn = tw.nextNode());) for (let i = 0; i < tn.length; i++) {
        if (!tn.data[i].trim()) continue; len++;
        const rg = document.createRange(); rg.setStart(tn, i); rg.setEnd(tn, i + 1); const b = rg.getBoundingClientRect();
        if (b.width && b.right <= pr.right - 1 && b.left >= pr.left) n++;
      }
      return { n, len };
    });
    // The footer buttons ("Vote out Christopherson"): the label is never cut.
    const footCut = [...document.querySelectorAll(".day-foot .btn")].filter((b) => b.offsetParent && b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent.trim());
    return { n: seats.length, card: Math.round(Math.min(...cards.map((b) => b.width))), aspect: Math.min(...seats.map((s) => { const cs = getComputedStyle(s.querySelector(".ww-card")); return parseFloat(cs.height) / parseFloat(cs.width); })), tableH: Math.round(tr.height), plate: fs(".tbl-plate"), odds: fs(".odds"), ov, off, overflowX: document.documentElement.scrollWidth > innerWidth + 1, centerScroll: c ? c.scrollHeight > c.clientHeight + 2 : false, nameShort: shown.filter((s) => s.n < s.len).length, nameMin: Math.min(...shown.map((s) => s.n)), names: shown, footCut };
  });
  const verify = (label, m) => {
    const names = m.names; delete m.names;
    console.log(label.padEnd(20), JSON.stringify(m));
    const bad = names.filter((s) => s.n < Math.min(s.len, rule.name));
    check(label, !bad.length, bad.length + " name plates show too few letters (" + bad.map((s) => s.n + "/" + s.len).join(" ") + ", want " + rule.name + " or the whole name)");
    check(label, !m.footCut.length, "button label cut: " + m.footCut.join(", "));
    check(label, m.n === N, "seats " + m.n);
    check(label, m.card >= rule.card, "card " + m.card + " px < " + rule.card);
    check(label, m.tableH >= rule.tableH, "table height " + m.tableH + " px < " + rule.tableH);
    check(label, Math.abs(m.aspect - 88 / 63) < 0.05, "card ratio " + m.aspect.toFixed(3));
    check(label, m.plate >= 10, "name plate " + m.plate + " px");
    check(label, m.odds >= 12, "odds " + m.odds + " px");
    check(label, m.ov === 0, m.ov + " overlaps between seats");
    check(label, m.off === 0, m.off + " seat parts off the table");
    check(label, !m.overflowX, "page scrolls sideways");
    check(label, !m.centerScroll, "middle of the table scrolls");
  };
  verify(tag + " day", await measure());
  // Late game: most players dead with their roles shown, then game over.
  await p.evaluate(() => { const g = __ww.S().game; g.players.forEach((x, i) => { if (i % 5) { x.alive = false; x.revealed = true; } }); g.winner = "village"; g.log.push({ t: "end", winner: "village" }); document.querySelector("[data-act=tab][data-t=play]").click(); });
  await sleep(2500);
  verify(tag + " game over", await measure());
  check(tag, !errs.length, "errors " + errs.join(" | "));
  await ctx.close();
}
// Vs computer, 12 players (max): odds bars under the names, and in landscape the button column vs the stat lines.
for (const [tag, opts] of [["393 cpu12", phone(393, 659)], ["landscape cpu12", phone(659, 393)]]) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  const tap = async (sel) => { await sleep(30); return p.evaluate((s) => { const e = [...document.querySelectorAll(s)].find((e) => e.offsetParent !== null && !e.disabled); if (e) { e.click(); return true; } return false; }, sel); };
  await p.goto(URL); await sleep(800); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  await p.evaluate(() => { const S = __ww.S(); S.cpuCount = 12; S.names = ["Christopher"]; });
  await tap("[data-act=newCpu]"); await tap("[data-act=setupNext]"); await sleep(100); await tap("[data-act=startGame]"); await sleep(300);
  await tap("[data-act=cpuBegin]");
  for (let i = 0; i < 300; i++) {
    await sleep(60);
    if (await p.evaluate(() => !!document.querySelector("[data-act=cpuVote]"))) break;
    if (await tap("[data-act=cpuDone]")) continue;
    if (await p.evaluate(() => !!document.querySelector("[data-act=cpuPick]"))) { await tap(".ww-seat:not([disabled])"); await tap("[data-act=cpuPick]"); continue; }
    if (await tap("[data-act=cpuHeal][data-v='0']")) continue;
    if (await tap("[data-act=cpuPoison][data-v=none]")) continue;
    if (await p.evaluate(() => __ww.S().cpu.phase === "day" && !__ww.S().cpu.players[0].alive)) break;
  }
  await sleep(500);
  const m = await p.evaluate(() => {
    const t = document.querySelector(".ww-table"), r = (e) => e.getBoundingClientRect();
    const seats = [...t.querySelectorAll(".ww-seat")];
    const boxes = [];
    seats.forEach((s, i) => s.querySelectorAll(".ww-card,.tbl-plate,.odds,.ps,.bar").forEach((e) => { if (e.offsetParent !== null) boxes.push({ i, b: r(e) }); }));
    let ov = 0;
    for (let a = 0; a < boxes.length; a++) for (let c = a + 1; c < boxes.length; c++) {
      if (boxes[a].i === boxes[c].i) continue;
      const A = boxes[a].b, B = boxes[c].b;
      if (Math.min(A.right, B.right) - Math.max(A.left, B.left) > 1 && Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top) > 1) ov++;
    }
    const st = document.querySelector(".ww-play > .stat-line"), ft = document.querySelector(".ww-play > .day-foot");
    let footHitsStat = false;
    if (st && ft) { const sr = r(st); [...ft.children].forEach((c) => { const b = r(c); if (b.top < sr.bottom - 1 && b.left < sr.right && b.right > sr.left) footHitsStat = true; }); }
    const footClipped = ft ? [...ft.children].some((c) => { const b = r(c); return b.top < 0 || b.bottom > innerHeight + 1; }) : false;
    return { n: seats.length, ov, footHitsStat, footClipped, overflowX: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  console.log(tag.padEnd(20), JSON.stringify(m));
  check(tag, m.n === 12, "seats " + m.n);
  check(tag, m.ov === 0, m.ov + " overlaps between seats");
  check(tag, !m.footHitsStat, "buttons cover the stat lines");
  check(tag, !m.footClipped, "a button is off screen");
  check(tag, !m.overflowX, "page scrolls sideways");
  await ctx.close();
}
await browser.close();
console.log(fails ? fails + " failed" : "layout check: all passed");
process.exit(fails ? 1 : 0);
