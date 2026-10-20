const assert = require("assert");
const W = require("../js/engine.js");

// Fixed deal: names A..H with chosen roles, table mode.
function game(roles, opts, mode) {
  const names = roles.map((_, i) => "ABCDEFGHIJKLMNOP"[i]);
  const setup = {};
  roles.forEach((r) => { setup[r] = (setup[r] || 0) + 1; });
  return W.newGame(names, setup, { roles, opts: Object.assign({ firstNightKill: true }, opts || {}), mode: mode || "table" });
}
const A = W.apply;
function toNight(g) {
  while (g.phase === "reveal") g = A(g, { type: "seen" });
  return A(g, { type: "start" });
}
// Run the table-mode night with picks {step: target}; witch: {heal:bool, poison:id|null}
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

test("deal uses exactly the setup's cards", () => {
  const g = W.newGame(["a", "b", "c", "d", "e", "f", "g", "h"], { wolf: 2, seer: 1, doctor: 1 }, { rng: W.mulberry32(3) });
  const c = {};
  g.players.forEach((p) => { c[p.role] = (c[p.role] || 0) + 1; });
  assert.deepStrictEqual(c, { wolf: 2, seer: 1, doctor: 1, villager: 4 });
});

test("setup checks", () => {
  assert.ok(W.setupProblem(W.normalizeSetup({ wolf: 3 }, 6), 6)); // 3 of 6 is too many
  assert.strictEqual(W.setupProblem(W.normalizeSetup({ wolf: 2, seer: 1 }, 5), 5), null);
  assert.ok(W.setupProblem({ wolf: 1, seer: 1, villager: 5 }, 5));
});

test("night order is Seer, Doctor, Bodyguard, Wolves, Witch (only roles in the setup)", () => {
  const g = toNight(game(["wolf", "witch", "seer", "villager", "villager"]));
  assert.deepStrictEqual(g.night.steps, ["seer", "wolf", "witch"]);
});

test("wolf kill happens; doctor guard stops it", () => {
  let g = toNight(game(["wolf", "doctor", "villager", "villager", "villager"]));
  let h = night(g, { wolf: 2, doctor: 3 });
  assert.deepStrictEqual(h.lastDeaths, [2]);
  assert.strictEqual(h.players[2].alive, false);
  h = night(g, { wolf: 2, doctor: 2 });
  assert.deepStrictEqual(h.lastDeaths, []);
});

test("doctor can't guard the same player two nights running (unless the switch allows it)", () => {
  let g = toNight(game(["wolf", "doctor", "villager", "villager", "villager", "villager", "villager"]));
  g = night(g, { wolf: 2, doctor: 4 });
  g = A(g, { type: "day" }); g = A(g, { type: "noVote" }); g = A(g, { type: "night" });
  assert.ok(W.validTargets(g, "doctor").indexOf(4) < 0);
  assert.throws(() => A(g, { type: "pick", step: "doctor", target: 4 }));
  let g2 = toNight(game(["wolf", "doctor", "villager", "villager", "villager", "villager", "villager"], { guardRepeat: true }));
  g2 = night(g2, { wolf: 2, doctor: 4 });
  g2 = A(g2, { type: "day" }); g2 = A(g2, { type: "noVote" }); g2 = A(g2, { type: "night" });
  assert.ok(W.validTargets(g2, "doctor").indexOf(4) >= 0);
});

test("doctor self-guard follows the switch; bodyguard never guards self", () => {
  const g = toNight(game(["wolf", "doctor", "bodyguard", "villager", "villager", "villager"]));
  assert.ok(W.validTargets(g, "doctor").indexOf(1) >= 0);
  assert.ok(W.validTargets(g, "bodyguard").indexOf(2) < 0);
  const g2 = toNight(game(["wolf", "doctor", "villager", "villager", "villager"], { doctorSelf: false }));
  assert.ok(W.validTargets(g2, "doctor").indexOf(1) < 0);
});

test("witch heal saves once per game; poison kills and can't be guarded", () => {
  let g = toNight(game(["wolf", "witch", "doctor", "villager", "villager", "villager", "villager"]));
  g = night(g, { wolf: 3, doctor: 4, witch: { heal: true, poison: null } });
  assert.deepStrictEqual(g.lastDeaths, []);
  assert.strictEqual(g.mem.healUsed, true);
  g = A(g, { type: "day" }); g = A(g, { type: "noVote" }); g = A(g, { type: "night" });
  // victim 3 again, heal no longer offered; poison 5 who the doctor guards
  g = night(g, { wolf: 3, doctor: 5, witch: { poison: 5 } });
  assert.deepStrictEqual(g.lastDeaths.sort(), [3, 5]);
  assert.strictEqual(g.mem.poisonUsed, true);
});

