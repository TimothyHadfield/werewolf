// Tanner, Minion and Lycan (Ultimate Werewolf base roles, added 10-28).
// WW_ENGINE=<path> runs these against another engine copy (used to see them fail on the old one).
// Run alone: node -e "global.test=(n,f)=>{try{f();console.log('ok',n)}catch(e){console.log('FAIL',n,e.message)}};require('./tests/roles3.test.js')"
const assert = require("assert");
const W = require(process.env.WW_ENGINE || "../js/engine.js");
const near = (a, b, eps) => assert.ok(Math.abs(a - b) < (eps || 1e-9), a + " vs " + b);

const names = (n) => Array.from({ length: n }, (_, i) => "P" + i);
function countSetup(roles) { const s = {}; roles.forEach((r) => { s[r] = (s[r] || 0) + 1; }); return s; }
function seatGame(roles, opts) {
  return W.newGame(names(roles.length), countSetup(roles), { mode: "seats", roles, kinds: roles.map(() => "bot"), opts: Object.assign({ firstNightKill: false }, opts || {}) });
}
function tableGame(roles, opts) {
  let g = W.newGame(names(roles.length), countSetup(roles), { roles, opts: opts || {} });
  while (g.phase === "reveal") g = W.apply(g, { type: "seen" });
  return W.apply(g, { type: "start" });
}

test("the three roles exist, with their teams and printed points", () => {
  ["tanner", "minion", "lycan"].forEach((r) => assert.ok(W.ROLE_KEYS.indexOf(r) >= 0, r + " missing"));
  assert.strictEqual(W.TEAM.minion, "wolves");
  assert.strictEqual(W.TEAM.lycan, "village");
  assert.strictEqual(W.TEAM.tanner, "tanner");
  assert.deepStrictEqual([W.UW_POINTS.tanner, W.UW_POINTS.minion, W.UW_POINTS.lycan], [1, -6, -1]);
  assert.strictEqual(W.ROLE_KEYS[W.ROLE_KEYS.length - 1], "villager");
});

test("Tanner voted out at the table: the Tanner has won, and the game goes on", () => {
  const g0 = tableGame(["wolf", "seer", "tanner", "villager", "villager", "villager"], { dayFirst: true });
  assert.ok(!g0.tannerWon);
  const g = W.apply(g0, { type: "vote", target: 2 });
  assert.strictEqual(g.tannerWon, true);
  assert.strictEqual(g.winner, null);
  assert.strictEqual(g.phase, "dusk");
  // the Tanner's win stays hidden from nobody: the card is shown on death like any other
  assert.strictEqual(W.view(g, 0).tannerWon, true);
});

test("Tanner killed by the wolves at night also wins", () => {
  let g = tableGame(["wolf", "seer", "tanner", "villager", "villager", "villager"], { firstNightKill: true });
  g = W.apply(g, { type: "pick", step: "seer", target: 3 });
  g = W.apply(g, { type: "done", step: "seer" });
  g = W.apply(g, { type: "pick", step: "wolf", target: 2 });
  g = W.apply(g, { type: "done", step: "wolf" });
  assert.strictEqual(g.tannerWon, true);
  assert.strictEqual(g.winner, null);
});

test("Tanner shot by the Hunter wins; the Tanner counts as one of the others for parity", () => {
  let g = seatGame(["wolf", "hunter", "tanner", "villager", "villager", "villager", "villager"], { dayFirst: true });
  g = W.apply(g, { type: "start" });
  [0, 2, 3, 4, 5, 6].forEach((s) => { g = W.apply(g, { type: "ballot", seat: s, target: 1 }); });
  g = W.apply(g, { type: "ballot", seat: 1, target: 0 });
  assert.deepStrictEqual(g.pendingHunters, [1]);
  g = W.apply(g, { type: "shoot", seat: 1, target: 2 });
  assert.strictEqual(g.tannerWon, true);
  assert.strictEqual(W.winnerNow({ players: [{ alive: true, role: "wolf" }, { alive: true, role: "tanner" }], opts: { win: "parity" } }), "wolves");
});

test("Minion sees the wolves; the wolves and the Seer don't see the Minion", () => {
  const roles = ["wolf", "wolf", "minion", "seer", "villager", "villager", "villager", "villager"];
  const g = seatGame(roles);
  assert.strictEqual(W.view(g, 2).players[0].role, "wolf");
  assert.strictEqual(W.view(g, 2).players[1].role, "wolf");
  assert.strictEqual(W.view(g, 0).players[2].role, null);
  assert.strictEqual(W.view(g, 3).players[2].role, null);
  // The Minion's own odds know both wolves
  const o = W.wolfOdds(W.oddsInfo(g, 2)).odds;
  near(o[0], 1); near(o[1], 1); near(o[4], 0);
});

