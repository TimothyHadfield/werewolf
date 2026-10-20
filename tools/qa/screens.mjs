import { createRequire } from "node:module";
const require = createRequire("C:/Users/timha/.claude/tools/package.json");
const { webkit, devices } = require("playwright");
const URL = process.argv[2] || "http://localhost:8620/?fast";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await webkit.launch();
const report = [];
for (const [tag, opts] of [["phone", { ...devices["iPhone 15"] }], ["laptop", { viewport: { width: 1280, height: 800 } }]]) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  p.on("pageerror", (e) => errs.push("EXC " + e.message));
  await p.goto(URL);
  // 30 ms pause: the app ignores taps within 19 ms (?fast) of a screen change, like a double tap.
  const tap = async (sel) => { await sleep(30); return tapNow(sel); };
  const tapNow = (sel) => p.evaluate((s) => { const e = [...document.querySelectorAll(s)].find((e) => e.offsetParent !== null && !e.disabled); if (e) { e.click(); return true; } return false; }, sel);
  const shot = async (name) => {
    await sleep(450);
    const m = await p.evaluate(() => ({ ow: document.documentElement.scrollWidth > innerWidth + 1, oh: document.documentElement.scrollHeight > innerHeight + 1 }));
    await p.screenshot({ path: (process.env.OUT || "shots") + "/" + tag + "-" + name + ".png" });
    report.push(tag + " " + name + (m.ow ? " H-OVERFLOW" : "") + (m.oh ? " V-OVERFLOW" : ""));
  };
  await shot("01-home");
  await tap("[data-act=newTable]"); await shot("02-setup-players");
  await tap("[data-act=setupNext]"); await sleep(300); await shot("03-setup-roles");
  await tap("[data-act=startGame]"); await shot("04-deal");
  await tap(".flip"); await sleep(700); await shot("05-deal-open");
  for (let i = 0; i < 30; i++) { if (!(await tap("[data-act=dealNext]"))) break; await sleep(60); await tap(".flip"); await sleep(500); }
  await shot("06-ready");
  await tap("[data-act=begin]");
  // night: wait for an act stage, shoot it
  let gotNight = false;
  for (let i = 0; i < 200; i++) {
    await sleep(60);
    if (await p.evaluate(() => !!document.querySelector("[data-act=seerCheck],[data-act=nightPick]"))) { if (!gotNight) { await shot("07-night-act"); gotNight = true; } }
    if (await tap("[data-act=nightDone]")) continue;
    if (await p.evaluate(() => !!document.querySelector("[data-act=seerCheck]"))) { await tap(".pbtn:not([disabled])"); await tap("[data-act=seerCheck]"); continue; }
    if (await p.evaluate(() => !!document.querySelector("[data-act=nightPick]"))) { await tap(".pbtn:not([disabled])"); await tap("[data-act=nightPick]"); continue; }
    if (await tap("[data-act=witchDone]")) continue;
    if (await p.evaluate(() => __ww.S().game.phase !== "night")) break;
  }
  for (let i = 0; i < 100; i++) { await sleep(100); const ph = await p.evaluate(() => __ww.S().game.phase); if (ph === "day") break; if (await tap("[data-act=shootAir]")) continue; await tap("[data-act=toDay]"); }
  // a claim so odds move
  await tap("[data-act=claim]"); await sleep(200); await tap("#sheet .pbtn:not([disabled])"); await sleep(100);
  await p.evaluate(() => { const b = [...document.querySelectorAll("#sheet [data-act=claimT]:not([disabled])")]; if (b.length) b[b.length - 1].click(); });
  await sleep(100); await shot("08-claim-sheet");
  await tap("#sheet [data-act=claimSave][data-w='1']");
  await shot("09-day-odds");
  await tap("[data-act=help][data-k=odds]"); await shot("10-odds-why"); await tap("[data-act=closeSheet]");
  await tap("[data-act=tab][data-t=log]"); await shot("11-log-tab"); await tap("[data-act=tab][data-t=play]");
  await tap("[data-act=settings]"); await shot("12-settings"); await tap("[data-act=closeSheet]");
  // finish game via engine for the over screen
  await p.evaluate(() => { const S = __ww.S(); const g = S.game; g.players.forEach((x) => { if (x.role === "wolf") { x.alive = false; x.revealed = true; } }); g.winner = "village"; g.log.push({ t: "end", winner: "village" }); });
  await tap("[data-act=tab][data-t=play]"); await sleep(200); await shot("13-over");
  await tap("[data-act=home]"); await tap("[data-act=lab]"); await shot("14-lab");
  await tap("[data-act=home]"); await tap("[data-act=rules]"); await shot("15-rules");
  await tap("[data-act=back]"); await sleep(100); await tap("[data-act=home]");
  // vs computer
  await tap("[data-act=newCpu]"); await shot("16-cpu-setup"); await tap("[data-act=setupNext]"); await tap("[data-act=startGame]"); await shot("17-cpu-card");
  await tap("[data-act=cpuBegin]");
  for (let i = 0; i < 200; i++) { await sleep(80); const ph = await p.evaluate(() => __ww.S().cpu.phase); if (ph === "night" && await p.evaluate(() => !!document.querySelector("[data-act=cpuPick]"))) { await shot("18-cpu-night-act"); break; } if (ph === "day") break; }
  await shot("18b-cpu-night");
  for (let i = 0; i < 300; i++) { await sleep(80); if (await tap("[data-act=cpuDone]")) continue; if (await p.evaluate(() => !!document.querySelector("[data-act=cpuPick]"))) { await tap(".pane .pbtn:not([disabled])"); await tap("[data-act=cpuPick]"); continue; } if (await tap("[data-act=cpuHeal][data-v='0']")) continue; if (await tap("[data-act=cpuPoison][data-v=none]")) continue; if (await p.evaluate(() => !!document.querySelector("[data-act=cpuVote]"))) break; }
  await shot("19-cpu-day");
  await tap("[data-act=hint]"); await sleep(100); await shot("20-cpu-hint");
  await tap("[data-act=home]");
  await tap("[data-act=online]"); await shot("21-online");
  await ctx.close();
  report.push(tag + " errors: " + JSON.stringify(errs));
}
await browser.close();
console.log(report.join("\n"));
