// Mason and Prince (Ultimate Werewolf base roles), and the Smart computers' level and tells.
// WW_ENGINE=<path> runs these against another engine copy (used to see them fail on the old one).
const assert = require("assert");
const W = require(process.env.WW_ENGINE || "../js/engine.js");

const names = (n) => Array.from({ length: n }, (_, i) => "P" + i);
function seatGame(roles, opts) {
  return W.newGame(names(roles.length), countSetup(roles), { mode: "seats", roles, kinds: roles.map(() => "bot"), opts: Object.assign({ firstNightKill: false }, opts || {}) });
}
function countSetup(roles) { const s = {}; roles.forEach((r) => { s[r] = (s[r] || 0) + 1; }); return s; }

test("Prince voted out at the table: card shown, stays in, the day ends", () => {
  const roles = ["wolf", "seer", "prince", "villager", "villager", "villager"];
  let g = W.newGame(names(6), countSetup(roles), { roles, opts: { dayFirst: true } });
  for (let i = 0; i < 6; i++) g = W.apply(g, { type: "seen" });
  g = W.apply(g, { type: "start" });
  assert.strictEqual(g.phase, "day");
  g = W.apply(g, { type: "vote", target: 2 });
  assert.strictEqual(g.players[2].alive, true);
  assert.strictEqual(g.players[2].revealed, true);
  assert.strictEqual(g.phase, "dusk");
  assert.strictEqual(g.log[g.log.length - 1].t, "spared");
  // the table's odds now know the Prince is not a wolf
  assert.strictEqual(W.wolfOdds(W.oddsInfo(g, null)).odds[2], 0);
});

test("Prince voted out by ballots in a seat game stays in", () => {
  const roles = ["wolf", "seer", "prince", "villager", "villager", "villager"];
  let g = seatGame(roles, { dayFirst: true });
  g = W.apply(g, { type: "start" });
  [0, 1, 3, 4, 5].forEach((s) => { g = W.apply(g, { type: "ballot", seat: s, target: 2 }); });
  g = W.apply(g, { type: "ballot", seat: 2, target: 0 });
  assert.strictEqual(g.players[2].alive, true);
  assert.strictEqual(g.players[2].revealed, true);
  assert.strictEqual(g.phase, "dusk");
  assert.ok(g.log.some((e) => e.t === "spared" && e.target === 2 && e.ballots));
});

test("Masons see each other; nobody else sees them", () => {
  const roles = ["wolf", "mason", "mason", "seer", "villager", "villager"];
  const g = seatGame(roles);
  assert.strictEqual(W.view(g, 1).players[2].role, "mason");
  assert.strictEqual(W.view(g, 2).players[1].role, "mason");
  assert.strictEqual(W.view(g, 3).players[1].role, null);
  assert.strictEqual(W.view(g, 0).players[2].role, null);
  // a Mason's own odds clear the other Mason
  assert.strictEqual(W.wolfOdds(W.oddsInfo(g, 1)).odds[2], 0);
});

test("Masons wake (and only look) on the first table night", () => {
  const roles = ["wolf", "mason", "mason", "seer", "villager", "villager"];
  let g = W.newGame(names(6), countSetup(roles), { roles });
  for (let i = 0; i < 6; i++) g = W.apply(g, { type: "seen" });
  g = W.apply(g, { type: "start" });
  assert.strictEqual(W.currentStep(g), "mason");
  assert.deepStrictEqual(W.hostAction(g), { type: "done", seat: null, step: "mason" });
  const s = seatGame(roles); const s2 = W.apply(s, { type: "start" });
  assert.ok(s2.night.steps.indexOf("mason") < 0, "seat games skip the Mason step");
});

// Head-to-head between two levels in a team game: the mean of (village win as village)
// and (wolves win as wolves), each against the other level.
function h2h(a, b, games, seed) {
  const s = { wolf: 2, seer: 1, doctor: 1, villager: 4 };
  const o = W.RULESETS.ultimate.opts;
  const va = W.simulateSetup(s, games, seed, { villageLevel: a, wolfLevel: b, opts: o }).village;
  const vb = W.simulateSetup(s, games, seed + 1, { villageLevel: b, wolfLevel: a, opts: o }).village;
  return (va + 1 - vb) / 2;
}
test("Smart beats Normal at least 65% head to head (fair share, both sides)", () => {
  const p = h2h("smart", "normal", 500, 91);
  assert.ok(p >= 0.65, "smart vs normal " + p.toFixed(3));
});
test("Normal beats Easy at least 65% head to head", () => {
  const p = h2h("normal", "easy", 500, 93);
  assert.ok(p >= 0.65, "normal vs easy " + p.toFixed(3));
});

// A repeat player must not be able to learn "the second Seer claim is always the wolf":
// Smart wolves sometimes claim first.
test("Smart wolves sometimes make the first Seer claim", () => {
  let wolfFirst = 0, games = 0;
  for (let i = 0; i < 300; i++) {
    const rng = W.mulberry32(500 + i);
    const s = { wolf: 2, seer: 1, doctor: 1, villager: 4 };
    const g = W.newGame(names(8), s, { rng, mode: "seats", opts: W.RULESETS.ultimate.opts, kinds: Array(8).fill("bot") });
    g.players.forEach((p) => { p.level = "smart"; });
    let guard = 0;
    while (!g.winner && guard++ < 3000) {
      const h = W.hostAction(g);
      if (h) { W.applyMut(g, h); continue; }
      const a = W.nextBotMove(g, W.pendingActors(g), rng);
      if (!a) break;
      W.applyMut(g, a);
    }
    if (g.claims.length || g.log.some((e) => e.t === "claim")) {
      games++;
      const first = g.log.find((e) => e.t === "claim");
      if (g.players[first.by].role === "wolf") wolfFirst++;
    }
  }
  assert.ok(games > 50, "games with claims " + games);
  const share = wolfFirst / games;
  assert.ok(share > 0.1 && share < 0.9, "first claim by a wolf in " + wolfFirst + " of " + games);
});