test("the Seer sees the Minion as not a wolf and the Lycan as a wolf (both rule styles)", () => {
  const roles = ["wolf", "minion", "lycan", "seer", "villager", "villager", "villager"];
  ["team", "role"].forEach((seerSees) => {
    const toSeer = (x) => W.apply(x, { type: "done", step: "minion" }); // the Minion's look-only step comes first
    let g = toSeer(tableGame(roles, { firstNightKill: true, seerSees }));
    g = W.apply(g, { type: "pick", step: "seer", target: 1 });
    let r = g.seerLog[g.seerLog.length - 1];
    assert.strictEqual(r.wolf, false);
    if (seerSees === "role") assert.strictEqual(r.role, "villager");
    g = toSeer(tableGame(roles, { firstNightKill: true, seerSees }));
    g = W.apply(g, { type: "pick", step: "seer", target: 2 });
    r = g.seerLog[g.seerLog.length - 1];
    assert.strictEqual(r.wolf, true);
    if (seerSees === "role") assert.strictEqual(r.role, "wolf");
  });
});

test("Minion wins with the wolves even when dead; parity counts the Minion as one of the others", () => {
  let g = seatGame(["wolf", "minion", "villager", "villager", "villager"], { dayFirst: true });
  g = W.apply(g, { type: "start" });
  // vote out the Minion: 1 wolf vs 3 villagers left, game goes on
  [0, 2, 3, 4].forEach((s) => { g = W.apply(g, { type: "ballot", seat: s, target: 1 }); });
  g = W.apply(g, { type: "ballot", seat: 1, target: 2 });
  assert.strictEqual(g.winner, null);
  assert.strictEqual(W.winnerNow({ players: [{ alive: true, role: "wolf" }, { alive: true, role: "minion" }], opts: { win: "parity" } }), "wolves");
  assert.strictEqual(W.winnerNow({ players: [{ alive: true, role: "wolf" }, { alive: true, role: "minion" }, { alive: true, role: "villager" }], opts: { win: "parity" } }), null);
});

test("Minion learns the wolves on the first table night (a look-only step)", () => {
  const g = tableGame(["wolf", "minion", "seer", "villager", "villager", "villager"]);
  assert.strictEqual(W.currentStep(g), "minion");
  assert.deepStrictEqual(W.hostAction(g), { type: "done", seat: null, step: "minion" });
  const s = W.apply(seatGame(["wolf", "minion", "seer", "villager", "villager", "villager"]), { type: "start" });
  assert.ok(s.night.steps.indexOf("minion") < 0, "seat games show the wolves on the card instead");
});

// Independent brute force over every deal, Lycan included: a real Seer's claim
// must match what the Seer would SEE (wolf or Lycan = "wolf").
function brute(info, weights) {
  const ids = info.players.map((p) => p.id);
  const cards = [];
  Object.keys(info.setup).forEach((k) => { for (let i = 0; i < info.setup[k]; i++) cards.push(k); });
  const tally = {}; ids.forEach((id) => { tally[id] = 0; });
  let total = 0;
  const seen = new Set();
  (function perm(arr, k) {
    if (k === arr.length) {
      const key = arr.join(","); if (seen.has(key)) return; seen.add(key);
      for (const p of info.players) {
        const r = arr[p.id];
        if (p.known === "notwolf") { if (r === "wolf" || r === "lycan") return; }
        else if (p.known && p.known !== r) return;
      }
      let w = 1;
      for (const c of info.claims) {
        const r = arr[c.by], t = arr[c.target];
        if (r === "seer") { if ((t === "wolf" || t === "lycan") !== c.wolf) { w = 0; break; } }
        else if (r === "wolf") w *= weights.wolf;
        else w *= weights.other;
      }
      if (!w) return;
      total += w;
      ids.forEach((id) => { if (arr[id] === "wolf") tally[id] += w; });
      return;
    }
    for (let i = k; i < arr.length; i++) { [arr[k], arr[i]] = [arr[i], arr[k]]; perm(arr, k + 1); [arr[k], arr[i]] = [arr[i], arr[k]]; }
  })(cards.slice(), 0);
  const o = {}; ids.forEach((id) => { o[id] = tally[id] / total; });
  return o;
}

test("hand-worked: with a Lycan, a Seer's 'X is a wolf' is no longer proof", () => {
  // 5 players: wolf, seer, lycan, 2 villagers. A (0) says B (1) is a wolf; table knows nothing else.
  const info = { players: [0, 1, 2, 3, 4].map((id) => ({ id, known: null })), setup: { wolf: 1, seer: 1, lycan: 1, villager: 2 }, claims: [{ by: 0, target: 1, wolf: true }] };
  const r = W.wolfOdds(info);
  const b = brute(info, W.CLAIM_WEIGHTS);
  [0, 1, 2, 3, 4].forEach((id) => near(r.odds[id], b[id]));
  assert.ok(r.odds[1] < 0.9, "B must not be a sure wolf: " + r.odds[1]);
});

