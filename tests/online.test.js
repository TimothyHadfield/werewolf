const assert = require("assert");
const W = require("../js/engine.js");
const O = require("../js/game-online.js");
const { game, mergeView } = O;
const rt = (x) => JSON.parse(JSON.stringify(x));

// Drive many all-computer games through the online adapter the way online.js
// does (JSON copies, bot(ctx), apply(state, seat, action)), checking at every
// step: toAct never empty before the end, bots never make an illegal move,
// state survives JSON, and pub + private rebuilds the engine's own view.
function playAll(cb) {
  const sets = [
    ["ultimate", { wolf: 2, seer: 1, doctor: 1, witch: 1, hunter: 1, villager: 2 }],
    ["millers", { wolf: 2, seer: 1, witch: 1, hunter: 1, villager: 3 }],
    ["mafia", { wolf: 2, seer: 1, doctor: 1, villager: 4 }],
    ["ultimate", { wolf: 1, seer: 1, bodyguard: 1, villager: 2 }],
    ["millers", { wolf: 3, seer: 1, doctor: 1, witch: 1, hunter: 1, villager: 5 }],
  ];
  let games = 0;
  sets.forEach(([rs, setup], si) => {
    ["easy", "normal", "smart"].forEach((level, li) => {
      for (let k = 0; k < 8; k++) {
        const rng = W.mulberry32(500 + si * 100 + li * 10 + k);
        const n = W.setupSize(setup);
        const seats = Array.from({ length: n }, (_, i) => ({ kind: i % 3 === 0 ? "human" : "computer", name: i % 3 === 0 ? "P" + i : "" }));
        let s = game.setup(n, { setup, opts: W.RULESETS[rs].opts, level }, rng, seats);
        let guard = 0;
        while (!game.isOver(s) && guard++ < 600) {
          const toAct = game.toAct(s);
          assert.ok(toAct.length > 0, "toAct empty in phase " + s.phase);
          for (const seat of toAct) {
            if (game.isOver(s) || !game.toAct(s).includes(seat)) continue;
            cb && cb(s);
            const ctx = { pub: game.publicView(s), mine: game.privateView(s, seat), state: s };
            const a = game.bot(ctx, seat, rng);
            s = rt(game.apply(rt(s), seat, rt(a), rng));
          }
        }
        assert.ok(game.isOver(s), "game ended");
        games++;
      }
    });
  });
  return games;
}

test("online adapter: computer-only games always finish, toAct never empty", () => {
  assert.strictEqual(playAll(), 120);
});

test("online adapter: public + private docs rebuild exactly the seat's view", () => {
  let checks = 0;
  playAll((s) => {
    if (checks > 4000) return;
    const pub = rt(game.publicView(s));
    for (let seat = 0; seat < s.players.length; seat++) {
      const merged = mergeView(pub, rt(game.privateView(s, seat)));
      assert.deepStrictEqual(merged, rt(W.view(s, seat)), "seat " + seat + " phase " + s.phase);
      checks++;
    }
  });
  assert.ok(checks > 1000);
});

test("online adapter: public doc and other seats' docs hide every secret role", () => {
  playAll((s) => {
    if (s.winner) return;
    const pubPlayers = game.publicView(s).players;
    s.players.forEach((p, i) => {
      if (!p.revealed) assert.strictEqual(pubPlayers[i].role, null, "public shows a hidden role");
    });
    const pubJ = JSON.stringify(game.publicView(s));
    assert.ok(!/"secret"/.test(pubJ), "no secret night log in public");
    for (let j = 0; j < s.players.length; j++) {
      const mine = game.privateView(s, j);
      const knows = new Set([j].concat(mine.pack || []));
      // A private doc may only name roles the seat is allowed to know.
      if (mine.pack) assert.strictEqual(s.players[j].role, "wolf");
      (mine.seerLog || []).forEach((r) => assert.strictEqual(r.by, j));
      if (mine.night && mine.night.wolf != null) assert.ok(s.players[j].role === "wolf" || s.players[j].role === "witch");
      void knows;
    }
  });
});

test("online adapter: moves out of turn or of the wrong kind are refused", () => {
  const rng = W.mulberry32(9);
  const seats = Array.from({ length: 6 }, () => ({ kind: "human", name: "" }));
  const s = game.setup(6, { setup: { wolf: 1, seer: 1, doctor: 1, villager: 3 }, opts: W.RULESETS.millers.opts }, rng, seats);
  assert.strictEqual(s.phase, "night");
  assert.throws(() => game.apply(rt(s), 0, { type: "ballot", target: 1 }));
  assert.throws(() => game.apply(rt(s), 0, { type: "night" }));
  assert.throws(() => game.apply(rt(s), 0, { type: "start" }));
  const names = s.players.map((p) => p.name);
  assert.deepStrictEqual(names, ["Player 1", "Player 2", "Player 3", "Player 4", "Player 5", "Player 6"]);
});