test("witch self-heal and both-potions switches", () => {
  let g = toNight(game(["wolf", "witch", "villager", "villager", "villager"], { witchSelfHeal: false }));
  g = A(g, { type: "pick", step: "wolf", target: 1 }); g = A(g, { type: "done", step: "wolf" });
  assert.strictEqual(W.canHeal(g), false);
  let h = toNight(game(["wolf", "witch", "villager", "villager", "villager"], { witchBoth: false }));
  h = A(h, { type: "pick", step: "wolf", target: 2 }); h = A(h, { type: "done", step: "wolf" });
  h = A(h, { type: "pick", step: "witch", extra: "heal", target: true });
  assert.deepStrictEqual(W.validTargets(h, "witch", "poison"), []);
});

test("first night: wolves only meet when the switch is off", () => {
  const g = toNight(game(["wolf", "villager", "villager", "villager", "villager"], { firstNightKill: false }));
  assert.strictEqual(W.stepIsIdle(g, "wolf"), true);
  assert.throws(() => A(g, { type: "pick", step: "wolf", target: 1 }));
  const h = A(g, { type: "done", step: "wolf" });
  assert.deepStrictEqual(h.lastDeaths, []);
});

test("parity win vs last-villager win", () => {
  // 2 wolves, 3 villagers; wolves kill one -> 2 v 2
  let g = toNight(game(["wolf", "wolf", "villager", "villager", "villager"]));
  g = night(g, { wolf: 2 });
  assert.strictEqual(g.winner, "wolves");
  let h = toNight(game(["wolf", "wolf", "villager", "villager", "villager"], { win: "all" }));
  h = night(h, { wolf: 2 });
  assert.strictEqual(h.winner, null);
});

test("village wins when the last wolf is voted out", () => {
  let g = toNight(game(["wolf", "seer", "villager", "villager", "villager"]));
  g = night(g, { seer: 0, wolf: 2 });
  g = A(g, { type: "day" });
  g = A(g, { type: "vote", target: 0 });
  assert.strictEqual(g.winner, "village");
  assert.strictEqual(g.phase, "over");
});

test("hunter shoots before the game is called (and can fire into the air)", () => {
  let g = toNight(game(["wolf", "wolf", "hunter", "villager", "villager", "villager"]));
  g = night(g, { wolf: 2 }); // hunter dies: 2 wolves v 3 others, hunter pending
  assert.deepStrictEqual(g.pendingHunters, [2]);
  assert.throws(() => A(g, { type: "day" }));
  const g1 = A(g, { type: "shoot", by: 2, target: 0 });
  assert.strictEqual(g1.players[0].alive, false);
  const g2 = A(g, { type: "shoot", by: 2, target: null });
  assert.strictEqual(g2.pendingHunters.length, 0);
  // voted-out hunter at parity: the shot can still save the village
  let h = toNight(game(["wolf", "hunter", "villager", "villager"]));
  h = night(h, { wolf: 2 }); h = A(h, { type: "day" });
  h = A(h, { type: "vote", target: 1 }); // 1 wolf v 1 villager -> would be parity
  assert.strictEqual(h.winner, null);
  h = A(h, { type: "shoot", by: 1, target: 0 });
  assert.strictEqual(h.winner, "village");
});

test("seats mode: wolves must agree; ballots tally", () => {
  let g = game(["wolf", "wolf", "villager", "villager", "villager", "villager", "villager"], {}, "seats");
  g = A(g, { type: "start" });
  assert.deepStrictEqual(W.pendingActors(g), [0, 1]);
  g = A(g, { type: "pick", seat: 0, step: "wolf", target: 3 });
  g = A(g, { type: "pick", seat: 1, step: "wolf", target: 4 });
  assert.strictEqual(g.phase, "night");
  assert.throws(() => A(g, { type: "pick", seat: 2, step: "wolf", target: 4 }));
  g = A(g, { type: "pick", seat: 0, step: "wolf", target: 4 });
  assert.strictEqual(g.phase, "morning");
  assert.deepStrictEqual(g.lastDeaths, [4]);
  g = A(g, W.hostAction(g));
  // 6 alive: player 2 gets 3 votes, player 3 gets 2, player 0 gets 1
  [[0, 2], [1, 2], [5, 2], [2, 3], [3, 0], [6, 3]].forEach(([s, t]) => { g = A(g, { type: "ballot", seat: s, target: t }); });
  assert.strictEqual(g.phase, "dusk");
  assert.strictEqual(g.players[2].alive, false);
  assert.strictEqual(g.players.filter((p) => p.alive).length, 5);
});