test("odds with a Lycan / Minion / Tanner match brute force on random small tables", () => {
  const rng = W.mulberry32(77);
  let compared = 0;
  for (let trial = 0; trial < 80; trial++) {
    const n = 5 + Math.floor(rng() * 3);
    const setup = { wolf: 1 + (rng() < 0.3 ? 1 : 0), seer: 1, lycan: rng() < 0.8 ? 1 : 0, minion: rng() < 0.4 ? 1 : 0, tanner: rng() < 0.3 ? 1 : 0 };
    setup.villager = n - setup.wolf - 1 - setup.lycan - setup.minion - setup.tanner;
    if (setup.villager < 0) continue;
    const cards = W.shuffle(Object.keys(setup).flatMap((k) => Array(setup[k]).fill(k)), rng);
    const players = cards.map((r, id) => ({ id, known: rng() < 0.2 ? r : null }));
    const claims = [];
    const nc = Math.floor(rng() * 3);
    for (let i = 0; i < nc; i++) {
      const by = Math.floor(rng() * n); let t = Math.floor(rng() * n); if (t === by) t = (t + 1) % n;
      claims.push({ by, target: t, wolf: rng() < 0.5 });
    }
    const info = { players, setup, claims };
    const r = W.wolfOdds(info);
    if (!r.total) continue;
    const b = brute(info, W.CLAIM_WEIGHTS);
    players.forEach((p) => near(r.odds[p.id], b[p.id], 1e-9));
    compared++;
  }
  assert.ok(compared > 30, "compared " + compared);
});

test("a Seer's own 'wolf' result is not proof when a Lycan is in the game", () => {
  const roles = ["seer", "lycan", "wolf", "villager", "villager"];
  let g = tableGame(roles, { firstNightKill: true });
  g = W.apply(g, { type: "pick", step: "seer", target: 1 });
  const mine = W.wolfOdds(W.oddsInfo(g, 0)).odds;
  // B is the wolf (Lycan in one of 3 seats) or the Lycan (wolf in one of 3 seats): even
  near(mine[1], 0.5);
  [2, 3, 4].forEach((id) => near(mine[id], 1 / 6));
});

// Computers: every new role plays a full game with every level, and the ladder holds with them in.
test("computers finish games with the new roles at every level", () => {
  const s = { wolf: 2, minion: 1, seer: 1, doctor: 1, lycan: 1, tanner: 1, villager: 2 };
  const res = { village: 0, wolves: 0, tanner: 0 };
  ["easy", "normal", "smart"].forEach((lv, i) => {
    const rng = W.mulberry32(300 + i);
    for (let k = 0; k < 60; k++) {
      const g = W.simulateGame(s, { rng, villageLevel: lv, wolfLevel: lv, opts: W.RULESETS.ultimate.opts, full: true });
      assert.ok(g.winner === "village" || g.winner === "wolves", "winner " + g.winner);
      res[g.winner]++;
      if (g.tannerWon) res.tanner++;
    }
  });
  assert.ok(res.village > 0 && res.wolves > 0 && res.tanner > 0, JSON.stringify(res));
});

test("a Smart Minion helps its wolves more than an Easy one (everyone else Normal)", () => {
  const s = { wolf: 2, minion: 1, seer: 1, doctor: 1, villager: 4 };
  const o = W.RULESETS.ultimate.opts;
  const smart = W.simulateSetup(s, 1500, 41, { villageLevel: "normal", wolfLevel: "normal", levels: { minion: "smart" }, opts: o }).village;
  const easy = W.simulateSetup(s, 1500, 41, { villageLevel: "normal", wolfLevel: "normal", levels: { minion: "easy" }, opts: o }).village;
  assert.ok(smart < easy - 0.02, "village vs smart Minion " + smart.toFixed(3) + ", vs easy Minion " + easy.toFixed(3));
});

test("a Smart Tanner wins more often than an Easy one (everyone else Normal)", () => {
  const s = { wolf: 2, tanner: 1, seer: 1, doctor: 1, villager: 4 };
  const o = W.RULESETS.ultimate.opts;
  const run = (lv) => { const rng = W.mulberry32(55); let t = 0; for (let i = 0; i < 1500; i++) if (W.simulateGame(s, { rng, levels: { tanner: lv }, opts: o, full: true }).tannerWon) t++; return t / 1500; };
  const smart = run("smart"), easy = run("easy");
  assert.ok(smart > easy + 0.02, "tanner wins smart " + smart.toFixed(3) + ", easy " + easy.toFixed(3));
});

// The level ladder holds with the new roles in the game (fair share, both sides).
function h2h(s, a, b, games, seed) {
  const o = W.RULESETS.ultimate.opts;
  const va = W.simulateSetup(s, games, seed, { villageLevel: a, wolfLevel: b, opts: o }).village;
  const vb = W.simulateSetup(s, games, seed + 1, { villageLevel: b, wolfLevel: a, opts: o }).village;
  return (va + 1 - vb) / 2;
}
test("ladder with Lycan + Minion + Tanner in: Smart > Normal > Easy", () => {
  const s = { wolf: 2, minion: 1, seer: 1, doctor: 1, lycan: 1, tanner: 1, villager: 3 };
  const sn = h2h(s, "smart", "normal", 600, 61), ne = h2h(s, "normal", "easy", 600, 63);
  assert.ok(sn > 0.55, "smart vs normal " + sn.toFixed(3));
  assert.ok(ne > 0.55, "normal vs easy " + ne.toFixed(3));
});
