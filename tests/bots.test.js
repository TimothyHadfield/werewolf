const assert = require("assert");
const W = require("../js/engine.js");

// Walk many all-computer games; at every decision, the bot's move from the
// full state must equal its move from view(state, seat): proof it never
// peeks at hidden cards.
test("computer players only use what their seat can see", () => {
  const setups = [{ wolf: 2, seer: 1, doctor: 1, witch: 1, hunter: 1, villager: 3 }, { wolf: 1, seer: 1, bodyguard: 1, villager: 3 }, { wolf: 2, seer: 1, mason: 2, prince: 1, villager: 3 }];
  let checked = 0;
  ["easy", "normal", "smart"].forEach((level, li) => {
    setups.forEach((setup, si) => {
      for (let gno = 0; gno < 6; gno++) {
        const rng = W.mulberry32(1000 + li * 100 + si * 10 + gno);
        const n = W.setupSize(setup);
        let g = W.newGame(Array.from({ length: n }, (_, i) => "P" + i), setup, { rng, mode: "seats", opts: { firstNightKill: true }, kinds: Array(n).fill("bot") });
        g.players.forEach((p) => { p.level = level; });
        let guard = 0;
        while (!g.winner && guard++ < 400) {
          const h = W.hostAction(g);
          if (h) { g = W.apply(g, h); continue; }
          const who = W.pendingActors(g);
          if (!who.length) break;
          for (const s of who) {
            const seed = Math.floor(rng() * 1e9);
            const full = W.botAction(g, s, W.mulberry32(seed), level);
            const seen = W.botAction(W.view(g, s), s, W.mulberry32(seed), level);
            assert.deepStrictEqual(seen, full, "seat " + s + " phase " + g.phase);
            checked++;
          }
          const a = W.nextBotMove(g, who, rng);
          if (!a) break;
          g = W.apply(g, a);
        }
        assert.ok(g.winner, "game finished");
      }
    });
  });
  assert.ok(checked > 300, "checked " + checked);
});

test("simulation is repeatable with a seed and gives sane numbers", () => {
  const s = { wolf: 2, seer: 1, doctor: 1, villager: 4 };
  const a = W.simulateSetup(s, 400, 5), b = W.simulateSetup(s, 400, 5);
  assert.strictEqual(a.villageWins, b.villageWins);
  // one wolf among many is a village walkover; four wolves of nine is a wolf walkover
  assert.ok(W.simulateSetup({ wolf: 1, seer: 1, villager: 10 }, 400, 1).village > 0.7);
  assert.ok(W.simulateSetup({ wolf: 4, villager: 5 }, 400, 1).village < 0.15);
});

test("normal village beats easy village against the same wolves", () => {
  const s = { wolf: 2, seer: 1, doctor: 1, villager: 5 };
  const easy = W.simulateSetup(s, 1500, 8, { villageLevel: "easy", wolfLevel: "normal" }).village;
  const normal = W.simulateSetup(s, 1500, 8, { villageLevel: "normal", wolfLevel: "normal" }).village;
  assert.ok(normal > easy + 0.1, easy + " vs " + normal);
});
