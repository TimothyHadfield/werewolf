(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const vis = (e) => e && e.offsetParent !== null;
  const $ = (s) => [...document.querySelectorAll(s)].find(vis) || null;
  const $$ = (s) => [...document.querySelectorAll(s)].filter(vis);
  const click = (s) => { const e = typeof s === "string" ? $(s) : s; if (e && !e.disabled && vis(e)) { e.click(); return true; } return false; };
  const trail = []; let hints = []; let idle = 0;
  for (let i = 0; i < 3000; i++) {
    const g = __ww.S().cpu;
    if (__ww.ui.view === "game" && g && g.winner) { trail.push("winner " + g.winner); break; }
    let did = "";
    const pick = (hi) => { const ts = $$(".pbtn:not([disabled])"); if (!ts.length) return false; ts.sort((a, b) => parseFloat((b.querySelector(".odds") || {}).textContent || 0) - parseFloat((a.querySelector(".odds") || {}).textContent || 0)); click(hi ? ts[0] : ts[ts.length - 1]); return true; };
    if (click("[data-act=newCpu]")) did = "newCpu";
    else if (click("[data-act=setupNext]")) did = "next";
    else if (click("[data-act=startGame]")) did = "start";
    else if (click("[data-act=cpuBegin]")) did = "begin:" + g.players[0].role;
    else if ($("[data-act=hint]") && hints.length < 4 && !$("#toast.show")) { click("[data-act=hint]"); await sleep(50); hints.push(document.getElementById("toast").textContent); did = "hint"; }
    else if ($("[data-act=cpuHeal]")) { click("[data-act=cpuHeal][data-v='0']") || click("[data-act=cpuHeal]"); did = "heal"; }
    else if ($("[data-act=cpuPoison]")) { click("[data-act=cpuPoison][data-v=none]"); did = "poison"; }
    else if ($("[data-act=cpuPick]")) { pick(true); await sleep(20); click("[data-act=cpuPick]"); did = "pick"; }
    else if ($("[data-act=shoot]")) { pick(true); await sleep(20); click("[data-act=shoot]") || click("[data-act=shootAir]"); did = "shoot"; }
    else if ($("[data-act=cpuVote]")) {
      if (g.day === 2 && !g.claims.some((c) => c.by === 0) && $("[data-act=cpuClaim]")) { click("[data-act=cpuClaim]"); await sleep(40); const ts = $$("#sheet .pbtn:not([disabled])"); click(ts[0]); await sleep(30); click("#sheet [data-act=cpuClaimSave][data-w='0']"); did = "claim"; }
      else { if (pick(true)) { await sleep(20); click("[data-act=cpuVote]"); did = "vote"; } else { click("[data-act=cpuSkip]"); did = "skip"; } }
    }
    else if (click("[data-act=cpuDone]")) did = "done";
    else if (click("[data-act=toNight]")) did = "toNight";
    if (did) { idle = 0; trail.push(did + (g ? "@" + g.phase + g.day : "")); } else idle++;
    if (idle > 400) { trail.push("STUCK " + (g && g.phase + g.day + " step " + __ww.W.currentStep(g)) + " html:" + document.querySelector(".main").innerText.slice(0, 200)); break; }
    await sleep(did ? 60 : 50);
  }
  const g = __ww.S().cpu;
  return JSON.stringify({ trail: trail.slice(-30), hints, winner: g && g.winner, day: g && g.day, overText: document.querySelector(".main").innerText.slice(-400) });
})()
