// Sounds, celebrations and animations (js/game-fx.js on top of the shared js/fx.js).
// Plays scripted games through the real engine and checks which sounds fire.
const assert = require("assert");
const W = require("../js/engine.js");

// ---- fake browser bits: Web Audio that counts, a document that counts animations
const audio = { nodes: 0, clock: 0 };
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
const node = (x) => { audio.nodes++; return Object.assign({ connect() {}, disconnect() {} }, x); };
const src = () => node({ start() {}, stop() {} });
class FakeAC {
  get currentTime() { return (audio.clock += 1); } // a new moment each call: no throttling in tests
  constructor() { this.sampleRate = 8000; this.state = "running"; this.destination = {}; }
  createGain() { return node({ gain: param() }); }
  createOscillator() { return Object.assign(src(), { type: "sine", frequency: param() }); }
  createBufferSource() { return Object.assign(src(), { buffer: null, loop: false }); }
  createBiquadFilter() { return node({ type: "lowpass", frequency: param(), Q: param() }); }
  createStereoPanner() { return node({ pan: param() }); }
  createDynamicsCompressor() { return node({}); }
  createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; }
  resume() { return Promise.resolve(); }
}
const anim = { animate: 0, canvas: 0 };
const fakeEl = () => ({
  style: {}, classList: { toggle() {}, add() {}, contains() { return false; } },
  animate() { anim.animate++; const a = {}; setTimeout(() => a.onfinish && a.onfinish(), 0); return a; },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 50, height: 50 }),
  remove() {}, appendChild() {}, setAttribute() {}, removeAttribute() {}, cloneNode() { return fakeEl(); },
  getContext: () => null,
});
global.AudioContext = FakeAC;
global.document = {
  addEventListener() {}, removeEventListener() {}, getElementById: () => null,
  querySelector: () => fakeEl(), querySelectorAll: () => [fakeEl()],
  createElement: (t) => { if (t === "canvas") anim.canvas++; return fakeEl(); },
  body: { appendChild() {} }, head: { appendChild() {} },
};
global.requestAnimationFrame = () => 0;
global.getComputedStyle = () => ({ borderRadius: "0" });
require("../js/fx.js");
const FX = global.FX;
const WWFX = require("../js/game-fx.js");
FX.init({ game: "werewolf-test", clicks: false });
FX.unlock();
WWFX.init(FX, { scale: 0 }); // scale 0: every delayed sound fires at once

// Spy on what the game asks for.
let calls = [], cel = [];
const realPlay = FX.play, realCel = FX.celebrate;
FX.play = (n, o) => { calls.push(n); return realPlay(n, o); };
FX.celebrate = (o) => { cel.push(o.kind); return realCel(o); };
const reset = () => { calls = []; cel = []; };

// One full vs-computer game; seat 0 is "you". Every state change goes through events() + fire().
function playSeatGame(seed) {
  const rng = W.mulberry32(seed);
  const setup = { wolf: 1, seer: 1, doctor: 1, villager: 2 };
  let g = W.newGame(["You", "Ada", "Bo", "Cy", "Dee"], setup, { rng, mode: "seats", opts: { firstNightKill: true, reveal: true }, kinds: ["human", "bot", "bot", "bot", "bot"] });
  let prev = null, mineBefore = false, guard = 0;
  const step = (next) => {
    const mineNow = W.pendingActors(next).indexOf(0) >= 0;
    WWFX.fire(WWFX.events(prev, next, { seat: 0, mineBefore, mineNow }));
    prev = next; mineBefore = mineNow;
  };
  step(g);
  while (!g.winner && guard++ < 300) {
    const h = W.hostAction(g);
    if (h) { g = W.apply(g, h); step(g); continue; }
    const who = W.pendingActors(g);
    const a = W.nextBotMove(g, who, rng);
    g = W.apply(g, a); step(g);
  }
  assert.ok(g.winner, "game finished");
  return g;
}

