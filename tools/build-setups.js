// Measures suggested setups for one rule set and writes tools/out/setups-<ruleset>.json.
// For each player count: Simple / Classic / Full = the setups whose village win
// chance (normal-level computers on both sides) is closest to 50%, plus the
// rule book's own first-game table ("Rulebook"). Then merge with:
//   node tools/merge-setups.js
// Run: node tools/build-setups.js ultimate|millers|mafia
const fs = require("fs");
const path = require("path");
const W = require("../js/engine.js");

const rs = process.argv[2] || "ultimate";
const opts = W.RULESETS[rs].opts;
const SPECIALS = ["seer", "doctor", "bodyguard", "witch", "hunter"];
const SCREEN = 1500, FINAL = 10000;
const subsets = (arr) => Array.from({ length: 1 << arr.length }, (_, m) => arr.filter((_, i) => m & (1 << i)));

const result = {};
for (let n = 5; n <= 16; n++) {
  const cands = [];
  const maxW = Math.min(Math.ceil(n / 3), Math.floor((n - 1) / 2));
  for (let w = 1; w <= maxW; w++) {
    subsets(SPECIALS).forEach((sp) => {
      if (sp.indexOf("seer") < 0) return;
      if (w + sp.length > n - 1) return;
      const s = { wolf: w };
      sp.forEach((r) => { s[r] = 1; });
      const setup = W.normalizeSetup(s, n);
      const r = W.simulateSetup(setup, SCREEN, 1000 + n * 31 + w * 7 + sp.length, { opts });
      cands.push({ setup, sp, w, p: r.village });
    });
  }
  const best = (f) => cands.filter(f).sort((a, b) => Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5))[0];
  const picks = [];
  const simple = best((c) => c.sp.every((r) => r === "seer" || r === "doctor"));
  if (simple) picks.push(["Simple", simple.setup]);
  const classic = best((c) => c.sp.length === 3 && c !== simple);
  if (classic) picks.push(["Classic", classic.setup]);
  const full = n >= 8 ? best((c) => c.sp.length >= 4 && c.sp.indexOf("witch") >= 0 && c.sp.indexOf("hunter") >= 0) : null;
  if (full) picks.push(["Full", full.setup]);
  picks.push(["Rulebook", W.normalizeSetup({ wolf: W.rulebookWolves(rs, n), seer: 1 }, n)]);
  result[n] = picks.map(([name, setup], i) => {
    const r = W.simulateSetup(setup, FINAL, 777 + n * 13 + i, { opts });
    return { name, setup, village: Math.round(r.village * 1000) / 1000, games: FINAL };
  });
  console.log(rs, n, result[n].map((x) => x.name + " " + x.village).join(" | "));
}
fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "out", "setups-" + rs + ".json"), JSON.stringify(result));
console.log("done " + rs);
