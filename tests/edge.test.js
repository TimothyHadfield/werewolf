// Odd and rare rules moments (edge pass 2026-10-20).
const assert = require("assert");
const W = require("../js/engine.js");
const A = W.apply;

function game(roles, opts, mode, kinds) {
  const names = roles.map((_, i) => "ABCDEFGHIJKLMNOPQRST"[i]);
  const setup = {};
  roles.forEach((r) => { setup[r] = (setup[r] || 0) + 1; });
  return W.newGame(names, setup, { roles, opts: Object.assign({ firstNightKill: true }, opts || {}), mode: mode || "table", kinds });
}
function toNight(g) { while (g.phase === "reveal") g = A(g, { type: "seen" }); return A(g, { type: "start" }); }
function night(g, picks) {
  while (g.phase === "night") {
    const step = W.currentStep(g);
    if (!W.stepIsIdle(g, step)) {
      if (step === "witch") {
        const w = picks.witch || {};
        if (w.heal) g = A(g, { type: "pick", step, extra: "heal", target: true });
        if (w.poison != null) g = A(g, { type: "pick", step, extra: "poison", target: w.poison });
      } else if (picks[step] != null) g = A(g, { type: "pick", step, target: picks[step] });
    }
    g = A(g, { type: "done", step });
  }
  return g;
}
const seats = (roles, opts) => game(roles, opts, "seats", roles.map(() => "human"));
function voteAll(g, ballots) { Object.keys(ballots).forEach((s) => { g = A(g, { type: "ballot", seat: +s, target: ballots[s] }); }); return g; }

test("edge: everyone skips the vote, or skip ties a player: nobody goes out", () => {
  let g = A(seats(["wolf", "seer", "villager", "villager", "villager"], { dayFirst: true }), { type: "start" });
  let h = voteAll(g, { 0: null, 1: null, 2: null, 3: null, 4: null });
  assert.strictEqual(h.phase, "dusk"); assert.ok(h.players.every((p) => p.alive));
  h = voteAll(g, { 0: 2, 1: 2, 2: null, 3: null, 4: 0 });
  assert.ok(h.players.every((p) => p.alive), "2 votes vs 2 skips is a tie");
});

test("edge: a dead player can't vote, and nobody votes for themself", () => {
  let g = A(seats(["wolf", "seer", "villager", "villager", "villager"], { dayFirst: true }), { type: "start" });
  assert.throws(() => A(g, { type: "ballot", seat: 2, target: 2 }), /living/);
  g.players[3].alive = false;
  assert.throws(() => A(g, { type: "ballot", seat: 3, target: 0 }), /Dead/);
  assert.throws(() => A(g, { type: "ballot", seat: 2, target: 3 }), /living/);
});

test("edge: the Bodyguard with nobody allowed to guard can still finish the night", () => {
  let g = toNight(game(["bodyguard", "wolf", "villager", "villager"], { win: "all" }));
  g.players[2].alive = false; g.players[3].alive = false; g.mem.bgLast = 1;
  assert.deepStrictEqual(W.validTargets(g, "bodyguard"), []);
  g = A(g, { type: "done", step: "bodyguard" });
  assert.strictEqual(W.currentStep(g), "wolf");
  // seats mode: the Bodyguard's own seat can finish too
  let s = toNight(seats(["bodyguard", "wolf", "villager", "villager"], { win: "all" }));
  s.players[2].alive = false; s.players[3].alive = false; s.mem.bgLast = 1;
  s = A(s, { type: "done", seat: 0, step: "bodyguard" });
  assert.strictEqual(W.currentStep(s), "wolf");
});

test("edge: the last wolf and the last villager die the same night: all wolves are gone, so the village wins", () => {
  // Millers Hollow (wolves need everyone dead): wolf + witch + villager left
  let g = toNight(game(["wolf", "witch", "villager", "villager"], { win: "all" }));
  g.players[3].alive = false;
  g = night(g, { wolf: 2, witch: { poison: 0 } });
  assert.deepStrictEqual(g.lastDeaths.sort(), [0, 2]);
  assert.strictEqual(g.winner, "village");
});

test("edge: the voted-out Hunter's shot decides a game the wolves had already reached", () => {
  // wolf, hunter, villager: voting the Hunter out leaves 1 v 1 (wolves' parity), but the shot comes first
  let g = game(["wolf", "hunter", "villager", "villager"], { dayFirst: true });
  while (g.phase === "reveal") g = A(g, { type: "seen" });
  g = A(g, { type: "start" });
  g.players[3].alive = false;
  g = A(g, { type: "vote", target: 1 });
  assert.strictEqual(g.winner, null);
  assert.deepStrictEqual(g.pendingHunters, [1]);
  assert.throws(() => A(g, { type: "night" }), /Hunter/);
  const shot = A(g, { type: "shoot", by: 1, target: 0 });
  assert.strictEqual(shot.winner, "village");
  const air = A(g, { type: "shoot", by: 1, target: null });
  assert.strictEqual(air.winner, "wolves");
});

test("edge: the game can end on the very first day (Mafia: the only Mafia voted out)", () => {
  let g = game(["wolf", "seer", "villager", "villager"], { dayFirst: true });
  while (g.phase === "reveal") g = A(g, { type: "seen" });
  g = A(g, { type: "start" });
  g = A(g, { type: "vote", target: 0 });
  assert.strictEqual(g.winner, "village"); assert.strictEqual(g.day, 1);
  assert.throws(() => A(g, { type: "night" }), /over/);
});

test("edge: min and max table sizes deal and start", () => {
  const g4 = W.newGame(["a", "b", "c", "d"], { wolf: 1, seer: 1 }, {});
  assert.strictEqual(g4.players.length, 4);
  const names = []; for (let i = 0; i < 20; i++) names.push("P" + i);
  const g20 = W.newGame(names, { wolf: 4, seer: 1, doctor: 1, bodyguard: 1, witch: 1, hunter: 1 }, {});
  assert.strictEqual(g20.players.filter((p) => p.role === "villager").length, 11);
  assert.throws(() => W.newGame(names.concat("x"), { wolf: 4 }, {}), /20/);
  assert.throws(() => W.newGame(["a", "b", "c"], { wolf: 1 }, {}), /4/);
});

test("edge: a seat can only take back its own claim", () => {
  let g = A(seats(["wolf", "seer", "villager", "villager", "villager"], { dayFirst: true }), { type: "start" });
  g = A(g, { type: "claim", seat: 1, target: 0, wolf: true });
  assert.throws(() => A(g, { type: "unclaim", seat: 0, index: 0 }), /own/);
  assert.strictEqual(A(g, { type: "unclaim", seat: 1, index: 0 }).claims.length, 0);
});

test("edge: every computer-only game ends, at every size and rule set (no stalemate)", () => {
  const rng = W.mulberry32(77);
  ["ultimate", "millers", "mafia"].forEach((rs) => {
    for (let n = 5; n <= 20; n += 3) {
      const w = W.rulebookWolves(rs, n);
      const setup = W.normalizeSetup({ wolf: w, seer: 1, doctor: 1, bodyguard: n >= 8 ? 1 : 0, witch: n >= 8 ? 1 : 0, hunter: n >= 8 ? 1 : 0 }, n);
      for (let k = 0; k < 20; k++) assert.ok(W.simulateGame(setup, { rng, opts: W.RULESETS[rs].opts }), rs + " " + n + " ended");
    }
  });
});
