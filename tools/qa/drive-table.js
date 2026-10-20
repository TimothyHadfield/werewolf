(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s) => [...document.querySelectorAll(s)].find((e) => e.offsetParent !== null) || null;
  const click = (s) => { const e = typeof s === "string" ? $(s) : s; if (e && !e.disabled && e.offsetParent !== null) { e.click(); return true; } return false; };
  const trail = [];
  for (let i = 0; i < 2500; i++) {
    const g = __ww.S().game;
    const v = __ww.ui.view;
    if (v === "game" && g && g.winner) { trail.push("winner " + g.winner); break; }
    let did = "";
    if (click("[data-act=newTable]")) did = "newTable";
    else if (click("[data-act=setupNext]")) did = "next";
    else if (click("[data-act=startGame]")) did = "start";
    else if (click(".flip:not(.open)")) { did = "flip"; await sleep(500); }
    else if (click("[data-act=dealNext]")) did = "dealNext";
    else if (click("[data-act=begin]")) did = "begin";
    else if (click("[data-act=nightDone]")) did = "seerDone";
    else if ($("[data-act=seerCheck]")) { const t = document.querySelector(".pbtn:not([disabled])"); click(t); await sleep(20); click("[data-act=seerCheck]"); did = "seer"; }
    else if ($("[data-act=nightPick]")) { const ts = [...document.querySelectorAll(".pbtn:not([disabled])")]; click(ts[ts.length - 1]); await sleep(20); click("[data-act=nightPick]"); did = "pick"; }
    else if ($("[data-act=witchDone]")) { if ($("[data-act=witchHeal]")) click("[data-act=witchHeal]"); await sleep(20); click("[data-act=witchDone]"); did = "witch"; }
    else if ($("[data-act=shoot]")) { const ts = [...document.querySelectorAll(".pbtn:not([disabled])")]; click(ts[0]); await sleep(20); click("[data-act=shoot]"); did = "shoot"; }
    else if ($("[data-act=vote]")) {
      if (g.day === 2 && !g.claims.length) { click("[data-act=claim]"); await sleep(30); const bs = document.querySelectorAll("#sheet .pbtn:not([disabled])"); click(bs[0]); await sleep(30); const ts = document.querySelectorAll("#sheet .pbtn:not([disabled])"); click(ts[ts.length - 1]); await sleep(30); click("#sheet [data-act=claimSave][data-w='1']"); did = "claim"; }
      else { const ts = [...document.querySelectorAll(".pbtn:not([disabled])")]; ts.sort((a, b) => parseFloat((b.querySelector(".odds") || {}).textContent || 0) - parseFloat((a.querySelector(".odds") || {}).textContent || 0)); click(ts[0]); await sleep(20); click("[data-act=vote]"); did = "vote"; }
    }
    else if (click("[data-act=toDay]")) did = "toDay";
    else if (click("[data-act=toNight]")) did = "toNight";
    if (did) trail.push(did + (g ? "@" + g.phase + g.day : ""));
    await sleep(did ? 60 : 120);
  }
  const g = __ww.S().game;
  return JSON.stringify({ trail: trail.filter((t, i) => i % 1 === 0).slice(-40), winner: g && g.winner, day: g && g.day, logLen: g && g.log.length, claims: g && g.claims.length });
})()
