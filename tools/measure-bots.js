// "How strong?" — village win % for every pairing of computer levels, on the
// 8-player setup 2 wolves + Seer + Doctor + 4 villagers, Ultimate Werewolf rules.
// Writes tools/out/bots.json. Run: node tools/measure-bots.js
const fs = require("fs");
const path = require("path");
const W = require("../js/engine.js");
const setup = { wolf: 2, seer: 1, doctor: 1, villager: 4 };
const GAMES = { easy: 4000, normal: 4000, smart: 1500 };
const levels = ["easy", "normal", "smart"];
const table = {};
levels.forEach((v, vi) => {
  table[v] = {};
  levels.forEach((w, wi) => {
    const games = Math.min(GAMES[v], GAMES[w]);
    const r = W.simulateSetup(setup, games, 4242 + vi * 10 + wi, { villageLevel: v, wolfLevel: w, opts: W.RULESETS.ultimate.opts });
    table[v][w] = { village: Math.round(r.village * 1000) / 1000, games };
    console.log("village " + v + " vs wolves " + w + ": " + r.village.toFixed(3) + " (" + games + ")");
  });
});
fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "out", "bots.json"), JSON.stringify({ setup, rules: "ultimate", table }));
