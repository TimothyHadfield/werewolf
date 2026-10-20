// createLocal (the real online.js, no network) with the Werewolf adapter.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createLocal } from "../js/online.js";
const require = createRequire(import.meta.url);
const W = require("../js/engine.js");
const { game, mergeView } = require("../js/game-online.js");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
for (let k = 0; k < 6; k++) {
  const room = createLocal({ game, seats: ["human", "computer", "computer", "computer", "computer", "computer", "computer"], names: ["You"], botDelayMs: 1, rng: W.mulberry32(77 + k),
    options: { setup: { wolf: 2, seer: 1, doctor: 1, villager: 3 }, opts: W.RULESETS.ultimate.opts, level: "normal" } });
  let last = null, errors = [];
  room.on("change", (snap) => { last = snap; });
  room.on("error", (m) => errors.push(m));
  room.start();
  for (let i = 0; i < 4000 && last.status !== "finished"; i++) {
    if (last.myTurn) {
      const g = mergeView(last.pub, last.mine);
      const a = game.bot({ pub: last.pub, mine: last.mine, state: null }, 0, Math.random) ;
      void g; room.act(a);
    }
    await wait(2);
  }
  assert.equal(last.status, "finished", "game " + k + " finished");
  assert.deepEqual(errors, []);
  pass++;
}
console.log("online-local.test.mjs: " + pass + " rooms played to the end");