test("fx: a vs-computer game fires the right sounds", () => {
  FX.reset(); FX.set("animations", true); reset();
  // A game where you live into day 1: your turn to vote gets the chime.
  let g = null, seed = 0;
  const a0 = anim.animate;
  playSeatGame(1);
  assert.ok(anim.animate > a0, "animations run when on");
  const diedFirstNight = (x) => { const d = x.log.find((e) => e.t === "dawn" && e.n === 1); return !d || d.deaths.indexOf(0) >= 0; };
  do { reset(); g = playSeatGame(++seed); } while (diedFirstNight(g) && seed < 50);
  ["shuffle", "nightFall", "dayBreak", "place", "stamp", "cardFlip", "turn"].forEach((s) => assert.ok(calls.indexOf(s) >= 0, "expected " + s + " in " + calls.join(",")));
  assert.strictEqual(calls[0], "shuffle", "the deal comes first");
  const nights = g.log.filter((e) => e.t === "night").length;
  assert.strictEqual(calls.filter((s) => s === "nightFall").length, nights, "one howl per night");
  const ballots = g.log.filter((e) => e.ballots).reduce((n, e) => n + Object.keys(e.ballots).length, 0);
  assert.strictEqual(calls.filter((s) => s === "place").length >= ballots, true, "a knock for every ballot");
  ["error", "win", "lose"].forEach((s) => assert.ok(calls.indexOf(s) < 0, s + " should not be a game sound"));
});

test("fx: game over celebrates with your own result", () => {
  FX.reset(); reset();
  let seen = { win: 0, lose: 0 };
  for (let seed = 1; seed <= 12; seed++) {
    reset();
    const g = playSeatGame(seed);
    const mine = (g.players[0].role === "wolf" ? "wolves" : "village") === g.winner ? "win" : "lose";
    assert.deepStrictEqual(cel.filter((k) => k !== "big"), [mine], "seed " + seed);
    seen[mine]++;
  }
  assert.ok(seen.win && seen.lose, "both a win and a loss were played: " + JSON.stringify(seen));
});

test("fx: table game: pass the phone, vote out, nobody out, the table's win", () => {
  FX.reset(); reset();
  let g = W.newGame(["A", "B", "C", "D", "E"], { wolf: 1, seer: 1, villager: 3 }, { rng: W.mulberry32(3), mode: "table", opts: { reveal: true, dayFirst: true } });
  let prev = null;
  const step = (a) => { const next = a ? W.apply(g, a) : g; WWFX.fire(WWFX.events(prev, next, { seat: null })); prev = next; g = next; };
  step(null);
  for (let i = 0; i < 5; i++) step({ type: "seen" });
  step({ type: "start" });
  step({ type: "noVote" });
  assert.deepStrictEqual(calls, ["shuffle", "cardSlide", "cardSlide", "cardSlide", "cardSlide", "cardSlide", "dayBreak", "miss"]);
  reset();
  step({ type: "night" });
  assert.deepStrictEqual(calls, ["nightFall"]);
  const wolf = g.players.find((p) => p.role === "wolf").id;
  reset();
  // jump to day 2 the quick way, then vote the wolf out
  while (g.phase === "night") { const st = W.currentStep(g); if (W.stepIsIdle(g, st)) step({ type: "done", step: st }); else if (st === "wolf") step({ type: "pick", step: st, target: g.players.find((p) => p.alive && p.role !== "wolf").id }); else if (st === "seer") { step({ type: "pick", step: st, target: wolf }); step({ type: "done", step: st }); } else step({ type: "done", step: st }); }
  step({ type: "day" });
  reset();
  step({ type: "vote", target: wolf });
  assert.deepStrictEqual(calls, ["stamp", "cardFlip"]);
  assert.deepStrictEqual(cel, ["win"], "the table phone celebrates the winners");
});

test("fx: Sound off = no audio, Animations off = no motion, Celebrations off = no confetti", () => {
  FX.reset(); FX.set("sound", false); FX.set("animations", false);
  const plays = FX.stats.plays, a0 = anim.animate, c0 = anim.canvas;
  for (let seed = 1; seed <= 4; seed++) playSeatGame(seed);
  assert.strictEqual(FX.stats.plays, plays, "no sound played");
  assert.strictEqual(anim.animate, a0, "no animation ran");
  assert.strictEqual(anim.canvas, c0, "no confetti canvas");
  FX.reset(); FX.set("celebrations", false);
  const c1 = anim.canvas, p1 = FX.stats.plays;
  playSeatGame(5);
  assert.strictEqual(anim.canvas, c1, "celebrations off: no confetti");
  assert.ok(FX.stats.plays > p1, "game sounds still play");
  FX.reset(); FX.set("moves", false);
  const p2 = FX.stats.plays; calls = [];
  playSeatGame(6);
  const real = FX.stats.plays - p2;
  assert.ok(real > 0 && real <= calls.filter((n) => n === "turn").length + 3, "game sounds off: only alerts (turn) and the end fanfare play, got " + real);
  FX.reset();
});
