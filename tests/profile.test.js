// My stats: what one game vs computers turns into (js/wwprofile.js), and the guided first game's deal (js/wwcoach.js).
const assert = require("assert");
const W = require("../js/engine.js");
const WP = require("../js/wwprofile.js");
const WC = require("../js/wwcoach.js");

function play(roles, level, seed) {
  const n = roles.length;
  const setup = {}; roles.forEach((r) => { setup[r] = (setup[r] || 0) + 1; });
  const rng = W.mulberry32(seed);
  const g = W.newGame(Array.from({ length: n }, (_, i) => "P" + i), setup, { rng, roles, mode: "seats", opts: W.RULESETS.ultimate.opts, kinds: roles.map((_, i) => (i ? "bot" : "human")) });
  g.players.forEach((p) => { if (p.id) p.level = level; });
  let guard = 0;
  while (!g.winner && guard++ < 3000) {
    const h = W.hostAction(g);
    if (h) { W.applyMut(g, h); continue; }
    const a = W.nextBotMove(g, W.pendingActors(g), rng, () => true);
    if (!a) break;
    W.applyMut(g, a);
  }
  return g;
}

test("a finished game vs Smart computers is rated at Smart, win or loss by your team", () => {
  const g = play(["seer", "wolf", "villager", "villager", "doctor", "villager"], "smart", 3);
  assert.ok(g.winner);
  const r = WP.result(g, 0, {});
  assert.strictEqual(r.mode, "computer");
  assert.strictEqual(r.level, "smart");
  assert.strictEqual(r.won, g.winner === "village");
  assert.strictEqual(r.extra.team, "village");
  assert.ok(!r.extra.quit);
});

test("Hint or Undo makes it 'with help' (not rated); a game left unfinished is a loss", () => {
  const g = play(["wolf", "seer", "villager", "villager", "doctor", "villager"], "normal", 5);
  const r = WP.result(g, 0, { helped: true });
  assert.strictEqual(r.mode, "help");
  assert.strictEqual(r.level, null);
  const roles = ["wolf", "seer", "villager", "villager", "doctor", "villager"];
  const s = W.newGame(roles.map((_, i) => "P" + i), { wolf: 1, seer: 1, doctor: 1, villager: 3 }, { roles, mode: "seats", kinds: roles.map((_, i) => (i ? "bot" : "human")) });
  s.players.forEach((p) => { if (p.id) p.level = "easy"; });
  const q = WP.result(s, 0, {});
  assert.strictEqual(q.won, false);
  assert.strictEqual(q.extra.quit, true);
  assert.strictEqual(q.level, "easy");
});

test("level ratings rise with measured strength; achievements have unique ids", () => {
  const r = WP.LEVELS.map((l) => l.rating);
  assert.ok(r[0] < r[1] && r[1] < r[2]);
  assert.strictEqual(new Set(WP.ACH.map((a) => a.id)).size, WP.ACH.length);
  const ctx = { stats: { wins: 1, bestStreak: 1 }, daily: { streak: 0 }, last: { won: true, level: "smart", extra: { team: "wolves", alive: true, players: 8 } } };
  const got = WP.ACH.filter((a) => { try { return a.test(ctx); } catch (e) { return false; } }).map((a) => a.id);
  assert.deepStrictEqual(got.sort(), ["alive", "first", "normal", "smart", "wolf"]);
});

test("the guided game deals the same cards every time: you are the Seer, one wolf", () => {
  assert.strictEqual(WC.ROLES[WC.ME], "seer");
  assert.strictEqual(WC.ROLES.filter((r) => r === "wolf").length, 1);
  const steps = WC.steps({ state: () => null });
  assert.ok(steps.length >= 5);
  const rules = WC.rules({});
  assert.ok(rules.sections.length >= 4 && rules.sections.every((s) => s.id && s.short && s.html));
});
