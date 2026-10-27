/* Werewolf / Mafia — pure rules engine (browser + Node). No DOM.
 *
 *   apply(state, action) -> new state      (throws Error with a plain message)
 *   view(state, seat)    -> what that seat may see (seat null = the table)
 *   pendingActors(state) -> seats the game is waiting on
 *   hostAction(state)    -> the moderator's next automatic step, or null
 *   botAction(state, seat, rng) -> a computer seat's next action, or null
 *
 * Two modes:
 *   "table" — one phone at a real table. The phone collects night actions from
 *             whoever is awake; the table enters votes and claims.
 *   "seats" — every seat is a person on their own device, a computer, or
 *             (online) a remote player. Votes are cast seat by seat.
 *
 * Rule switches live in state.opts (see DEFAULT_OPTS and docs/rules-check.md).
 */
(function (root) {
  "use strict";

  const ROLE_KEYS = ["wolf", "seer", "doctor", "bodyguard", "witch", "hunter", "mason", "prince", "villager"];
  const NIGHT_ORDER = ["mason", "seer", "doctor", "bodyguard", "wolf", "witch"];
  const TEAM = { wolf: "wolves", seer: "village", doctor: "village", bodyguard: "village", witch: "village", hunter: "village", mason: "village", prince: "village", villager: "village" };

  const DEFAULT_OPTS = {
    firstNightKill: false, // wolves kill on night 1 (off = they only meet)
    dayFirst: false,       // game opens with a day (Mafia style) instead of a night
    reveal: true,          // a dead player's card is shown
    seerSees: "team",      // "team" = wolf / not a wolf, "role" = the exact card
    doctorSelf: true,      // Doctor may guard themself
    guardRepeat: false,    // Doctor / Bodyguard may guard the same player two nights running
    witchSelfHeal: true,   // Witch may heal herself
    witchBoth: true,       // Witch may use both potions the same night
    win: "parity",         // "parity" = wolves win when they equal the rest; "all" = when everyone else is dead
    tie: "none",           // tied vote: "none" = nobody goes out
  };

  // Rule sets (sources in docs/rules-check.md). Each is a full opts object.
  const RULESETS = {
    ultimate: { name: "Ultimate Werewolf", opts: { firstNightKill: false, dayFirst: false, reveal: true, seerSees: "team", doctorSelf: true, guardRepeat: false, witchSelfHeal: true, witchBoth: true, win: "parity", tie: "none" } },
    millers: { name: "Millers Hollow", opts: { firstNightKill: true, dayFirst: false, reveal: true, seerSees: "role", doctorSelf: true, guardRepeat: false, witchSelfHeal: true, witchBoth: true, win: "all", tie: "none" } },
    mafia: { name: "Mafia", opts: { firstNightKill: true, dayFirst: true, reveal: true, seerSees: "team", doctorSelf: true, guardRepeat: true, witchSelfHeal: true, witchBoth: true, win: "parity", tie: "none" } },
  };
  // Wolves per player count in each rulebook's first-game table (rest: 1 Seer + villagers).
  function rulebookWolves(ruleset, n) {
    if (ruleset === "millers") return n >= 18 ? 4 : n >= 12 ? 3 : n >= 8 ? 2 : 1;
    if (ruleset === "ultimate") return n >= 12 ? 3 : n >= 9 ? 2 : 1;
    return Math.max(1, Math.round(n / 3)); // Mafia: about a third
  }
  // Ultimate Werewolf's printed balance points (Doctor from the German Healer card).
  const UW_POINTS = { wolf: -6, seer: 7, doctor: 3, bodyguard: 3, witch: 4, hunter: 3, mason: 2, prince: 3, villager: 1 };
  function uwPoints(setup) { return ROLE_KEYS.reduce((s, k) => s + (setup[k] || 0) * UW_POINTS[k], 0); }

  const THEMES = {
    werewolf: {
      wolf: ["Werewolf", "Werewolves"], seer: ["Seer", "Seers"], doctor: ["Doctor", "Doctors"],
      bodyguard: ["Bodyguard", "Bodyguards"], witch: ["Witch", "Witches"], hunter: ["Hunter", "Hunters"],
      mason: ["Mason", "Masons"], prince: ["Prince", "Princes"],
      villager: ["Villager", "Villagers"], village: "Village", wolves: "Werewolves", title: "Werewolf",
    },
    mafia: {
      wolf: ["Mafia", "Mafia"], seer: ["Detective", "Detectives"], doctor: ["Doctor", "Doctors"],
      bodyguard: ["Bodyguard", "Bodyguards"], witch: ["Witch", "Witches"], hunter: ["Hunter", "Hunters"],
      mason: ["Mason", "Masons"], prince: ["Prince", "Princes"],
      villager: ["Citizen", "Citizens"], village: "Town", wolves: "Mafia", title: "Mafia",
    },
  };

  const ROLE_HELP = {
    wolf: "Each night, agree with the other wolves on one player to kill. By day, blend in.",
    seer: "Each night, check one player and learn if they are a wolf.",
    doctor: "Each night, guard one player from the wolves.",
    bodyguard: "Each night, guard one other player from the wolves.",
    witch: "You see who the wolves attacked. One heal and one poison for the whole game.",
    hunter: "When you die, you shoot one player and take them with you.",
    mason: "On the first night the Masons wake and see each other. No other power.",
    prince: "If the table votes you out, your card is shown and you stay in.",
    villager: "No night power. Find the wolves by talking and vote them out.",
  };

  function roleName(role, theme, plural) {
    const t = THEMES[theme] || THEMES.werewolf;
    return t[role] ? t[role][plural ? 1 : 0] : role;
  }

  // ------------------------------------------------------------------ random
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  // Same number for every bot that asks: stands in for "the table talked it over".
  function hash3(a, b, c) {
    let h = (a * 2654435761) ^ (b * 40503) ^ (c * 9973 + 0x9e3779b9);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return (h ^ (h >>> 16)) >>> 0;
  }

  // ------------------------------------------------------------------ setups
  function setupSize(setup) { return ROLE_KEYS.reduce((s, k) => s + (setup[k] || 0), 0); }
  function normalizeSetup(setup, n) {
    const s = {};
    ROLE_KEYS.forEach((k) => { s[k] = Math.max(0, Math.floor(setup[k] || 0)); });
    s.villager = 0;
    s.villager = Math.max(0, n - setupSize(s));
    return s;
  }
  function setupProblem(setup, n) {
    if (n < 4) return "Need at least 4 players";
    if (n > 20) return "At most 20 players";
    if ((setup.wolf || 0) < 1) return "Need at least 1 wolf";
    if (setupSize(setup) !== n) return "Too many roles for " + n + " players";
    if (setup.wolf * 2 >= n) return "Too many wolves";
    return null;
  }

  // ------------------------------------------------------------------ state
  function newGame(names, setup, o) {
    o = o || {};
    const rng = o.rng || Math.random;
    const n = names.length;
    const s = normalizeSetup(setup, n);
    const prob = setupProblem(s, n);
    if (prob) throw new Error(prob);
    const bag = [];
    ROLE_KEYS.forEach((k) => { for (let i = 0; i < s[k]; i++) bag.push(k); });
    const roles = o.roles || shuffle(bag, rng);
    const kinds = o.kinds || [];
    const g = {
      v: 2,
      mode: o.mode || "table",
      opts: Object.assign({}, DEFAULT_OPTS, o.opts || {}),
      seed: Math.floor(rng() * 1e9),
      players: names.map((name, i) => ({ id: i, name: String(name), role: roles[i], alive: true, revealed: false, kind: kinds[i] || "human" })),
      setup: s,
      phase: o.mode === "seats" ? "start" : "reveal",
      revealIdx: 0,
      day: 0,
      nightNo: 0,
      night: null,
      mem: { doctorLast: null, bgLast: null, healUsed: false, poisonUsed: false },
      claims: [],
      seerLog: [],
      ballots: {},
      log: [],
      pendingHunters: [],
      lastDeaths: [],
      winner: null,
    };
    return g;
  }

  const living = (g) => g.players.filter((p) => p.alive);
  const aliveRole = (g, role) => g.players.some((p) => p.alive && p.role === role);
  const actorOf = (g, role) => g.players.find((p) => p.alive && p.role === role) || null;
  const livingWolves = (g) => g.players.filter((p) => p.alive && p.role === "wolf");

  // Every role in the setup is called at night, dead or alive, so the
  // narration never tells the table which roles are gone.
  // Masons only meet on night 1, and only at a real table (seat games show them each other on screen).
  function nightSteps(g) { return NIGHT_ORDER.filter((r) => (g.setup[r] || 0) > 0 && (r !== "mason" || (g.nightNo === 1 && g.mode !== "seats" && g.setup.mason > 1))); }
  function currentStep(g) { return g.night ? g.night.steps[g.night.i] || null : null; }
  // A step with nobody to act (role dead, or wolves' meet-only first night).
  function stepIsIdle(g, step) {
    if (step === "wolf") return !aliveRole(g, "wolf") || (g.nightNo === 1 && !g.opts.firstNightKill);
    if (step === "mason") return true; // they only open their eyes and see each other
    return !aliveRole(g, step);
  }

  function validTargets(g, step, sub) {
    const L = living(g);
    const actor = actorOf(g, step);
    const notSelf = (p) => !actor || p.id !== actor.id;
    switch (step) {
      case "wolf": return L.filter((p) => p.role !== "wolf").map((p) => p.id);
      case "seer": return L.filter(notSelf).map((p) => p.id);
      case "doctor": return L.filter((p) => (g.opts.doctorSelf || notSelf(p)) && (g.opts.guardRepeat || p.id !== g.mem.doctorLast)).map((p) => p.id);
      case "bodyguard": return L.filter((p) => notSelf(p) && (g.opts.guardRepeat || p.id !== g.mem.bgLast)).map((p) => p.id);
      case "witch":
        if (sub === "poison") {
          if (g.mem.poisonUsed) return [];
          if (!g.opts.witchBoth && g.night && g.night.heal) return [];
          return L.filter(notSelf).map((p) => p.id);
        }
        return [];
      default: return [];
    }
  }
  function canHeal(g) {
    if (!g.night || g.mem.healUsed || g.night.wolf == null) return false;
    const w = actorOf(g, "witch");
    if (!w) return false;
    if (!g.opts.witchSelfHeal && g.night.wolf === w.id) return false;
    if (!g.opts.witchBoth && g.night.poison != null) return false;
    return true;
  }

  // ------------------------------------------------------------------ win
  function winnerNow(g) {
    const L = living(g);
    const w = L.filter((p) => p.role === "wolf").length;
    if (w === 0) return "village";
    if (g.opts.win === "all" ? w === L.length : w >= L.length - w) return "wolves";
    return null;
  }
  function checkWinner(g) {
    if (g.winner) return g.winner;
    const win = winnerNow(g);
    // A dying Hunter still gets their shot before the game is called.
    if (!win || g.pendingHunters.length) return null;
    g.winner = win;
    g.phase = "over";
    g.night = null;
    g.log.push({ t: "end", winner: win });
    return win;
  }

  function kill(g, id, cause) {
    const p = g.players[id];
    if (!p || !p.alive) return false;
    p.alive = false;
    if (g.opts.reveal) p.revealed = true;
    if (p.role === "hunter") g.pendingHunters.push(id);
    return true;
  }

  // ------------------------------------------------------------------ phases
  function startNight(g) {
    g.nightNo += 1;
    g.phase = "night";
    g.ballots = {};
    g.night = { steps: nightSteps(g), i: 0, wolfVotes: {}, wolf: null, seer: null, doctor: null, bodyguard: null, heal: false, poison: null, picked: {} };
    g.log.push({ t: "night", n: g.nightNo });
  }
  function startDay(g) {
    if (g.day === 0) g.day = 1;
    g.phase = "day";
    g.ballots = {};
    g.log.push({ t: "day", n: g.day });
  }

  function resolveNight(g) {
    const N = g.night;
    const guarded = [];
    if (N.doctor != null && aliveRole(g, "doctor")) guarded.push(N.doctor);
    if (N.bodyguard != null && aliveRole(g, "bodyguard")) guarded.push(N.bodyguard);
    let healed = false;
    if (N.heal && canHeal(g)) { g.mem.healUsed = true; healed = true; }
    let poison = null;
    if (N.poison != null && !g.mem.poisonUsed && aliveRole(g, "witch")) { g.mem.poisonUsed = true; poison = N.poison; }
    g.mem.doctorLast = aliveRole(g, "doctor") ? N.doctor : null;
    g.mem.bgLast = aliveRole(g, "bodyguard") ? N.bodyguard : null;
    const deaths = [];
    const attacked = N.wolf != null && aliveRole(g, "wolf") ? N.wolf : null;
    if (attacked != null && guarded.indexOf(attacked) < 0 && !healed && kill(g, attacked, "wolf")) deaths.push(attacked);
    if (poison != null && kill(g, poison, "poison")) deaths.push(poison);
    // The secret record of the night — only shown once the game is over.
    g.log.push({ t: "secret", n: g.nightNo, wolf: N.wolf, seer: N.seer, doctor: N.doctor, bodyguard: N.bodyguard, healed, poison });
    g.lastDeaths = deaths;
    g.night = null;
    g.day += 1;
    g.phase = "morning";
    g.log.push({ t: "dawn", n: g.day, deaths: deaths.slice() });
    checkWinner(g);
  }

  function advanceStep(g) {
    g.night.i += 1;
    if (g.night.i >= g.night.steps.length) resolveNight(g);
  }

  function tally(g) {
    const counts = {};
    living(g).forEach((p) => {
      const b = g.ballots[p.id];
      if (b != null) counts[b] = (counts[b] || 0) + 1;
    });
    let best = -1, top = [];
    Object.keys(counts).forEach((k) => {
      const c = counts[k];
      if (c > best) { best = c; top = [+k]; } else if (c === best) top.push(+k);
    });
    return { counts, top, best };
  }

  // ------------------------------------------------------------------ apply
  function fail(msg) { throw new Error(msg); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function apply(state, action) {
    const g = clone(state);
    applyMut(g, action);
    return g;
  }

  // seat null = the table / the host. In seats mode, a seat may only act for itself.
  function applyMut(g, a) {
    if (!a || !a.type) fail("No action");
    if (g.winner && a.type !== "note") fail("The game is over");
    const seats = g.mode === "seats";
    const me = a.seat == null ? null : g.players[a.seat];
    if (a.seat != null && !me) fail("No such seat");

    switch (a.type) {
      case "seen": { // table mode: next person has seen their card
        if (g.phase !== "reveal") fail("Not dealing");
        g.revealIdx += 1;
        if (g.revealIdx >= g.players.length) g.phase = "start";
        return;
      }
      case "start": {
        if (g.phase !== "start") fail("Already started");
        if (g.opts.dayFirst) startDay(g); else startNight(g);
        return;
      }
      case "pick": { // a night choice
        if (g.phase !== "night") fail("Not night");
        const step = currentStep(g);
        if (a.step !== step) fail("Not your turn");
        if (seats) {
          if (!me || !me.alive || me.role !== step) fail("Not your turn");
        }
        if (stepIsIdle(g, step)) fail("Nothing to do");
        const N = g.night;
        if (step === "wolf") {
          if (a.target == null || validTargets(g, "wolf").indexOf(a.target) < 0) fail("Pick a living non-wolf");
          if (seats) {
            N.wolfVotes[a.seat] = a.target;
            const ws = livingWolves(g);
            const votes = ws.map((w) => N.wolfVotes[w.id]);
            if (votes.every((v) => v != null && v === votes[0])) { N.wolf = votes[0]; advanceStep(g); }
          } else N.wolf = a.target;
          return;
        }
        if (step === "witch") {
          if (a.extra === "heal") {
            if (a.target === false) { N.heal = false; N.picked.heal = true; return; }
            if (!canHeal(g)) fail("Can't heal now");
            N.heal = true; N.picked.heal = true; return;
          }
          if (a.extra === "poison") {
            if (a.target == null) { N.poison = null; N.picked.poison = true; return; }
            if (validTargets(g, "witch", "poison").indexOf(a.target) < 0) fail("Can't poison that player");
            N.poison = a.target; N.picked.poison = true; return;
          }
          fail("Heal or poison?");
        }
        if (N.picked[step]) fail("Already chosen");
        if (validTargets(g, step).indexOf(a.target) < 0) fail("Not allowed");
        N[step] = a.target;
        N.picked[step] = true;
        if (step === "seer") {
          const t = g.players[a.target];
          const actor = actorOf(g, "seer");
          g.seerLog.push({ n: g.nightNo, by: actor.id, target: a.target, wolf: t.role === "wolf", role: g.opts.seerSees === "role" ? t.role : null });
          if (!seats) return; // table mode: the Seer reads the answer, then taps Done
          return;
        }
        if (seats) advanceStep(g); // doctor / bodyguard: one tap and done
        return;
      }
      case "done": { // finish the current night step
        if (g.phase !== "night") fail("Not night");
        const step = currentStep(g);
        if (a.step != null && a.step !== step) fail("Not your turn");
        if (a.seat == null) {
          if (seats && !stepIsIdle(g, step)) fail("Waiting on a player");
        } else if (!me.alive || me.role !== step) fail("Not your turn");
        if (!stepIsIdle(g, step)) {
          if (step === "seer" && !g.night.picked.seer) fail("Check someone first");
          if (step === "wolf" && g.night.wolf == null) fail("Pick a victim first");
        }
        advanceStep(g);
        return;
      }
      case "day": {
        if (g.phase !== "morning") fail("Not morning");
        if (g.pendingHunters.length) fail("The Hunter must shoot first");
        startDay(g);
        return;
      }
      case "night": {
        if (g.phase !== "dusk") fail("Finish the day first");
        if (g.pendingHunters.length) fail("The Hunter must shoot first");
        startNight(g);
        return;
      }
      case "shoot": {
        const h = a.by != null ? a.by : a.seat;
        if (g.pendingHunters.indexOf(h) < 0) fail("No Hunter shot waiting");
        if (seats && a.seat !== h) fail("Only the Hunter shoots");
        if (a.target != null) { // null = fires into the air
          const t = g.players[a.target];
          if (!t || !t.alive) fail("Pick a living player");
        }
        g.pendingHunters.splice(g.pendingHunters.indexOf(h), 1);
        if (a.target != null) kill(g, a.target, "hunter");
        g.log.push({ t: "shot", by: h, target: a.target, day: g.day });
        checkWinner(g);
        return;
      }
      case "claim": { // "<by> says: <target> is / isn't a wolf" (a Seer claim)
        if (g.phase !== "day" && g.phase !== "morning" && g.phase !== "dusk") fail("Claims happen by day");
        const by = seats ? a.seat : a.by;
        if (by == null || !g.players[by] || !g.players[a.target]) fail("Pick two players");
        if (by === a.target) fail("Pick someone else");
        if (seats && !g.players[by].alive) fail("Dead players can't talk");
        g.claims.push({ by, target: a.target, wolf: !!a.wolf, day: g.day });
        g.log.push({ t: "claim", day: g.day, by, target: a.target, wolf: !!a.wolf });
        return;
      }
      case "unclaim": {
        const i = a.index;
        if (!(i >= 0 && i < g.claims.length)) fail("No such claim");
        if (seats && g.claims[i].by !== a.seat) fail("You can only take back your own claim");
        const c = g.claims.splice(i, 1)[0];
        g.log.push({ t: "unclaim", day: g.day, by: c.by, target: c.target });
        return;
      }
      case "vote": { // table mode: the table voted this player out
        if (seats) fail("Vote with your seat");
        if (g.phase !== "day") fail("Not day");
        const p = g.players[a.target];
        if (!p || !p.alive) fail("Pick a living player");
        if (p.role === "prince") { // the Prince shows the card and stays in
          p.revealed = true;
          g.log.push({ t: "spared", day: g.day, target: a.target, counts: a.counts || null });
          g.phase = "dusk";
          return;
        }
        kill(g, a.target, "vote");
        g.log.push({ t: "vote", day: g.day, target: a.target, counts: a.counts || null });
        g.phase = "dusk";
        checkWinner(g);
        return;
      }
      case "noVote": {
        if (seats) fail("Vote with your seat");
        if (g.phase !== "day") fail("Not day");
        g.log.push({ t: "novote", day: g.day });
        g.phase = "dusk";
        return;
      }
      case "ballot": { // seats mode: one seat's vote (target null = skip)
        if (!seats) fail("Not a seat game");
        if (g.phase !== "day") fail("Not day");
        if (!me.alive) fail("Dead players don't vote");
        if (a.target != null && (!g.players[a.target] || !g.players[a.target].alive || a.target === a.seat)) fail("Pick a living player");
        g.ballots[a.seat] = a.target == null ? -1 : a.target;
        if (living(g).every((p) => g.ballots[p.id] != null)) {
          const r = tally(g);
          const counts = {};
          Object.keys(r.counts).forEach((k) => { if (+k >= 0) counts[k] = r.counts[k]; });
          const ballots = Object.assign({}, g.ballots);
          const out = r.top.length === 1 && r.top[0] >= 0 ? r.top[0] : null;
          if (out != null && g.players[out].role === "prince") { g.players[out].revealed = true; g.log.push({ t: "spared", day: g.day, target: out, counts, ballots }); }
          else if (out != null) { kill(g, out, "vote"); g.log.push({ t: "vote", day: g.day, target: out, counts, ballots }); }
          else g.log.push({ t: "novote", day: g.day, counts, ballots, tie: r.top.length > 1 });
          g.phase = "dusk";
          checkWinner(g);
        }
        return;
      }
      default: fail("Unknown action " + a.type);
    }
  }

  // ------------------------------------------------------------------ who acts
  function pendingActors(g) {
    if (g.winner) return [];
    if (g.pendingHunters.length) return g.pendingHunters.slice(0, 1);
    if (g.mode !== "seats") return [];
    if (g.phase === "night") {
      const step = currentStep(g);
      if (stepIsIdle(g, step)) return [];
      if (step === "wolf") {
        const ws = livingWolves(g);
        const votes = ws.map((w) => g.night.wolfVotes[w.id]);
        const agree = votes.every((v) => v != null && v === votes[0]);
        return agree ? [] : ws.filter((w) => g.night.wolfVotes[w.id] == null || votes.some((v) => v !== g.night.wolfVotes[w.id])).map((w) => w.id);
      }
      return [actorOf(g, step).id];
    }
    if (g.phase === "day") return living(g).filter((p) => g.ballots[p.id] == null).map((p) => p.id);
    return [];
  }

  // The moderator's own next step (the app adds pauses for the narrator).
  function hostAction(g) {
    if (g.winner || g.pendingHunters.length) return null;
    if (g.phase === "start") return { type: "start" };
    if (g.phase === "night") {
      const step = currentStep(g);
      if (stepIsIdle(g, step)) return { type: "done", seat: null, step };
      return null;
    }
    if (g.phase === "morning") return { type: "day" };
    if (g.phase === "dusk") return { type: "night" };
    return null;
  }

  // ------------------------------------------------------------------ view
  function view(g, seat) {
    const v = clone(g);
    const me = seat == null ? null : g.players[seat];
    const over = !!g.winner;
    const wolfView = me && me.role === "wolf";
    const masonView = me && me.role === "mason";
    v.players.forEach((p) => {
      const own = me && p.id === me.id;
      const see = over || p.revealed || own || (wolfView && p.role === "wolf") || (masonView && p.role === "mason");
      if (!see) p.role = null;
    });
    if (!over) {
      v.log = v.log.filter((e) => e.t !== "secret");
      v.seerLog = v.seerLog.filter((e) => me && e.by === me.id);
      v.mem = {
        doctorLast: me && me.role === "doctor" ? g.mem.doctorLast : null,
        bgLast: me && me.role === "bodyguard" ? g.mem.bgLast : null,
        healUsed: me && me.role === "witch" ? g.mem.healUsed : null,
        poisonUsed: me && me.role === "witch" ? g.mem.poisonUsed : null,
      };
      if (v.night) {
        const step = currentStep(g);
        const N = g.night;
        const keep = { steps: N.steps, i: N.i, wolfVotes: {}, wolf: null, seer: null, doctor: null, bodyguard: null, heal: false, poison: null, picked: {} };
        if (me && me.role === "wolf") { keep.wolfVotes = N.wolfVotes; keep.wolf = N.wolf; }
        if (me && me.role === "witch" && me.alive && step === "witch") { keep.wolf = N.wolf; keep.heal = N.heal; keep.poison = N.poison; keep.picked = N.picked; }
        if (me && me.alive && (me.role === "seer" || me.role === "doctor" || me.role === "bodyguard")) { keep[me.role] = N[me.role]; keep.picked[me.role] = N.picked[me.role]; }
        v.night = keep;
      }
      // Ballots stay secret until everyone has voted (then they're in the log).
      v.ballots = {};
      if (me && g.ballots[me.id] != null) v.ballots[me.id] = g.ballots[me.id];
      v.roles = null;
      v.seed = g.seed;
    }
    return v;
  }

  // ------------------------------------------------------------------ odds
  // Each player's chance of being a wolf from what the asker may know: the
  // setup, revealed roles, Seer claims, plus (optionally) their own card.
  // Exact enumeration over (wolf set, Seer); each pair is equally likely before
  // claims. A claim "C says T is / isn't a wolf" weighs a pair by:
  //   C is the real Seer -> 1 if the claim is true, else 0
  //   C is a wolf         -> CLAIM_WEIGHTS.wolf   (wolves sometimes fake-claim)
  //   C is anyone else    -> CLAIM_WEIGHTS.other  (rare)
  const CLAIM_WEIGHTS = { wolf: 0.5, other: 0.05 };

  function wolfOdds(info, weights) {
    weights = weights || CLAIM_WEIGHTS;
    const players = info.players; // [{id, known: role | "notwolf" | null}]
    const setup = info.setup;
    const claims = info.claims || [];
    const ids = players.map((p) => p.id);
    const known = {};
    players.forEach((p) => { if (p.known) known[p.id] = p.known; });
    const knownWolves = ids.filter((id) => known[id] === "wolf");
    const pool = ids.filter((id) => !known[id] || known[id] === "notwolf");
    const wolfPool = ids.filter((id) => !known[id]);
    const wolvesLeft = (setup.wolf || 0) - knownWolves.length;
    const fixedSeer = ids.find((id) => known[id] === "seer");
    const seerInPool = (setup.seer || 0) > 0 && fixedSeer == null;

    const tally = {}; ids.forEach((id) => { tally[id] = 0; });
    let total = 0;
    const isW = new Uint8Array(ids.length ? Math.max.apply(null, ids) + 1 : 0);
    knownWolves.forEach((id) => { isW[id] = 1; });

    function fallback() {
      const o = {};
      ids.forEach((id) => {
        if (known[id] && known[id] !== "notwolf") o[id] = known[id] === "wolf" ? 1 : 0;
        else if (known[id] === "notwolf") o[id] = 0;
        else o[id] = wolfPool.length ? Math.max(0, wolvesLeft) / wolfPool.length : 0;
      });
      return o;
    }
    if (wolvesLeft < 0 || wolvesLeft > wolfPool.length) return { odds: fallback(), total: 0, contradiction: true };

    function weightFor(seer) {
      let w = 1;
      for (let i = 0; i < claims.length; i++) {
        const c = claims[i];
        if (seer === c.by) { if ((isW[c.target] === 1) !== c.wolf) return 0; }
        else if (isW[c.by]) w *= weights.wolf;
        else w *= weights.other;
      }
      return w;
    }
    function visit() {
      let sum = 0;
      if (seerInPool) {
        for (let i = 0; i < pool.length; i++) { const s = pool[i]; if (!isW[s]) sum += weightFor(s); }
      } else sum = weightFor(fixedSeer == null ? -1 : fixedSeer);
      if (sum <= 0) return;
      total += sum;
      for (let i = 0; i < ids.length; i++) if (isW[ids[i]]) tally[ids[i]] += sum;
    }
    (function choose(start, left) {
      if (left === 0) { visit(); return; }
      for (let i = start; i <= wolfPool.length - left; i++) {
        isW[wolfPool[i]] = 1; choose(i + 1, left - 1); isW[wolfPool[i]] = 0;
      }
    })(0, wolvesLeft);

    if (total <= 0) return { odds: fallback(), total: 0, contradiction: claims.length > 0 };
    const odds = {};
    ids.forEach((id) => { odds[id] = tally[id] / total; });
    return { odds, total };
  }

  // Public info for the table's odds (never the secret roles). If `seat` is
  // given, that seat's own private knowledge is added (their card, wolf
  // partners, their own Seer results).
  function oddsInfo(g, seat) {
    const v = seat == null ? null : view(g, seat);
    const me = seat == null ? null : g.players[seat];
    const players = g.players.map((p) => {
      let known = p.revealed ? p.role : null;
      if (v && v.players[p.id].role) known = v.players[p.id].role;
      return { id: p.id, known };
    });
    if (me && me.role === "seer") {
      g.seerLog.forEach((r) => {
        if (r.by !== me.id) return;
        const cur = players[r.target];
        if (!cur.known) cur.known = r.wolf ? "wolf" : (r.role || "notwolf");
      });
    }
    return { players, setup: g.setup, claims: g.claims.map((c) => ({ by: c.by, target: c.target, wolf: c.wolf })) };
  }

  // ------------------------------------------------------------------ bots
  // Three levels. All read only what view(state, seat) shows them (a test
  // checks this). "normal" is the level the setup balance numbers use.
  //   easy   — random picks, random votes
  //   normal — Seer goes public once they find a wolf; the village votes out a
  //            named wolf, otherwise agrees on one uncleared player; guards cover
  //            a public Seer; the Witch heals the first victim and poisons a named wolf
  //   smart  — like normal, but uses the exact wolf odds for every choice and
  //            wolves counter-claim a Seer who names one of them
  function believedSeer(g) {
    const byes = [];
    g.claims.forEach((c) => { if (byes.indexOf(c.by) < 0) byes.push(c.by); });
    const ok = byes.filter((b) => { const p = g.players[b]; return !(p.revealed && p.role !== "seer"); });
    return ok.length === 1 ? ok[0] : null;
  }
  function knowledge(g, seat) {
    const me = g.players[seat];
    const wolves = new Set(), cleared = new Set([seat]);
    if (me.role === "wolf") g.players.forEach((p) => { if (p.role === "wolf") wolves.add(p.id); });
    if (me.role === "mason") g.players.forEach((p) => { if (p.role === "mason") cleared.add(p.id); });
    if (me.role === "seer") g.seerLog.forEach((r) => { if (r.by === seat) (r.wolf ? wolves : cleared).add(r.target); });
    g.players.forEach((p) => { if (p.revealed) (p.role === "wolf" ? wolves : cleared).add(p.id); });
    const bs = believedSeer(g);
    if (bs != null && !(me.role === "wolf" && wolves.has(bs))) {
      cleared.add(bs);
      g.claims.forEach((c) => { if (c.by === bs) (c.wolf ? wolves : cleared).add(c.target); });
      if (me.role === "wolf") { // wolves know the truth about their own team
        g.players.forEach((p) => { if (p.role === "wolf") wolves.add(p.id); else if (wolves.has(p.id)) wolves.delete(p.id); });
      }
    }
    return { wolves, cleared, believedSeer: bs };
  }
  // What the whole table knows: revealed cards + a single believed Seer's claims.
  function publicKnowledge(g) {
    const wolves = new Set(), cleared = new Set();
    g.players.forEach((p) => { if (p.revealed) (p.role === "wolf" ? wolves : cleared).add(p.id); });
    const bs = believedSeer(g);
    if (bs != null) {
      cleared.add(bs);
      g.claims.forEach((c) => { if (c.by === bs) (c.wolf ? wolves : cleared).add(c.target); });
    }
    return { wolves, cleared, believedSeer: bs };
  }
  function oddsFor(g, seat) {
    try { return wolfOdds(oddsInfo(g, seat)).odds; } catch (e) { return {}; }
  }
  // What the vote record says, from public facts only (ballots are public once a vote is
  // counted; cards are public once shown): who stood apart from a vote that caught a
  // wolf, and who pushed a vote that hit a villager.
  function voteRecord(g) {
    const s = {};
    g.log.forEach((e) => {
      if (e.t !== "vote" || !e.ballots) return;
      const out = g.players[e.target];
      if (!out || !out.revealed) return;
      const wolfOut = out.role === "wolf";
      Object.keys(e.ballots).forEach((k) => {
        const by = +k, b = e.ballots[k];
        if (by === e.target || b < 0) return;
        if (wolfOut) s[by] = (s[by] || 0) + (b === e.target ? -0.12 : 0.3);
        else if (b === e.target) s[by] = (s[by] || 0) + 0.1;
      });
    });
    return s;
  }
  // Smart computers' shared suspicion: the table's exact odds plus the vote record.
  function smartPublic(g) {
    const odds = oddsFor(g, null), vr = voteRecord(g), out = {};
    g.players.forEach((p) => { out[p.id] = (odds[p.id] || 0) + (vr[p.id] || 0); });
    return out;
  }
  // Top candidate by score, ties broken the same way by every bot today.
  function topBy(g, ids, score, salt) {
    let best = null, bs = -Infinity, bh = 0;
    ids.forEach((id) => {
      const s = score(id);
      const h = hash3(g.seed, g.day * 31 + g.nightNo + (salt || 0), id);
      if (s > bs + 1e-9 || (Math.abs(s - bs) <= 1e-9 && h > bh)) { best = id; bs = s; bh = h; }
    });
    return best;
  }

  const FAKE_CLAIM_PCT = 20;
  function botAction(g, seat, rng, level) {
    level = level || g.players[seat].level || "normal";
    const me = g.players[seat];
    if (g.winner) return null;
    rng = rng || Math.random;
    const L = living(g);
    const others = L.filter((p) => p.id !== seat).map((p) => p.id);

    if (g.pendingHunters[0] === seat) {
      if (!others.length) return null;
      if (level === "easy") return { type: "shoot", seat, target: pick(others, rng) };
      const K = knowledge(g, seat);
      const odds = level === "smart" ? oddsFor(g, seat) : null;
      const t = topBy(g, others, (id) => K.wolves.has(id) ? 2 : K.cleared.has(id) ? -1 : odds ? odds[id] || 0 : 0, 7);
      return { type: "shoot", seat, target: t };
    }
    if (!me.alive) return null;

    if (g.phase === "night") {
      const step = currentStep(g);
      if (me.role !== step || stepIsIdle(g, step)) return null;
      const N = g.night;
      if (step === "wolf") {
        const opts = validTargets(g, "wolf");
        if (!opts.length) return null;
        // Follow a partner who already chose (humans first), else choose.
        const ws = livingWolves(g);
        const lead = ws.find((w) => w.kind !== "bot" && N.wolfVotes[w.id] != null) || ws.find((w) => w.id !== seat && N.wolfVotes[w.id] != null);
        if (lead && N.wolfVotes[seat] === N.wolfVotes[lead.id]) return null;
        if (lead) return { type: "pick", seat, step, target: N.wolfVotes[lead.id] };
        if (N.wolfVotes[seat] != null) return null;
        let t;
        if (level === "easy") t = pick(opts, rng);
        else {
          const K = knowledge(g, seat);
          if (K.believedSeer != null && opts.indexOf(K.believedSeer) >= 0) t = K.believedSeer;
          else if (level === "smart") {
            const odds = wolfOdds(oddsInfo(g, null)).odds; // what the table thinks
            t = topBy(g, opts, (id) => -(odds[id] || 0) + rng() * 0.05, 3); // the most trusted
          } else t = pick(opts, rng);
        }
        return { type: "pick", seat, step, target: t };
      }
      if (step === "seer") {
        if (N.picked.seer) return { type: "done", seat, step };
        const checked = new Set(g.seerLog.filter((r) => r.by === seat).map((r) => r.target));
        let opts = validTargets(g, "seer").filter((id) => !checked.has(id));
        if (!opts.length) opts = validTargets(g, "seer");
        if (!opts.length) return { type: "done", seat, step };
        let t = pick(opts, rng);
        if (level === "smart") { const odds = oddsFor(g, seat); t = topBy(g, opts, (id) => (odds[id] || 0) + rng() * 0.05, 5); }
        return { type: "pick", seat, step, target: t };
      }
      if (step === "doctor" || step === "bodyguard") {
        const opts = validTargets(g, step);
        if (!opts.length) return { type: "done", seat, step };
        let t = pick(opts, rng);
        if (level !== "easy") {
          const K = knowledge(g, seat);
          if (K.believedSeer != null && opts.indexOf(K.believedSeer) >= 0) t = K.believedSeer;
        }
        return { type: "pick", seat, step, target: t };
      }
      if (step === "witch") {
        if (!N.picked.heal) {
          const healOK = canHeal(g);
          if (!healOK) return { type: "pick", seat, step, extra: "heal", target: false };
          const use = level === "easy" ? rng() < 0.5 : true;
          return { type: "pick", seat, step, extra: "heal", target: use ? true : false };
        }
        if (!N.picked.poison) {
          const opts = validTargets(g, "witch", "poison");
          let t = null;
          if (opts.length) {
            if (level === "easy") t = rng() < 0.15 ? pick(opts, rng) : null;
            else {
              const K = knowledge(g, seat);
              const known = opts.find((id) => K.wolves.has(id));
              if (known != null) t = known;
              else if (level === "smart") {
                const odds = oddsFor(g, seat);
                const best = topBy(g, opts, (id) => odds[id] || 0, 9);
                if ((odds[best] || 0) >= 0.6) t = best;
              }
            }
          }
          return { type: "pick", seat, step, extra: "poison", target: t };
        }
        return { type: "done", seat, step };
      }
      return null;
    }

    if (g.phase === "day") {
      if (g.ballots[seat] != null) return null;
      // Claims first (a Seer who found a wolf tells everything they know).
      if (level !== "easy" && me.role === "seer") {
        const mine = g.seerLog.filter((r) => r.by === seat);
        // Smart: someone else claiming to be the Seer is lying, so call them out (unless checked clean).
        if (level === "smart" && !g.claims.some((c) => c.by === seat)) {
          const fake = g.claims.find((c) => c.by !== seat && g.players[c.by].alive && !mine.some((r) => r.target === c.by && !r.wolf));
          if (fake) return { type: "claim", seat, target: fake.by, wolf: true };
        }
        const found = mine.some((r) => r.wolf) || (level === "smart" && g.claims.some((c) => c.by === seat));
        if (found) {
          const said = new Set(g.claims.filter((c) => c.by === seat).map((c) => c.target));
          const next = mine.find((r) => !said.has(r.target) && g.players[r.target]);
          if (next) return { type: "claim", seat, target: next.target, wolf: next.wolf };
        }
      }
      if (level === "smart" && me.role === "wolf") {
        // Counter-claim: a Seer claim naming a wolf gets answered once by the lowest living wolf.
        const ws = livingWolves(g).map((p) => p.id).sort((a, b) => a - b);
        const accuse = g.claims.find((c) => c.wolf && g.players[c.target].role === "wolf" && g.players[c.by].role !== "wolf" && g.players[c.by].alive);
        if (accuse && ws[0] === seat && !g.claims.some((c) => c.by === seat)) return { type: "claim", seat, target: accuse.by, wolf: true };
        // Sometimes a wolf claims to be the Seer first, so "the second claimer is the wolf" can't be learned.
        // Decided once per seat and day from the game's seed (the same answer however often it's asked).
        const wolfClaimed = g.claims.some((c) => g.players[c.by].role === "wolf");
        if (!wolfClaimed && g.day <= 2 && hash3(g.seed, g.day * 7 + 3, seat) % 100 < FAKE_CLAIM_PCT) {
          const pool = others.filter((id) => g.players[id].role !== "wolf" && !g.players[id].revealed);
          if (pool.length) return { type: "claim", seat, target: pool[hash3(g.seed, g.day, seat + 50) % pool.length], wolf: true };
        }
      }
      if (!others.length) return { type: "ballot", seat, target: null };
      if (level === "easy") return { type: "ballot", seat, target: pick(others, rng) };
      const K = knowledge(g, seat);
      // Smart: the table's odds plus the vote record (public, so the village agrees on one target);
      // the seat's own knowledge (its card, its Seer checks) still overrides.
      const odds = level === "smart" ? smartPublic(g) : null;
      const susp = (id) => K.wolves.has(id) ? 2 : K.cleared.has(id) ? -1 : odds ? odds[id] || 0 : 0;
      if (me.role === "wolf") {
        // Join the village's likely target unless it's a wolf; then push a villager.
        const P = publicKnowledge(g);
        const pubOdds = level === "smart" ? smartPublic(g) : null;
        const villageView = (id) => P.wolves.has(id) ? 2 : P.cleared.has(id) ? -1 : pubOdds ? pubOdds[id] || 0 : 0;
        const consensus = topBy(g, others, villageView, 1);
        if (consensus != null && g.players[consensus].role !== "wolf") return { type: "ballot", seat, target: consensus };
        // Smart wolves don't stand apart when the village has a partner: the vote record would give them away.
        // (Close to the end, when their votes could still save the partner, they fight for them.)
        const nW = livingWolves(g).length, nV = L.length - nW;
        if (level === "smart" && consensus != null && nV - nW >= 3) return { type: "ballot", seat, target: consensus };
        const nonWolves = others.filter((id) => g.players[id].role !== "wolf");
        return { type: "ballot", seat, target: nonWolves.length ? topBy(g, nonWolves, villageView, 2) : null };
      }
      return { type: "ballot", seat, target: topBy(g, others, susp, 1) };
    }
    return null;
  }

  // ------------------------------------------------------------------ simulation
  // A full game of computers. villageLevel / wolfLevel pick the bot level for
  // each team. Used for the setup balance numbers and the "How strong?" table.
  function simulateGame(setup, o) {
    o = o || {};
    const rng = o.rng || Math.random;
    const n = setupSize(setup);
    const names = [];
    for (let i = 0; i < n; i++) names.push("P" + i);
    const g = newGame(names, setup, { rng, mode: "seats", opts: o.opts, kinds: names.map(() => "bot") });
    g.players.forEach((p) => { p.level = p.role === "wolf" ? (o.wolfLevel || "normal") : (o.villageLevel || "normal"); });
    let guard = 0;
    while (!g.winner && guard++ < 5000) {
      const h = hostAction(g);
      if (h) { applyMut(g, h); continue; }
      const act = nextBotMove(g, pendingActors(g), rng);
      if (!act) break;
      applyMut(g, act);
    }
    return g.winner;
  }

  // Of the seats being waited on, the computer move to make next. By day, claims
  // go before any ballot so every voter hears them.
  function nextBotMove(g, seats, rng, isBot) {
    let first = null;
    for (let i = 0; i < seats.length; i++) {
      if (isBot && !isBot(seats[i])) continue;
      const a = botAction(g, seats[i], rng);
      if (!a) continue;
      if (a.type === "claim") return a;
      if (!first) { first = a; if (g.phase !== "day") return a; }
    }
    return first;
  }

  function simulateSetup(setup, games, seed, o) {
    const rng = mulberry32(seed == null ? 12345 : seed);
    let v = 0;
    for (let i = 0; i < games; i++) if (simulateGame(setup, Object.assign({}, o || {}, { rng })) === "village") v++;
    return { games, villageWins: v, village: v / games };
  }

  const api = {
    ROLE_KEYS, NIGHT_ORDER, TEAM, DEFAULT_OPTS, THEMES, ROLE_HELP, CLAIM_WEIGHTS,
    RULESETS, rulebookWolves, UW_POINTS, uwPoints,
    roleName, mulberry32, shuffle, setupSize, normalizeSetup, setupProblem,
    newGame, apply, applyMut, view, pendingActors, hostAction, botAction, nextBotMove, publicKnowledge,
    living, aliveRole, actorOf, nightSteps, currentStep, stepIsIdle, validTargets, canHeal,
    winnerNow, tally, wolfOdds, oddsInfo, knowledge,
    simulateGame, simulateSetup,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WW = api;
})(typeof window !== "undefined" ? window : globalThis);
