/* Werewolf for the shared online module (Board and Card Games/_online/online.js).
 * Wraps the pure engine (engine.js, window.WW) in the game shape online.js wants:
 * setup / toAct / apply / publicView / privateView / bot / isOver.
 *
 * - The moderator's own steps (start, idle night steps, morning -> day,
 *   dusk -> night) are applied straight away inside apply(), so toAct is
 *   never empty while the game runs.
 * - publicView = what the whole table may see (engine view with no seat).
 * - privateView = only this seat's secrets (own card, pack, Seer results,
 *   potions/guards, tonight's info for the role that's awake, own ballot).
 *   mergeView(pub, mine) rebuilds exactly the engine's view(state, seat).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./engine.js"));
  else root.WWOnline = factory(root.WW);
})(typeof self !== "undefined" ? self : this, function (W) {
  "use strict";
  const BOTS = ["Ada", "Bo", "Cy", "Dee", "Eli", "Fay", "Gus", "Hal", "Ivy", "Jo", "Kit", "Lou", "Max", "Nia", "Oz", "Pia"];
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // Run the moderator until a seat has to act (or the game ends).
  function settle(g) {
    for (let i = 0; i < 50 && !g.winner && !W.pendingActors(g).length; i++) {
      const h = W.hostAction(g);
      if (!h) break;
      g = W.apply(g, h);
    }
    return g;
  }

  function defaultSetup(n) {
    const w = W.rulebookWolves("ultimate", n);
    return W.normalizeSetup({ wolf: w, seer: 1, doctor: 1 }, n);
  }

  const game = {
    id: "werewolf",
    minSeats: 5,
    maxSeats: 12,
    setup(n, options, rng, seats) {
      options = options || {};
      const used = new Set();
      const names = [];
      for (let i = 0; i < n; i++) {
        const s = (seats && seats[i]) || {};
        let nm = String(s.name || "").trim().slice(0, 14);
        if (!nm || (s.kind === "computer" && /^(computer|player)( \d+)?$/i.test(nm))) nm = s.kind === "computer" ? BOTS.find((b) => !used.has(b)) || "Bot " + (i + 1) : "Player " + (i + 1);
        let base = nm, k = 2;
        while (used.has(nm)) nm = base + " " + k++;
        used.add(nm);
        names.push(nm);
      }
      const setup = options.setup && !W.setupProblem(W.normalizeSetup(options.setup, n), n) ? W.normalizeSetup(options.setup, n) : defaultSetup(n);
      const g = W.newGame(names, setup, { rng, mode: "seats", opts: options.opts || {}, kinds: names.map((_, i) => (seats && seats[i] && seats[i].kind === "computer" ? "bot" : "human")) });
      const level = options.level || "normal";
      g.players.forEach((p) => { p.level = level; });
      return settle(g);
    },
    toAct(g) { return g.winner ? [] : W.pendingActors(g); },
    apply(g, seat, action) {
      if (!action || typeof action !== "object") throw new Error("No move.");
      const ok = g.pendingHunters.length ? ["shoot"] : g.phase === "night" ? ["pick", "done"] : g.phase === "day" ? ["ballot", "claim"] : [];
      if (ok.indexOf(action.type) < 0) throw new Error("Not now.");
      const a = { type: action.type, seat };
      ["step", "target", "extra", "wolf"].forEach((k) => { if (action[k] !== undefined) a[k] = action[k]; });
      if (a.type === "claim" && g.claims.some((c) => c.by === seat && c.target === a.target)) throw new Error("Already claimed.");
      return settle(W.apply(g, a));
    },
    publicView(g) { return W.view(g, null); },
    privateView(g, seat) {
      if (seat == null || seat < 0 || !g.players[seat]) return null;
      const v = W.view(g, seat);
      const out = { seat, role: g.players[seat].role };
      if (out.role === "wolf") out.pack = g.players.filter((p) => p.role === "wolf").map((p) => p.id);
      if (v.seerLog && v.seerLog.length) out.seerLog = v.seerLog;
      if (!g.winner) {
        const m = v.mem;
        if (m && (m.doctorLast != null || m.bgLast != null || m.healUsed != null || m.poisonUsed != null)) out.mem = m;
        if (v.night) {
          const pub = W.view(g, null).night;
          if (JSON.stringify(pub) !== JSON.stringify(v.night)) out.night = v.night;
        }
        if (v.ballots && v.ballots[seat] != null) out.ballot = v.ballots[seat];
      }
      return out;
    },
    bot(ctx, seat, rng) {
      // Plays only from what this seat can see (public doc + its own private doc).
      const g = mergeView(ctx.pub, ctx.mine);
      const a = W.botAction(g, seat, rng);
      if (a) return a;
      // Safety net: never leave a computer seat stuck in toAct.
      if (g.pendingHunters[0] === seat) return { type: "shoot", seat, target: null };
      if (g.phase === "day") return { type: "ballot", seat, target: null };
      if (g.phase === "night") {
        const step = W.currentStep(g);
        if (step === "wolf") {
          const t = W.validTargets(g, "wolf");
          const lead = g.night && g.night.wolfVotes && Object.values(g.night.wolfVotes)[0];
          return { type: "pick", seat, step, target: lead != null ? lead : t[0] };
        }
        return { type: "done", seat, step };
      }
      return { type: "ballot", seat, target: null };
    },
    isOver(g) { return !!g.winner; },
  };

  // Rebuild the engine's view(state, seat) from the two docs a phone receives.
  function mergeView(pub, mine) {
    if (!pub) return null;
    const v = clone(pub);
    if (!mine || pub.winner) return v;
    const me = v.players[mine.seat];
    if (me) me.role = mine.role;
    if (mine.pack) mine.pack.forEach((id) => { if (v.players[id]) v.players[id].role = "wolf"; });
    v.seerLog = mine.seerLog || [];
    if (mine.mem) v.mem = mine.mem;
    if (mine.night) v.night = mine.night;
    if (mine.ballot != null) v.ballots = Object.assign({}, v.ballots, { [mine.seat]: mine.ballot });
    return v;
  }

  return { game, mergeView, settle };
});