test("seats mode plurality: most votes goes out", () => {
  let g = game(["wolf", "villager", "villager", "villager", "villager"], { firstNightKill: false }, "seats");
  g = A(g, { type: "start" });
  g = A(g, W.hostAction(g)); // idle wolf step
  g = A(g, W.hostAction(g)); // morning -> day
  [[0, 1], [1, 0], [2, 0], [3, 2], [4, 0]].forEach(([s, t]) => { g = A(g, { type: "ballot", seat: s, target: t }); });
  assert.strictEqual(g.winner, "village");
  const v = g.log.find((e) => e.t === "vote");
  assert.deepStrictEqual(v.counts, { 0: 3, 1: 1, 2: 1 });
});

test("tie really sends nobody out", () => {
  let g = game(["wolf", "villager", "villager", "villager"], { firstNightKill: false }, "seats");
  g = A(g, { type: "start" }); g = A(g, W.hostAction(g)); g = A(g, W.hostAction(g));
  [[0, 1], [1, 0], [2, 1], [3, 0]].forEach(([s, t]) => { g = A(g, { type: "ballot", seat: s, target: t }); });
  assert.strictEqual(g.players.filter((p) => p.alive).length, 4);
  assert.strictEqual(g.log[g.log.length - 1].tie, true);
});

test("a seat can only act for itself", () => {
  let g = game(["wolf", "seer", "villager", "villager", "villager"], {}, "seats");
  g = A(g, { type: "start" });
  assert.throws(() => A(g, { type: "pick", seat: 2, step: "seer", target: 0 }));
  g = A(g, { type: "pick", seat: 1, step: "seer", target: 0 });
  assert.strictEqual(g.seerLog[0].wolf, true);
});

test("Seer sees the exact card under Millers Hollow rules", () => {
  let g = toNight(game(["wolf", "seer", "doctor", "villager", "villager"], W.RULESETS.millers.opts));
  g = A(g, { type: "pick", step: "seer", target: 2 });
  assert.strictEqual(g.seerLog[0].role, "doctor");
});

test("view hides other cards, shows wolf partners, hides secrets until the end", () => {
  let g = toNight(game(["wolf", "wolf", "seer", "villager", "villager", "villager", "villager"]));
  g = night(g, { seer: 0, wolf: 3 });
  const v2 = W.view(g, 2);
  assert.strictEqual(v2.players[0].role, null);
  assert.strictEqual(v2.players[2].role, "seer");
  assert.strictEqual(v2.players[3].role, "villager"); // revealed on death
  assert.strictEqual(v2.seerLog.length, 1);
  assert.ok(!v2.log.some((e) => e.t === "secret"));
  const v0 = W.view(g, 0);
  assert.strictEqual(v0.players[1].role, "wolf");
  assert.strictEqual(v0.players[2].role, null);
  assert.strictEqual(v0.seerLog.length, 0);
  const vt = W.view(g, null);
  assert.ok(vt.players.every((p) => p.role === null || p.revealed));
});

test("no-reveal switch keeps dead cards hidden", () => {
  let g = toNight(game(["wolf", "villager", "villager", "villager", "villager"], { reveal: false }));
  g = night(g, { wolf: 2 });
  assert.strictEqual(W.view(g, null).players[2].role, null);
});

test("UW points and rulebook wolf tables", () => {
  assert.strictEqual(W.uwPoints({ wolf: 2, seer: 1, villager: 5 }), -12 + 7 + 5);
  assert.strictEqual(W.rulebookWolves("millers", 8), 2);
  assert.strictEqual(W.rulebookWolves("millers", 12), 3);
  assert.strictEqual(W.rulebookWolves("ultimate", 8), 1);
  assert.strictEqual(W.rulebookWolves("ultimate", 9), 2);
});
