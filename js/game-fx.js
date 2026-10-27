/* Werewolf sounds, celebrations and small animations, on top of the shared js/fx.js.
 * events(prev, next, ctx) compares two game states and lists what happened, using only
 * what the viewer may know (public log, their own seat's results). fire(list) plays it.
 * Works the same for the table game, vs computer and online (driven by state changes).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WWFX = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const TEAM_COLORS = {
    village: ["#f0b354", "#f0d39a", "#6ea8fe", "#4cc38a", "#e8eaf0"],
    wolves: ["#e0605a", "#a8322c", "#f08c8c", "#f0d39a", "#e8eaf0"],
  };
  const teamOf = (role) => (role === "wolf" ? "wolves" : "village");

  // ------------------------------------------------------------ what happened
  // ctx: { seat: your seat (null = the table phone), mineBefore, mineNow (your turn to act) }
  function events(prev, g, ctx) {
    ctx = ctx || {};
    const seat = ctx.seat == null ? null : ctx.seat;
    const out = [];
    if (!g) return out;
    if (!prev || prev.seed !== g.seed) {
      if (!g.winner && g.log.length <= 1) out.push({ type: "deal" });
      return out;
    }
    if (g.revealIdx > prev.revealIdx) out.push({ type: "pass" });
    if (prev.phase !== "night" && g.phase === "night") out.push({ type: "nightFall" });
    if ((prev.phase === "night" && g.phase !== "night") || (prev.phase === "start" && g.phase === "day")) out.push({ type: "dayBreak" });

    // Your own night choice (never anyone else's: that would give roles away).
    if (prev.night && g.night && prev.nightNo === g.nightNo && prev.phase === "night" && g.phase === "night") {
      const P = prev.night, N = g.night;
      const me = seat == null ? null : g.players[seat];
      let picked = false;
      // Table phone: only steps that always end in a pick, so a potion's sound can't give it away.
      if (seat == null) picked = ["wolf", "doctor", "bodyguard"].some((k) => P[k] == null && N[k] != null);
      else if (me && me.role === "wolf") picked = N.wolfVotes && P.wolfVotes && N.wolfVotes[seat] != null && N.wolfVotes[seat] !== P.wolfVotes[seat];
      else if (me && (me.role === "doctor" || me.role === "bodyguard")) picked = P[me.role] == null && N[me.role] != null;
      else if (me && me.role === "witch") picked = (!P.picked.heal && N.picked.heal) || (!P.picked.poison && N.picked.poison);
      if (picked) out.push({ type: "nightPick" });
    }
    // A night that ends in your own pick (doctor / last wolf) still gets its knock.
    if (seat != null && prev.phase === "night" && g.phase !== "night" && ctx.mineBefore && !ctx.mineNow) out.push({ type: "nightPick" });

    // The Seer's answer: only the seat that asked (or the table phone) hears it.
    const sl = g.seerLog || [], psl = prev.seerLog || [];
    for (let i = psl.length; i < sl.length; i++) {
      const e = sl[i];
      // The sparkle for "found a wolf" only on your own phone: at a real table it would tell everyone.
      if (seat == null || e.by === seat) out.push({ type: "seer", wolf: !!e.wolf && seat != null });
    }
    // Ballots (seat games): one knock per vote cast.
    if (g.mode === "seats" && g.ballots && prev.ballots && g.day === prev.day) {
      Object.keys(g.ballots).forEach((s) => { if (prev.ballots[s] == null) out.push({ type: "ballot", mine: seat != null && +s === seat }); });
    }
    // Public log: deaths, votes, shots, claims, the end.
    if (g.log.length > prev.log.length) {
      g.log.slice(prev.log.length).forEach((e) => {
        if (e.t === "dawn") e.deaths.forEach((id) => out.push({ type: "death", id }));
        else if (e.t === "vote") out.push({ type: "eliminate", id: e.target });
        else if (e.t === "novote") out.push({ type: "noOut" });
        else if (e.t === "shot") out.push(e.target != null ? { type: "shot", id: e.target } : { type: "shotAir" });
        else if (e.t === "claim") out.push({ type: "claim" });
        else if (e.t === "end") {
          const me = seat == null ? null : g.players[seat];
          out.push({ type: "end", winner: e.winner, result: me && me.role ? (teamOf(me.role) === e.winner ? "win" : "lose") : "win" });
        }
      });
    }
    // Cards turned face up (a death with "Show cards of the dead").
    g.players.forEach((p, i) => { const q = prev.players[i]; if (q && !q.revealed && p.revealed) out.push({ type: "reveal", id: p.id }); });
    if (ctx.mineNow && !ctx.mineBefore && !g.winner) out.push({ type: "turn" });
    return out;
  }

  // ------------------------------------------------------------ event -> sound
  const SOUND = {
    deal: "shuffle", pass: "cardSlide", nightFall: "nightFall", dayBreak: "dayBreak", nightPick: "place",
    seer: "cardFlip", ballot: "place", death: "stamp", eliminate: "stamp", noOut: "miss", shot: "hit",
    shotAir: "whoosh", claim: "pop", reveal: "cardFlip", turn: "turn",
  };
  // Delays (ms) so sounds line up: the stamp lands after dawn, the card flips after the stamp.
  const AFTER_DAWN = 700, AFTER_STAMP = 320;

  let FX = null, scale = 1, doc = null, defined = false;
  function init(fx, o) {
    FX = fx || null; o = o || {};
    scale = o.scale == null ? 1 : o.scale;
    doc = o.doc || (typeof document !== "undefined" ? document : null);
    if (FX && !defined) {
      defined = true;
      // Night falls: a low wolf howl rising, then falling away, over a little wind.
      FX.define("nightFall", (k) => {
        k.noise({ f: 420, f2: 260, filter: "lowpass", q: 0.7, dur: 1.05, a: 0.3, vol: 0.12 });
        k.tone({ f: 250, f2: 470, dur: 0.5, a: 0.14, vol: 0.13, type: "sawtooth", lp: 850 });
        k.tone({ f: 500, f2: 940, dur: 0.5, a: 0.14, vol: 0.03, type: "triangle" });
        k.tone({ f: 470, f2: 300, dur: 0.66, a: 0.04, vol: 0.13, type: "sawtooth", lp: 850, at: 0.42 });
        k.tone({ f: 940, f2: 600, dur: 0.6, a: 0.04, vol: 0.025, type: "triangle", at: 0.42 });
      }, "moves");
      // Day breaks: a rooster-ish chime (short, short, rising, then a long fall) and a soft bell.
      FX.define("dayBreak", (k) => {
        k.tone({ f: 660, dur: 0.09, vol: 0.12, type: "triangle" });
        k.tone({ f: 880, dur: 0.09, vol: 0.12, type: "triangle", at: 0.1 });
        k.tone({ f: 990, f2: 1250, dur: 0.14, vol: 0.13, type: "triangle", at: 0.2 });
        k.tone({ f: 1250, f2: 840, dur: 0.42, a: 0.02, vol: 0.13, type: "triangle", at: 0.34 });
        k.tone({ f: 1568, dur: 0.6, vol: 0.04, at: 0.34 });
        k.tone({ f: 3136, dur: 0.3, vol: 0.015, at: 0.34 });
      }, "moves");
    }
    return api;
  }
  const later = (ms, fn) => { const d = ms * scale * (FX && FX.settings.animSpeed === "fast" ? 0.55 : 1); if (d <= 0) fn(); else setTimeout(fn, d); };
  const $ = (sel) => (doc && doc.querySelector ? doc.querySelector(sel) : null);
  const tile = (id) => $('.pbtn[data-id="' + id + '"]');
  const play = (name, o) => (FX ? FX.play(name, o) : false);

  // A card shown on death or vote-out lifts off the table into the middle of the screen, holds, and
  // settles back. Off with Animations off (Settings) or the phone's "reduce motion". Transform/opacity only.
  function spotlight(id) {
    if (!FX || !FX.settings || !FX.settings.animations || !doc || !doc.body || !doc.defaultView || !doc.createElement) return;
    const win = doc.defaultView;
    try { if (win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch (e) { /* */ }
    const t = tile(id); const card = t && typeof t.querySelector === "function" ? t.querySelector(".ww-card") : null;
    if (!card || !card.animate || !card.querySelector(".ww-face")) return;
    const r = card.getBoundingClientRect(); if (!r.width) return;
    const vw = doc.documentElement.clientWidth, vh = doc.documentElement.clientHeight;
    const W = Math.min(210, vw * 0.48, (vh * 0.52) / (r.height / r.width));
    if (W <= r.width * 1.15) return; // already big on screen (laptop): the turn itself is the moment
    const k = W / r.width, dx = vw / 2 - (r.left + r.width / 2), dy = vh / 2 - (r.top + r.height / 2);
    const c = card.cloneNode(true);
    c.classList.remove("ww-turn"); c.querySelectorAll(".ww-back").forEach((b) => b.remove()); c.querySelectorAll(".ww-hide").forEach((b) => b.classList.remove("ww-hide"));
    c.style.cssText = "position:fixed;left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px;margin:0;z-index:61;pointer-events:none;transform-origin:50% 50%";
    const dim = doc.createElement("div");
    dim.style.cssText = "position:fixed;inset:0;z-index:60;pointer-events:none;background:radial-gradient(circle at 50% 50%, rgba(240,211,154,.16), rgba(0,0,0,.6) 60%);opacity:0";
    doc.body.appendChild(dim); doc.body.appendChild(c);
    const d = 1700 * scale * (FX.settings.animSpeed === "fast" ? 0.55 : 1);
    const big = "translate(" + dx + "px," + dy + "px) scale(" + k + ")";
    const done = () => { c.remove(); dim.remove(); };
    try {
      c.animate([{ transform: "none" }, { transform: big, offset: 0.25 }, { transform: big, offset: 0.75 }, { transform: "none", opacity: 1, offset: 0.97 }, { transform: "none", opacity: 0 }], { duration: d, easing: "ease-in-out" }).onfinish = done;
      dim.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: d });
    } catch (e) { done(); return; }
    setTimeout(done, d + 500); // never leave it on screen (a stalled or background tab)
  }

  // Play a list of events. Call it right after the new screen is drawn.
  function fire(list) {
    if (!FX || !list || !list.length) return;
    const dawn = list.some((e) => e.type === "dayBreak");
    let deathN = 0, revealN = 0;
    list.forEach((e) => {
      const snd = SOUND[e.type];
      switch (e.type) {
        case "deal": play(snd); break;
        case "pass": play(snd); FX.pop($(".dots i.now")); break;
        case "nightFall": play(snd); FX.pop($(".night .step-head svg")); break;
        case "dayBreak": play(snd); FX.pop($(".news svg")); break;
        case "nightPick": play(snd, { vol: 0.8 }); break;
        case "seer":
          play(snd);
          later(120, () => { const el = $(".result-card"); FX.pop(el); if (e.wolf) FX.celebrate({ kind: "big", at: el, colors: TEAM_COLORS.wolves }); });
          break;
        case "ballot": play(snd, { vol: e.mine ? 1 : 0.7, pitch: 0.9 + Math.random() * 0.2 }); FX.pop($(".day-foot .muted")); break;
        case "death": case "eliminate": case "shot": {
          const wait = (e.type === "death" && dawn ? AFTER_DAWN : 0) + deathN++ * 380;
          later(wait, () => {
            if (e.type === "shot") play("hit");
            play("stamp");
            const t = tile(e.id);
            if (t) { FX.shake(t); FX.flash(t, "var(--wolf)"); }
          });
          break;
        }
        case "reveal": {
          const wait = (dawn ? AFTER_DAWN : 0) + AFTER_STAMP;
          const n = revealN++;
          later(wait, () => { play(snd); FX.pop(tile(e.id)); });
          later(wait + 450 + n * 1800, () => spotlight(e.id));
          break;
        }
        case "noOut": play(snd); break;
        case "shotAir": play(snd); break;
        case "claim": { play(snd); const c = doc && doc.querySelectorAll ? doc.querySelectorAll(".claims .claim") : []; FX.pop(c.length ? c[c.length - 1] : null); break; }
        case "turn": later(dawn ? AFTER_DAWN + 400 : 150, () => { play(snd); FX.pulse($(".night .actions") || $(".day-foot")); }); break;
        case "end":
          later(900, () => {
            FX.pop($(".over-head"));
            FX.celebrate({ kind: e.result, colors: TEAM_COLORS[e.winner] });
          });
          break;
        default: break;
      }
    });
  }

  const api = { events, fire, init, spotlight, SOUND, TEAM_COLORS };
  return api;
});
