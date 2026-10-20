const assert = require("assert");
const W = require("../js/engine.js");
const near = (a, b, eps) => assert.ok(Math.abs(a - b) < (eps || 1e-9), a + " vs " + b);

// Independent brute force: every distinct deal of the setup's cards to the
// players, weighted the same way, kept if it matches the known roles.
function brute(info, weights) {
  const ids = info.players.map((p) => p.id);
  const cards = [];
  Object.keys(info.setup).forEach((k) => { for (let i = 0; i < info.setup[k]; i++) cards.push(k); });
  const tally = {}; ids.forEach((id) => { tally[id] = 0; });
  let total = 0;
  const seen = new Set();
  (function perm(arr, k) {
    if (k === arr.length) {
      const key = arr.join(",");
      if (seen.has(key)) return; seen.add(key);
      for (const p of info.players) {
        const r = arr[p.id];
        if (p.known === "notwolf") { if (r === "wolf") return; }
        else if (p.known && p.known !== r) return;
      }
      let w = 1;
      for (const c of info.claims) {
        const r = arr[c.by];
        if (r === "seer") { if ((arr[c.target] === "wolf") !== c.wolf) { w = 0; break; } }
        else if (r === "wolf") w *= weights.wolf;
        else w *= weights.other;
      }
      if (!w) return;
      total += w;
      ids.forEach((id) => { if (arr[id] === "wolf") tally[id] += w; });
      return;
    }
    for (let i = k; i < arr.length; i++) {
      [arr[k], arr[i]] = [arr[i], arr[k]];
      perm(arr, k + 1);
      [arr[k], arr[i]] = [arr[i], arr[k]];
    }
  })(cards.slice(), 0);
  const o = {}; ids.forEach((id) => { o[id] = tally[id] / total; });
  return o;
}

test("no info: every player has wolves / players", () => {
  const info = { players: [0, 1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, known: null })), setup: { wolf: 2, seer: 1, villager: 5 }, claims: [] };
  const o = W.wolfOdds(info).odds;
  Object.values(o).forEach((p) => near(p, 0.25));
});

test("a revealed dead villager spreads the odds over the rest", () => {
  const info = { players: [0, 1, 2, 3, 4].map((id) => ({ id, known: id === 4 ? "villager" : null })), setup: { wolf: 1, seer: 1, villager: 3 }, claims: [] };
  const o = W.wolfOdds(info).odds;
  near(o[4], 0); [0, 1, 2, 3].forEach((id) => near(o[id], 0.25));
});

test("hand-worked Seer claim: A says B is not a wolf (5 players, 1 wolf, 1 seer)", () => {
  // Pairs (wolf, seer): A real Seer -> wolf in {C,D,E}: 3 x 1. A wolf -> seer in {B..E}: 4 x 0.5 = 2.
  // A neither -> 4 wolves x 3 seers x 0.05 = 0.6. Total 5.6.
  const info = { players: [0, 1, 2, 3, 4].map((id) => ({ id, known: null })), setup: { wolf: 1, seer: 1, villager: 3 }, claims: [{ by: 0, target: 1, wolf: false }] };
  const o = W.wolfOdds(info).odds;
  near(o[0], 2 / 5.6);
  near(o[1], 0.15 / 5.6);
  near(o[2], 1.15 / 5.6);
  near(o[0] + o[1] + o[2] + o[3] + o[4], 1);
});

test("odds match brute force on many random small tables", () => {
  const rng = W.mulberry32(99);
  for (let trial = 0; trial < 60; trial++) {
    const n = 5 + Math.floor(rng() * 3);
    const wolves = 1 + Math.floor(rng() * 2);
    const setup = { wolf: wolves, seer: 1, doctor: rng() < 0.5 ? 1 : 0 };
    setup.villager = n - wolves - 1 - setup.doctor;
    const cards = W.shuffle(Object.keys(setup).flatMap((k) => Array(setup[k]).fill(k)), rng);
    const players = cards.map((r, id) => ({ id, known: rng() < 0.2 ? r : null }));
    const claims = [];
    const nc = Math.floor(rng() * 3);
    for (let i = 0; i < nc; i++) {
      const by = Math.floor(rng() * n); let t = Math.floor(rng() * n); if (t === by) t = (t + 1) % n;
      claims.push({ by, target: t, wolf: rng() < 0.4 });
    }
    const info = { players, setup, claims };
    const r = W.wolfOdds(info);
    if (!r.total) continue; // contradiction -> fallback, nothing to compare
    const b = brute(info, W.CLAIM_WEIGHTS);
    players.forEach((p) => near(r.odds[p.id], b[p.id], 1e-9));
  }
});

test("a Seer's own private results count only in their own odds", () => {
  let g = W.newGame(["a", "b", "c", "d", "e"], { wolf: 1, seer: 1 }, { roles: ["seer", "wolf", "villager", "villager", "villager"], opts: { firstNightKill: true } });
  while (g.phase === "reveal") g = W.apply(g, { type: "seen" });
  g = W.apply(g, { type: "start" });
  g = W.apply(g, { type: "pick", step: "seer", target: 1 });
  const mine = W.wolfOdds(W.oddsInfo(g, 0)).odds;
  const table = W.wolfOdds(W.oddsInfo(g, null)).odds;
  near(mine[1], 1);
  near(table[1], 0.2);
});
