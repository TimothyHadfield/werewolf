/* Werewolf companion — UI. One state object, render() writes the screen,
 * clicks are delegated through data-act. The rules live in engine.js (WW).
 */
(function () {
  "use strict";
  const W = window.WW;
  const $app = document.getElementById("app");
  const $sheet = document.getElementById("sheet");
  const $toast = document.getElementById("toast");
  const KEY = "werewolf:v1";
  const BOT_NAMES = ["Ada", "Bo", "Cy", "Dee", "Eli", "Fay", "Gus", "Hal", "Ivy", "Jo", "Kit", "Lou", "Max", "Nia", "Oz", "Pia", "Rex", "Sky", "Tess"];

  // At most 14 characters, never cutting an emoji (a surrogate pair) in half.
  function cut14(v) { let s = String(v).slice(0, 14); const c = s.charCodeAt(s.length - 1); if (c >= 0xd800 && c <= 0xdbff) s = s.slice(0, -1); return s; }
  // ------------------------------------------------------------ storage
  const DEFAULT_STORE = {
    settings: { theme: "werewolf", ruleset: "ultimate", opts: Object.assign({}, W.RULESETS.ultimate.opts), voice: true, rate: "normal", level: "normal", timer: 0 },
    names: [], count: 8, cpuCount: 8, onCount: 6, choice: {}, custom: {}, game: null, undo: [], cpu: null, online: null,
  };
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && typeof s === "object" && !Array.isArray(s)) return clean(s);
    } catch (e) { /* private mode or bad JSON: start fresh */ }
    return JSON.parse(JSON.stringify(DEFAULT_STORE));
  }
  // A damaged or old save never breaks the app: every field is checked, bad ones fall back.
  function clean(s) {
    const D = JSON.parse(JSON.stringify(DEFAULT_STORE));
    const obj = (x) => x && typeof x === "object" && !Array.isArray(x);
    const pick = (v, ok, d) => (ok.indexOf(v) >= 0 ? v : d);
    const int = (v, lo, hi, d) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
    const st = obj(s.settings) ? s.settings : {};
    const out = D;
    out.settings.theme = pick(st.theme, ["werewolf", "mafia"], D.settings.theme);
    out.settings.ruleset = pick(st.ruleset, Object.keys(W.RULESETS).concat("custom"), D.settings.ruleset);
    out.settings.rate = pick(st.rate, ["slow", "normal", "fast"], D.settings.rate);
    out.settings.level = pick(st.level, ["easy", "normal", "smart"], D.settings.level);
    out.settings.timer = pick(st.timer, [0, 2, 3, 5], 0);
    out.settings.voice = st.voice !== false;
    const o = Object.assign({}, W.DEFAULT_OPTS);
    if (obj(st.opts)) Object.keys(W.DEFAULT_OPTS).forEach((k) => { if (typeof st.opts[k] === typeof W.DEFAULT_OPTS[k]) o[k] = st.opts[k]; });
    out.settings.opts = o;
    out.names = Array.isArray(s.names) ? s.names.slice(0, 20).map((n) => (typeof n === "string" ? cut14(n) : "")) : [];
    out.count = int(s.count, 4, 20, D.count);
    out.cpuCount = int(s.cpuCount, 5, 12, D.cpuCount);
    out.onCount = int(s.onCount, 5, 12, D.onCount);
    out.choice = obj(s.choice) ? s.choice : {};
    out.custom = obj(s.custom) ? s.custom : {};
    const okGame = (g, mode) => obj(g) && Array.isArray(g.players) && g.players.length >= 4 && typeof g.phase === "string" && g.mode === mode && obj(g.setup) && Array.isArray(g.log) && obj(g.opts) && obj(g.mem);
    out.game = okGame(s.game, "table") ? s.game : null;
    out.cpu = okGame(s.cpu, "seats") ? s.cpu : null;
    out.undo = out.game && Array.isArray(s.undo) ? s.undo.filter((g) => okGame(g, "table")) : [];
    out.online = obj(s.online) && typeof s.online.code === "string" && /^[A-Z0-9]{5}$/.test(s.online.code) ? { code: s.online.code } : null;
    return out;
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ } }
  let measured = {};
  try { measured = JSON.parse(localStorage.getItem(KEY + ":measured") || "{}") || {}; } catch (e) { measured = {}; }
  function saveMeasured() { try { localStorage.setItem(KEY + ":measured", JSON.stringify(measured)); } catch (e) {} }

  // ------------------------------------------------------------ ui state (not saved)
  const ui = {
    view: S.game && !S.game.winner ? "home" : "home",
    setupMode: "table", setupStep: 1, tab: "play",
    dealOpen: false, sel: null, nightKey: null, nightStage: "talk", say: "", poison: null, heal: false, seerShown: false,
    gen: 0, from: "home",
  };
  // ?fast in the URL speeds every pause up 20x (headless checks only).
  const FAST = /[?&]fast(?:[=&]|$)/.test(location.search) ? 0.05 : 1;
  // Optional sounds, celebrations and animations (js/fx.js + js/game-fx.js), switched in Settings.
  const FX = window.FX || null;
  if (FX) { FX.init({ game: "werewolf", accent: "#6ea8fe" }); if (window.WWFX) window.WWFX.init(FX, { scale: FAST }); }
  const sfx = (name, o) => { if (FX) FX.play(name, o); };
  function oops(msg) { sfx("error"); toast(msg); }
  const T = () => S.settings.theme;
  // Seat games: vs computer (this device) or online (a room). "Me" is the seat you hold.
  const SEATED = () => ui.mode === "cpu" || ui.mode === "online";
  const ME = () => (ui.mode === "online" ? (ui.osnap && ui.osnap.mySeat >= 0 ? ui.osnap.mySeat : 0) : 0);
  const pendingOf = (g) => (ui.mode === "online" ? (ui.osnap && ui.osnap.toAct) || [] : W.pendingActors(g));
  const RN = (role, plural) => W.roleName(role, T(), plural);
  const TH = () => W.THEMES[T()];

  // ------------------------------------------------------------ helpers
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (p) => Math.round(p * 100) + "%";
  function toast(msg) {
    $toast.textContent = msg; $toast.classList.remove("hidden");
    clearTimeout(toast._t); toast._t = setTimeout(() => $toast.classList.add("hidden"), 2400);
  }
  // red -> green for balance (closer to 50% = greener)
  function balColor(p) { const d = Math.min(1, Math.abs(p - 0.5) / 0.2); return "hsl(" + Math.round(130 * (1 - d)) + ",65%,58%)"; }
  // wolf odds: green (safe) -> red (likely wolf)
  function wolfColor(p) { const d = Math.min(1, p / 0.6); return "hsl(" + Math.round(130 * (1 - d)) + ",65%,58%)"; }
  const team = (r) => (r === "wolf" ? "wolf" : "village");

  const IC = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5M14.5 14.6c.8-.4 1.6-.6 2.5-.6 2.2 0 3.9 1.6 4.4 4"/></svg>',
    log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    cpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="7" width="14" height="11" rx="3"/><path d="M12 3v4M9 12h.01M15 12h.01M9.5 15.5h5"/></svg>',
    table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><circle cx="12" cy="3.5" r="1.4"/><circle cx="12" cy="20.5" r="1.4"/><circle cx="3.5" cy="12" r="1.4"/><circle cx="20.5" cy="12" r="1.4"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V4M4 20h16"/><path d="M7 15l4-5 3 3 5-6"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/></svg>',
    resume: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="#f0d39a"/></svg>',
    sun: '<svg viewBox="0 0 24 24" class="sun"><circle cx="12" cy="12" r="5" fill="#f0b354"/><g stroke="#f0b354" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>',
  };
  // Tiny emblems for chips (the full card art comes from art.js).
  const GLYPH = {
    wolf: '<path d="M3 4l3 3h4l3-3v6l-2 3H5L3 10z" fill="currentColor"/>',
    seer: '<path d="M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4-2.5 4-6.5 4-6.5-4-6.5-4z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2" fill="currentColor"/>',
    doctor: '<path d="M6 2h4v4h4v4h-4v4H6v-4H2V6h4z" fill="currentColor"/>',
    bodyguard: '<path d="M8 1.5l5.5 2v4c0 3.5-2.5 6-5.5 7-3-1-5.5-3.5-5.5-7v-4z" fill="currentColor"/>',
    witch: '<path d="M6 2h4v3l3 7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2l3-7z" fill="currentColor"/>',
    hunter: '<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 1v4M8 11v4M1 8h4M11 8h4" stroke="currentColor" stroke-width="1.6"/>',
    villager: '<path d="M2 8l6-5 6 5v6H2z" fill="currentColor"/>',
  };
  const glyph = (r) => '<span class="ri ' + team(r) + '"><svg viewBox="0 0 16 16">' + GLYPH[r] + "</svg></span>";
  function art(role, w) {
    try { if (window.WWArt) return role ? window.WWArt.role(role, T(), w || 120) : window.WWArt.back(w || 120); } catch (e) { /* fall through */ }
    const fill = role ? (role === "wolf" ? "#5a2121" : "#1f3157") : "#151a2c";
    return '<svg viewBox="0 0 120 160"><rect width="120" height="160" rx="12" fill="' + fill + '"/>' +
      (role ? '<g transform="translate(36 56) scale(3)" color="#fff">' + GLYPH[role] + "</g>" : '<g transform="translate(40 60) scale(1.7)">' + IC.moon.replace(/<\/?svg[^>]*>/g, "") + "</g>") + "</svg>";
  }
  function moonArt(cls) {
    try { if (window.WWArt && window.WWArt.moon) return window.WWArt.moon(120).replace("<svg", '<svg class="' + (cls || "") + '"'); } catch (e) {}
    return IC.moon.replace("<svg", '<svg class="' + (cls || "") + '"');
  }

  function q(key) { return '<button class="qmark" data-act="help" data-k="' + key + '" aria-label="Why?">?</button>'; }

  // ------------------------------------------------------------ setups & balance
  function playerNames(n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push((S.names[i] || "").trim() || "Player " + (i + 1));
    return out;
  }
  function cpuNames(n) {
    const you = (S.names[0] || "").trim() || "You";
    const pool = BOT_NAMES.filter((b) => b.toLowerCase() !== you.toLowerCase());
    return [you].concat(pool.slice(0, n - 1));
  }
  function presetOpts() { const r = W.RULESETS[S.settings.ruleset]; return r ? r.opts : null; }
  function optsMatchPreset() {
    const p = presetOpts();
    return !!p && Object.keys(p).every((k) => p[k] === S.settings.opts[k]);
  }
  function suggestions(n) {
    const rs = S.settings.ruleset;
    const data = window.WW_SETUPS && window.WW_SETUPS[rs] && window.WW_SETUPS[rs][n];
    if (data && optsMatchPreset()) return data.map((d) => ({ name: d.name, setup: d.setup, village: d.village, games: d.games }));
    // Outside the measured range (or custom rules): plain suggestions, measured live.
    const w = W.rulebookWolves(rs === "custom" ? "ultimate" : rs, n);
    const list = [
      { name: "Simple", setup: W.normalizeSetup({ wolf: w, seer: 1, doctor: 1 }, n) },
      { name: "Rulebook", setup: W.normalizeSetup({ wolf: w, seer: 1 }, n) },
    ];
    if (n >= 8) list.splice(1, 0, { name: "Full", setup: W.normalizeSetup({ wolf: w, seer: 1, doctor: 1, witch: 1, hunter: 1 }, n) });
    return list.filter((s) => !W.setupProblem(s.setup, n));
  }
  const mKey = (setup) => JSON.stringify([W.ROLE_KEYS.map((k) => setup[k] || 0), S.settings.opts]);
  const queue = [];
  let measuring = false;
  function liveVillage(setup) {
    const k = mKey(setup);
    if (measured[k]) return measured[k];
    if (queue.indexOf(k) < 0) { queue.push(k); setTimeout(runQueue, 30); }
    return null;
  }
  let worker = null;
  try { worker = new Worker("js/sim-worker.js?v=" + encodeURIComponent((window.WW_BUILD || "").replace("build ", ""))); } catch (e) { worker = null; }
  if (worker) {
    worker.onmessage = (e) => { finishMeasure(e.data.k, { village: e.data.village, games: e.data.games }); };
    worker.onerror = () => { worker = null; measuring = false; runQueue(); };
  }
  function finishMeasure(k, m) {
    measured[k] = m;
    saveMeasured();
    measuring = false;
    // Update the numbers in place: a full re-render here could swallow a tap.
    document.querySelectorAll("[data-mkey]").forEach((el) => {
      if (el.getAttribute("data-mkey") === k) el.innerHTML = pctHtml(m, el.getAttribute("data-pts"));
    });
    runQueue();
  }
  function runQueue() {
    if (measuring || !queue.length) return;
    measuring = true;
    const k = queue.shift();
    const [counts, opts] = JSON.parse(k);
    const setup = {}; W.ROLE_KEYS.forEach((r, i) => { setup[r] = counts[i]; });
    const GAMES = 2000;
    if (worker) { worker.postMessage({ k, setup, opts, games: GAMES }); return; }
    // No worker: small slices with breathing room so taps stay instant.
    const rng = W.mulberry32(20261019);
    let done = 0, wins = 0;
    (function chunk() {
      for (let i = 0; i < 20 && done < GAMES; i++, done++) if (W.simulateGame(setup, { rng, opts }) === "village") wins++;
      if (done < GAMES) { setTimeout(chunk, 16); return; }
      finishMeasure(k, { village: wins / GAMES, games: GAMES });
    })();
  }
  function currentSetup(n) {
    const list = suggestions(n);
    const ch = S.choice[n];
    if (ch === "custom") return W.normalizeSetup(S.custom[n] || list[0].setup, n);
    const i = typeof ch === "number" && list[ch] ? ch : bestIndex(list);
    return list[i].setup;
  }
  function bestIndex(list) {
    let bi = 0, bd = 9;
    list.forEach((s, i) => { const v = s.village != null ? s.village : null; if (v != null && Math.abs(v - 0.5) < bd) { bd = Math.abs(v - 0.5); bi = i; } });
    return bi;
  }

  // ------------------------------------------------------------ render root
  function render() {
    const v = ui.view;
    let html = "";
    try {
      if (v === "home") html = renderHome();
      else if (v === "setup") html = renderSetup();
      else if (v === "game") html = renderGame();
      else if (v === "lab") html = renderLab();
      else if (v === "rules") html = renderRules();
      else if (v === "online") html = renderOnline();
    } catch (e) {
      // A broken saved game must never leave a blank page: drop it and go home.
      if (v === "game") { if (ui.mode === "cpu") S.cpu = null; else if (ui.mode === "table") { S.game = null; S.undo = []; } save(); }
      ui.view = "home"; html = renderHome();
      setTimeout(() => toast("That game couldn't be opened."), 0);
    }
    // Remember when the screen last changed, so a double tap can't hit the next screen's button.
    const g = v === "game" ? G() : null;
    const key = [v, ui.mode, ui.setupStep, ui.dealOpen, ui.nightStage, g && g.phase, g && g.day, g && g.nightNo, g && g.night && g.night.i, g && g.revealIdx, g && g.log.length, g && g.seerLog && g.seerLog.length, g && g.pendingHunters && g.pendingHunters.length, g && g.ballots && Object.keys(g.ballots).length].join("|");
    if (key !== ui.screenKey) { ui.screenKey = key; ui.changedAt = Date.now(); }
    $app.innerHTML = html;
    const sc = $app.querySelector("[data-keep-scroll]");
    if (sc && ui.scrollTop) sc.scrollTop = ui.scrollTop;
  }
  function topbar(title, sub, left, right) {
    return '<header class="top">' + (left || "") + '<div class="grow"><h1>' + title + "</h1>" + (sub ? '<span class="sub">' + sub + "</span>" : "") + "</div>" + (right || "") + "</header>";
  }
  const backBtn = (act) => '<button class="icon-btn" data-act="' + (act || "back") + '" aria-label="Back">' + IC.back + "</button>";
  const gearBtn = '<button class="icon-btn" data-act="settings" aria-label="Settings">' + IC.gear + "</button>";

  // ------------------------------------------------------------ home
  function renderHome() {
    const th = TH();
    const live = S.game && !S.game.winner;
    const liveCpu = S.cpu && !S.cpu.winner;
    let items = "";
    if (live) items += menuItem("resume", IC.resume, "Resume table game", "Day " + Math.max(1, S.game.day) + " · " + S.game.players.length + " players", true);
    if (liveCpu) items += menuItem("resumeCpu", IC.resume, "Resume vs computer", "Day " + Math.max(1, S.cpu.day), !live);
    items += menuItem("newTable", IC.table, "Table game", "This phone runs the night", !live && !liveCpu);
    items += menuItem("newCpu", IC.cpu, "Play vs computer", "You and " + (S.cpuCount - 1) + " computers");
    items += S.online && S.online.code ? menuItem("resumeOnline", IC.resume, "Resume online", "Room " + S.online.code) : menuItem("online", IC.play, "Play online", "Friends on their own phones");
    items += menuItem("lab", IC.chart, "Setup lab", "Balance and computer strength");
    items += menuItem("rules", IC.book, "Rules", RS_NAME());
    return '<div class="home"><div class="stars"></div>' +
      '<div style="position:absolute;top:calc(8px + env(safe-area-inset-top));right:10px">' + gearBtn + "</div>" +
      '<div class="hero">' + moonArt("moon-big") + "<h1>" + th.title + '</h1><div class="tag">No moderator needed</div></div>' +
      '<nav class="menu">' + items + "</nav>" +
      '<div class="foot">' + esc(window.WW_BUILD || "") + "</div></div>";
  }
  const RS_NAME = () => (W.RULESETS[S.settings.ruleset] && optsMatchPreset() ? W.RULESETS[S.settings.ruleset].name : "Custom") + " rules";
  function menuItem(act, ic, title, sub, main) {
    return '<button class="menu-item' + (main ? " main-item" : "") + '" data-act="' + act + '"><span class="mi-ic">' + ic + '</span><span><b>' + title + "</b><small>" + esc(sub) + "</small></span></button>";
  }

  // ------------------------------------------------------------ setup
  function renderSetup() {
    const onl = ui.setupMode === "online";
    const cpu = ui.setupMode === "cpu" || onl;
    const n = setupCount();
    const min = cpu ? 5 : 4, max = cpu ? 12 : 20;
    const names = cpu ? cpuNames(n) : null;
    let nm = "";
    for (let i = 0; i < n; i++) {
      if (onl && i > 0) nm += '<div class="nm bot"><span class="seat">' + (i + 1) + '</span><input type="text" value="Open seat" disabled aria-label="Seat ' + (i + 1) + '"><span class="tagbot">Friend or computer</span></div>';
      else if (cpu && i > 0) nm += '<div class="nm bot"><span class="seat">' + (i + 1) + '</span><input type="text" value="' + esc(names[i]) + '" disabled aria-label="Computer ' + i + '"><span class="tagbot">' + esc(levelName(S.settings.level)) + "</span></div>";
      else nm += '<div class="nm"><span class="seat">' + (i + 1) + '</span><input type="text" data-name="' + i + '" maxlength="14" placeholder="' + (cpu ? "You" : "Player " + (i + 1)) + '" value="' + esc(S.names[i] || "") + '" aria-label="Name ' + (i + 1) + '" autocomplete="off"></div>';
    }
    const list = suggestions(n);
    const ch = S.choice[n];
    const selIdx = ch === "custom" ? -1 : typeof ch === "number" && list[ch] ? ch : bestIndex(list);
    let opts = "";
    list.forEach((s, i) => {
      const m = s.village != null ? { village: s.village, games: s.games } : liveVillage(s.setup);
      opts += setupRow(s.name, s.setup, m, i === selIdx, 'data-act="pickSetup" data-i="' + i + '"');
    });
    const custom = W.normalizeSetup(S.custom[n] || list[selIdx >= 0 ? selIdx : 0].setup, n);
    const cm = liveVillage(custom);
    opts += setupRow("Custom", custom, ch === "custom" ? cm : null, ch === "custom", 'data-act="pickCustom"', ch !== "custom");
    let customUI = "";
    if (ch === "custom") {
      customUI = '<div class="custom-roles">' + W.ROLE_KEYS.filter((r) => r !== "villager").map((r) => {
        const c = custom[r] || 0;
        const maxR = r === "wolf" ? Math.floor((n - 1) / 2) : 1;
        return '<div class="cr"><span class="nm">' + glyph(r) + esc(RN(r)) + '</span><span class="stepper"><button data-act="cust" data-r="' + r + '" data-d="-1" ' + (c <= (r === "wolf" ? 1 : 0) ? "disabled" : "") + ' aria-label="Fewer">−</button><span class="val">' + c + '</span><button data-act="cust" data-r="' + r + '" data-d="1" ' + (c >= maxR || custom.villager <= 0 ? "disabled" : "") + ' aria-label="More">+</button></span></div>';
      }).join("") + '<div class="cr"><span class="nm">' + glyph("villager") + esc(RN("villager", true)) + '</span><span class="val" style="padding-right:14px">' + custom.villager + "</span></div></div>";
    }
    const step = ui.setupStep;
    const playersCol = '<section class="col' + (step !== 1 ? " step-hidden" : "") + '"><div class="col-body">' +
      '<p class="label">Players</p><div class="count-row"><span class="muted">How many?</span><span class="stepper"><button data-act="count" data-d="-1" ' + (n <= min ? "disabled" : "") + ' aria-label="Fewer players">−</button><span class="big-n">' + n + '</span><button data-act="count" data-d="1" ' + (n >= max ? "disabled" : "") + ' aria-label="More players">+</button></span></div>' +
      '<p class="label">' + (cpu ? "Seats" : "Names") + "</p><div class=\"names\">" + nm + "</div></div>" +
      '<div class="col-foot phone-only"><button class="btn primary big" data-act="setupNext">Roles →</button></div></section>';
    const rolesCol = '<section class="col' + (step !== 2 ? " step-hidden" : "") + '"><div class="col-body">' +
      '<p class="label"><span class="grow">Roles · ' + esc(RS_NAME()) + "</span>" + '<span class="muted" style="text-transform:none;letter-spacing:0;font-weight:600">Village wins</span>' + q("balance") + "</p>" +
      '<div class="setup-list">' + opts + "</div>" + customUI + "</div>" +
      '<div class="col-foot"><button class="btn primary big" data-act="startGame">' + (onl ? "Create room" : cpu ? "Deal me in" : "Deal cards") + "</button></div></section>";
    return topbar(onl ? "New online room" : cpu ? "Play vs computer" : "Table game", "", backBtn(step === 2 ? "setupBack" : onl ? "back" : "home"), gearBtn) +
      '<div class="main"><div class="setup">' + playersCol + rolesCol + "</div></div>";
  }
  function setupRow(name, setup, m, sel, attrs, hidePct) {
    const chips = W.ROLE_KEYS.filter((r) => setup[r]).map((r) => '<span class="chip ' + team(r) + '">' + glyph(r) + (setup[r] > 1 ? setup[r] + " " : "") + esc(RN(r, setup[r] > 1)) + "</span>").join("");
    const pts = W.uwPoints(setup);
    const p = hidePct ? "" : pctHtml(m, pts);
    return '<button class="setup-opt' + (sel ? " sel" : "") + '" ' + attrs + '><span class="so-name">' + esc(name) + '</span><span class="so-pct" data-mkey="' + esc(mKey(setup)) + '" data-pts="' + pts + '">' + p + '</span><span class="so-roles">' + chips + "</span></button>";
  }
  function pctHtml(m, pts) {
    return m ? '<b style="color:' + balColor(m.village) + '">' + pct(m.village) + "</b><small>UW " + fmtPts(+pts) + "</small>" : '<b class="muted">…</b><small>measuring</small>';
  }
  function setupCount() { return ui.setupMode === "cpu" ? S.cpuCount : ui.setupMode === "online" ? S.onCount : S.count; }
  const fmtPts = (x) => (x > 0 ? "+" : "") + x;
  // The level the computers in this game were dealt with (Settings changes only new games).
  const botLevel = (g) => { const b = g.players.find((p) => p.kind === "bot" && p.level); return b ? b.level : S.settings.level; };
  const levelName = (l) => ({ easy: "Easy", normal: "Normal", smart: "Smart" }[l] || "Normal");

  // ------------------------------------------------------------ game (both modes)
  function G() { return ui.mode === "cpu" ? S.cpu : ui.mode === "online" ? ui.og : S.game; }
  function renderGame() {
    if (ui.mode === "online" && (!ui.osnap || (ui.osnap.status !== "playing" && ui.osnap.status !== "finished") || !ui.og)) return renderLobby();
    const g = G();
    if (!g) { ui.view = "home"; return renderHome(); }
    if (g.winner) return renderOver(g);
    if (ui.mode === "table" && g.phase === "reveal") return renderDeal(g);
    if (ui.mode === "table" && g.phase === "start") return renderReady(g);
    if (g.phase === "night") return SEATED() ? renderCpuNight(g) : renderNight(g);
    if (ui.mode === "cpu" && g.phase === "start") return renderReady(g);
    return renderDay(g);
  }
  function gameTop(g, title, sub) {
    const canUndo = ui.mode === "table" && S.undo.length > 0 && g.phase !== "night" && g.phase !== "reveal";
    const left = '<button class="icon-btn" data-act="home" aria-label="Menu">' + IC.back + "</button>";
    const right = (ui.mode === "table" ? '<button class="icon-btn" data-act="undo" aria-label="Undo" ' + (canUndo ? "" : "disabled") + ">" + IC.undo + "</button>" : "") + gearBtn;
    return topbar(title, sub, left, right);
  }
  function gameShell(g, title, sub, mainHtml, opts) {
    opts = opts || {};
    const tabs = opts.noTabs ? "" : '<nav class="tabbar game-tabs"><button class="' + (ui.tab === "play" ? "sel" : "") + '" data-act="tab" data-t="play">' + IC.play + 'Play</button><button class="' + (ui.tab === "log" ? "sel" : "") + '" data-act="tab" data-t="log">' + IC.log + "Log</button></nav>";
    const showLogInMain = !opts.noTabs && ui.tab === "log";
    const side = opts.noSide ? "" : '<aside class="side"><div class="pad scroll" style="flex:1">' + renderLog(g) + "</div></aside>";
    return (opts.noTop ? "" : gameTop(g, title, sub)) +
      '<div class="main' + (opts.night ? " night-main" : "") + '">' + (opts.night ? '<div class="night-bg"><div class="stars"></div></div>' : "") +
      '<div class="pane">' + (showLogInMain ? '<div class="pad scroll" style="flex:1">' + renderLog(g) + "</div>" : mainHtml) + "</div>" + side + "</div>" + tabs;
  }

  // ---- deal (pass the phone)
  function renderDeal(g) {
    const p = g.players[g.revealIdx];
    const open = ui.dealOpen;
    const dots = g.players.map((_, i) => '<i class="' + (i < g.revealIdx ? "done" : i === g.revealIdx ? "now" : "") + '"></i>').join("");
    let info = '<p class="role-title" style="visibility:hidden">·</p><p class="role-help">Make sure nobody else can see, then tap the card.</p>';
    if (open) {
      const partners = p.role === "wolf" ? g.players.filter((x) => x.role === "wolf" && x.id !== p.id).map((x) => esc(x.name)) : [];
      info = '<p class="role-title ' + team(p.role) + '">' + esc(RN(p.role)) + '</p><p class="role-help">' + esc(roleHelp(p.role, g)) +
        (p.role === "wolf" ? "<br><b>" + (partners.length ? "Your pack: " + partners.join(", ") : "You hunt alone.") + "</b>" : "") + "</p>";
    }
    // The role deck: a real stack that gets thinner with every card dealt.
    const left = g.players.length - g.revealIdx - 1;
    const main = '<div class="deal tbl-surface tbl-wood-dark"><div class="ww-deck" aria-label="' + left + ' cards left">' + deckHtml(left) + "</div>" +
      '<div class="who">Pass the phone to<b>' + esc(p.name) + "</b></div>" +
      '<button class="flip' + (open ? " open" : "") + '" data-act="flip" aria-label="Show my card"><span class="flip-in">' + (open ? '<span class="face front">' + art(p.role, 220) + "</span>" : '<span class="face back">' + art(null, 220) + "</span>") + "</span></button>" +
      info + '<button class="btn ' + (open ? "primary" : "ghost") + ' big" style="min-width:220px" data-act="dealNext" ' + (open ? "" : "disabled") + ">" + (g.revealIdx === g.players.length - 1 ? "Hide · done" : "Hide · pass on") + "</button>" +
      '<div class="dots">' + dots + "</div></div>";
    return gameShell(g, "Deal", (g.revealIdx + 1) + " of " + g.players.length, main, { noTabs: true, noSide: true });
  }
  function roleHelp(role, g) {
    const o = g.opts;
    let h = W.ROLE_HELP[role];
    if (role === "seer" && o.seerSees === "role") h = "Each night, look at one player's card.";
    if (role === "doctor") h += o.doctorSelf ? " You may pick yourself." : " Not yourself.";
    if ((role === "doctor" || role === "bodyguard") && !o.guardRepeat) h += " Never the same player two nights running.";
    if (role === "wolf" && !o.firstNightKill) h += " The first night you only meet.";
    return h.replace(/wolves/g, TH().wolves.toLowerCase() === "mafia" ? "Mafia" : "wolves").replace(/a wolf/g, T() === "mafia" ? "Mafia" : "a wolf");
  }
  function renderReady(g) {
    const first = g.opts.dayFirst ? "day" : "night";
    const center = (first === "night" ? moonArt("wait-moon") : IC.sun.replace('class="sun"', 'class="wait-moon"')) +
      '<p class="role-title village" style="color:var(--text)">Everyone has a card</p><p class="role-help">' + (first === "night" ? "Put the phone in the middle. The narrator will guide the night." : "The game opens with a day of talk.") + "</p>";
    const seated = SEATED() ? ME() : null;
    const main = playScreen(ring(g, [], { me: seated }, center), "", '<button class="btn primary big" data-act="begin">' + (first === "night" ? "Start the night" : "Start the day") + "</button>");
    return gameShell(g, "Ready", "", main, { noTabs: true, noSide: true });
  }

  // ------------------------------------------------------------ the table
  // Everyone sits round a real table with their role card in front of them: face down while
  // alive, turned face up when it is shown. Your seat (vs computer / online) is at the bottom,
  // your card peeked face up. The middle of the table holds the narrator's news.
  const turned = new Set(); // "seed:id": cards already turned face up on screen, so each turns once
  function cardHtml(role, w, cls) {
    return '<span class="ww-pc tbl-card' + (cls ? " " + cls : "") + '">' + art(role, w) + "</span>";
  }
  function seatCard(g, p, faceUp) {
    const key = g.seed + ":" + p.id;
    let turnNow = false;
    if (faceUp && !turned.has(key)) { turned.add(key); turnNow = true; }
    // One face is shown at a time (WebKit ignores backface hiding under filters); a newly shown
    // card starts face down and turns over in 3-D after it is drawn (turnCard).
    const front = faceUp ? '<span class="tbl-face ww-face' + (turnNow ? " ww-hide" : "") + '">' + art(p.role, 90) + "</span>" : "";
    const back = !faceUp || turnNow ? '<span class="tbl-face ww-back">' + art(null, 90) + "</span>" : "";
    return '<span class="ww-card tbl-card' + (turnNow ? " ww-turn" : "") + '">' + front + back + "</span>";
  }
  // Turn a card over: rotate to edge-on, swap to the face, rotate back down. Transform only.
  function turnCard(el) {
    const swap = () => { const b = el.querySelector(".ww-back"), f = el.querySelector(".ww-face"); if (b) b.remove(); if (f) f.classList.remove("ww-hide"); };
    if (!el.animate || !(window.TABLE ? window.TABLE.animOn() : true)) { swap(); return; }
    const sp = FX && FX.settings && FX.settings.animSpeed === "fast" ? 0.55 : 1;
    const d = Math.max(60, 190 * sp);
    const base = "perspective(400px) ";
    const a = el.animate([{ transform: base + "rotateY(0deg)" }, { transform: base + "rotateY(90deg) scale(1.06)" }], { duration: d, easing: "ease-in" });
    let b = null;
    a.onfinish = () => { swap(); b = el.animate([{ transform: base + "rotateY(-90deg) scale(1.06)" }, { transform: base + "rotateY(0deg)" }], { duration: d, easing: "ease-out" }); };
    a.oncancel = swap;
    // Never leave a card standing on its edge (a stalled or background tab): settle it flat.
    setTimeout(() => { try { a.cancel(); if (b) b.cancel(); } catch (e) {} swap(); }, d * 2 + 400);
  }
  function deckHtml(n) {
    if (!n) return '<span class="ww-dcard tbl-spot"></span>';
    const st = window.TABLE ? window.TABLE.stackShadow(n, { perCard: 0.6, max: 12 }) : { thickness: 0, shadow: "" };
    return '<span class="ww-dcard ww-pc tbl-card" style="box-shadow:' + st.shadow + ";transform:translateY(" + -st.thickness + 'px)">' + art(null, 60) + '</span><span class="tbl-badge">' + n + "</span>";
  }
  function ring(g, ids, opts, center) {
    opts = opts || {};
    const n = g.players.length;
    const start = opts.me != null ? opts.me : 0;
    const size = n <= 8 ? "s-l" : n <= 12 ? "s-m" : "s-s";
    const seats = g.players.map((p) => {
      const pos = (p.id - start + n) % n; // 0 = the bottom edge, then round to your left
      const can = ids.indexOf(p.id) >= 0;
      const me = opts.me === p.id;
      const faceUp = !!(opts.allUp || me || (!p.alive && p.revealed));
      const sub = opts.sub ? opts.sub(p) : "";
      let odd = "";
      if (opts.odds && opts.odds[p.id] != null && p.alive) {
        const o = opts.odds[p.id];
        odd = '<span class="odds" style="color:' + wolfColor(o) + '">' + pct(o) + '</span><span class="bar"><i style="width:' + Math.round(o * 100) + "%;background:" + wolfColor(o) + '"></i></span>';
      }
      const j = window.TABLE ? window.TABLE.jitter(g.seed + ":seat", p.id, { rot: 5, off: 0 }) : { r: 0 };
      return '<button class="pbtn ww-seat' + (opts.sel === p.id ? " sel" : "") + (p.alive ? "" : " dead") + (odd ? " has-odds" : "") + (me ? " me" : "") +
        '" data-act="' + (opts.act || "sel") + '" data-id="' + p.id + '" data-pos="' + pos + '" style="--r:' + j.r + 'deg" ' + (can ? "" : "disabled") + ">" +
        seatCard(g, p, faceUp) + '<span class="pn tbl-plate">' + esc(p.name) + "</span>" + (sub ? '<span class="ps">' + sub + "</span>" : "") + odd + "</button>";
    }).join("");
    return '<div class="ww-table tbl-surface tbl-wood-dark ' + size + (ids.length ? " picking" : "") + (opts.night ? " is-night" : "") + '" data-size="' + size + '">' + seats +
      '<div class="ww-center" data-keep-scroll><div class="ww-cin">' + (center || "") + "</div></div></div>";
  }
  function playScreen(table, strip, foot, cls) {
    return '<div class="day ww-play' + (cls ? " " + cls : "") + '">' + (strip || "") + table + (foot ? '<div class="day-foot">' + foot + "</div>" : "") + "</div>";
  }
  // Seats evenly spaced (by distance, not angle) round a rounded-rectangle table edge.
  // ux / uy (optional): measure distance in seat widths / heights, so a crowded table puts
  // fewer of its wide seats on the top and bottom edges and more down the sides.
  function ringPoints(n, rx, ry, ux, uy) {
    ux = ux || 1; uy = uy || 1;
    const P = 4, M = 720, t0 = Math.PI / 2;
    const f = (t) => { const c = Math.cos(t), s = Math.sin(t); return { x: rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / P), y: ry * Math.sign(s) * Math.pow(Math.abs(s), 2 / P) }; };
    const pts = [], len = [0];
    for (let k = 0; k <= M; k++) pts.push(f(t0 + (2 * Math.PI * k) / M));
    for (let k = 1; k <= M; k++) len.push(len[k - 1] + Math.hypot((pts[k].x - pts[k - 1].x) / ux, (pts[k].y - pts[k - 1].y) / uy));
    const out = [];
    let k = 0;
    for (let i = 0; i < n; i++) { const want = (len[M] * i) / n; while (k < M && len[k + 1] < want) k++; out.push(pts[k]); }
    return out;
  }
  // The table fills its space: the cards round it grow to the largest size at which no two
  // seats (card, name plate, odds, label) touch, nothing pokes off the table and the middle
  // still holds its news slips. Each card style (s-l with the odds under the name, s-m, s-s
  // with the markers laid on the card) is scaled smoothly; the biggest card wins.
  const SIZES = ["s-l", "s-m", "s-s"];
  const fitMemo = new Map();
  function layoutTables() {
    document.querySelectorAll(".ww-table").forEach(fitTable);
  }
  function fitTable(t) {
    if (!t.querySelector(".ww-seat")) return;
    const W = t.clientWidth, H = t.clientHeight;
    const seats = [...t.querySelectorAll(".ww-seat")];
    const sig = [W, t.dataset.size, seats.map((s) => (s.classList.contains("dead") ? "d" : "") + (s.classList.contains("has-odds") ? "o" : "") + (s.classList.contains("me") ? "m" : "") + s.querySelector(".pn").textContent + "/" + ((s.querySelector(".ps") || {}).textContent || "")).join(",")].join("|");
    // Same seats, about the same space (a footer button that wrapped to two lines): keep the
    // card size steady, so nothing resizes under the finger.
    const last = fitMemo.get(sig);
    if (last && Math.abs(last.H - H) < 48 && applyFit(t, last.cls, last.k, last.bySize, 0)) return;
    const start = Math.max(0, SIZES.indexOf(t.dataset.size || "s-l"));
    // Biggest card for one way of treating the middle. A smaller card style (markers laid on the
    // card) only wins when the bigger style's card is still small (a phone) and it is clearly bigger.
    const tierBest = (roomy) => {
      let best = null;
      for (let c = start; c < SIZES.length; c++) {
        for (const bySize of [false, true]) {
          let lo = 0.7, hi = 2.4, got = null;
          if (applyFit(t, c, lo, bySize, roomy)) {
            got = lo;
            for (let it = 0; it < 7; it++) { const mid = (lo + hi) / 2; if (applyFit(t, c, mid, bySize, roomy)) { got = mid; lo = mid; } else hi = mid; }
          }
          if (got == null) continue;
          const cw = fitBase(t, c).cw * got;
          if (!best || (c === best.cls ? cw > best.cw : best.cw < 56 && cw > best.cw * 1.08)) best = { cls: c, k: got, bySize, cw, roomy };
        }
      }
      return best;
    };
    // First keep all the news in the middle in view. If that leaves small cards, letting a long
    // list scroll in a roomy middle may give clearly bigger ones. Last, size the seats on their own.
    let best = tierBest(2);
    if (!best || best.cw < 40) { const b1 = tierBest(1); if (b1 && (!best || b1.cw > best.cw * 1.3)) best = b1; }
    if (!best) best = tierBest(0);
    if (!best) {
      // Nothing fits (a tiny screen): the smallest style at its smallest size, the least crowded way.
      const c = SIZES.length - 1;
      let pick = { cls: c, k: 0.7, bySize: false, n: Infinity };
      for (const bySize of [false, true]) { applyFit(t, c, 0.7, bySize); const n = seatClashes(t); if (n < pick.n) pick = { cls: c, k: 0.7, bySize, n }; }
      best = pick;
      best.fallback = true;
    }
    applyFit(t, best.cls, best.k, best.bySize, 0);
    if (!best.fallback) fitMemo.set(sig, { H, cls: best.cls, k: best.k, bySize: best.bySize });
    if (fitMemo.size > 60) fitMemo.delete(fitMemo.keys().next().value);
  }
  // Base card / seat width and fonts of a style at this screen size (from the stylesheet).
  const baseMemo = new Map();
  function fitBase(t, c) {
    const key = SIZES[c] + innerWidth + "x" + innerHeight;
    if (baseMemo.has(key)) return baseMemo.get(key);
    if (t._fitBase && t._fitBase[key]) return t._fitBase[key];
    t.classList.remove("fit");
    ["--cw", "--sw"].forEach((v) => t.style.removeProperty(v));
    SIZES.forEach((s, i) => t.classList.toggle(s, i === c));
    const cs = getComputedStyle(t);
    const fsOf = (sel) => { const e = t.querySelector(sel); return e ? parseFloat(getComputedStyle(e).fontSize) : 12; };
    const b = { cw: parseFloat(cs.getPropertyValue("--cw")) || 40, sw: parseFloat(cs.getPropertyValue("--sw")) || 80, pf: fsOf(".ww-seat .tbl-plate"), of: fsOf(".ww-seat .odds"), sf: fsOf(".ww-seat .ps") };
    // Only remember it when every kind of marker was there to measure.
    if (t.querySelector(".ww-seat .odds") && t.querySelector(".ww-seat .ps")) baseMemo.set(key, b);
    (t._fitBase = t._fitBase || {})[key] = b; // this table measures each style once
    return b;
  }
  // Lay the table out at style c, scale k; true when it fits.
  function applyFit(t, c, k, bySize, roomy) {
    const b = fitBase(t, c);
    SIZES.forEach((s, i) => t.classList.toggle(s, i === c));
    t.classList.add("fit");
    // Text grows more slowly than the cards and never drops below the readable floor.
    const fk = Math.min(1.45, Math.max(1, 1 + (k - 1) * 0.6));
    t.style.setProperty("--cw", (b.cw * k).toFixed(1) + "px");
    t.style.setProperty("--sw", (b.sw * k).toFixed(1) + "px");
    t.style.setProperty("--pf", Math.max(10, Math.round(b.pf * fk)) + "px");
    t.style.setProperty("--of", Math.max(12, Math.round(b.of * fk)) + "px");
    t.style.setProperty("--sf", Math.max(10, Math.round(b.sf * fk)) + "px");
    placeSeats(t, bySize);
    if (seatClashes(t)) return false;
    const W = t.clientWidth, H = t.clientHeight;
    const card = t.querySelector(".ww-seat:not(.me) .ww-card") || t.querySelector(".ww-card");
    if (card && card.offsetHeight > Math.max(H * 0.22, 40) && k > 0.7) return false;
    const ctr = t.querySelector(".ww-center");
    if (ctr) {
      if (ctr.clientWidth < Math.min(W * 0.5, 320)) return false;
      const scrolls = ctr.scrollHeight > ctr.clientHeight + 1;
      if (scrolls && (roomy === 2 || (roomy === 1 && ctr.clientHeight < H * 0.42))) return false;
    }
    return true;
  }
  // An element's on-screen box relative to the table. A card that is turning over right now is
  // scaled up for a moment; it counts at its resting size, so the turn can't shrink the table.
  function boxIn(t, e, tr) {
    if (e.getAnimations && e.getAnimations().length) {
      let x = 0, y = 0, n = e;
      while (n && n !== t) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      if (n === t) return { left: x, top: y, right: x + e.offsetWidth, bottom: y + e.offsetHeight };
    }
    const r = e.getBoundingClientRect();
    return { left: r.left - tr.left, top: r.top - tr.top, right: r.right - tr.left, bottom: r.bottom - tr.top };
  }
  // How many pairs of seats touch (cards, plates, odds and labels), plus anything off the table.
  function seatClashes(t) {
    const tr = t.getBoundingClientRect(), W = tr.width, H = tr.height;
    const boxes = [];
    let n = 0;
    t.querySelectorAll(".ww-seat").forEach((s, i) => s.querySelectorAll(".ww-card,.tbl-plate,.odds,.ps,.bar").forEach((e) => {
      if (!e.offsetParent || !e.offsetWidth) return;
      const r = boxIn(t, e, tr);
      if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) n++;
      boxes.push({ i, r });
    }));
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      if (boxes[a].i === boxes[b].i) continue;
      const A = boxes[a].r, B = boxes[b].r;
      if (Math.min(A.right, B.right) - Math.max(A.left, B.left) > 1 && Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top) > 1) n++;
    }
    return n;
  }
  function placeSeats(t, bySize) {
    {
      const seats = [...t.querySelectorAll(".ww-seat")];
      const W = t.clientWidth, H = t.clientHeight;
      // What pokes out past each seat's box (a role label wider than the card), measured in one pass.
      const ext = seats.map((s) => {
        const sr = s.getBoundingClientRect();
        const e = { l: 0, r: 0, t: 0, b: 0 };
        s.querySelectorAll(".tbl-plate,.odds,.ps,.bar").forEach((c) => {
          if (!c.offsetParent || !c.offsetWidth) return;
          const r = c.getBoundingClientRect();
          e.l = Math.max(e.l, sr.left - r.left); e.r = Math.max(e.r, r.right - sr.right);
          e.t = Math.max(e.t, sr.top - r.top); e.b = Math.max(e.b, r.bottom - sr.bottom);
        });
        return e;
      });
      let sw = 0, sh = 0, mh = 0;
      seats.forEach((s, i) => {
        const w = s.offsetWidth + ext[i].l + ext[i].r, h = s.offsetHeight + ext[i].t + ext[i].b;
        if (s.classList.contains("me")) mh = h; else { sw = Math.max(sw, w); sh = Math.max(sh, h); }
      });
      if (!mh) mh = sh;
      const pad = 3;
      const cy = H / 2 + (sh - mh) / 4;
      const pts = ringPoints(seats.length, Math.max(8, W / 2 - sw / 2 - pad), Math.max(8, H / 2 - (sh + mh) / 4 - pad), bySize ? sw : 1, bySize ? sh : 1);
      seats.forEach((s, i) => {
        const p = pts[+s.dataset.pos] || { x: 0, y: 0 };
        const w = s.offsetWidth, h = s.offsetHeight, e = ext[i];
        const x = Math.max(pad + e.l, Math.min(W - w - pad - e.r, W / 2 + p.x - w / 2));
        const y = Math.max(pad + e.t, Math.min(H - h - pad - e.b, cy + p.y - h / 2));
        s.style.left = Math.round(x) + "px"; s.style.top = Math.round(y) + "px";
      });
      const c = t.querySelector(".ww-center");
      if (c) { c.style.left = c.style.right = Math.round(sw + 8) + "px"; c.style.top = Math.round(sh + 6) + "px"; c.style.bottom = Math.round(mh + 6) + "px"; }
    }
  }
  // After each draw: lay the seats out, turn newly shown cards with a 3-D flip, deal from the deck.
  function afterDraw() {
    layoutTables();
    const fresh = [...document.querySelectorAll(".ww-turn")];
    fresh.forEach((el, i) => {
      el.classList.remove("ww-turn");
      setTimeout(() => turnCard(el), (60 + i * 70) * Math.max(FAST, 0.2));
    });
    const g = ui.view === "game" && ui.mode === "table" ? S.game : null;
    if (g && g.phase === "reveal" && !ui.dealOpen) {
      const k = g.seed + ":" + g.revealIdx;
      if (ui.dealt !== k) {
        ui.dealt = k;
        const deck = document.querySelector(".ww-deck .ww-dcard"), card = document.querySelector(".deal .flip");
        if (window.TABLE && deck && card && window.TABLE.animOn()) {
          card.style.opacity = "0";
          window.TABLE.deal(deck, card, { face: cardHtml(null, 60, "ww-ghost"), duration: 380 }).then(() => { card.style.opacity = ""; });
        }
      }
    }
  }
  window.addEventListener("resize", () => layoutTables());

  // ---- table-mode night
  function narration(step, phase, g) {
    const R = RN(step === "wolf" ? "wolf" : step, step === "wolf");
    if (phase === "wake") {
      if (step === "wolf") return g.nightNo === 1 && !g.opts.firstNightKill ? R + ", open your eyes and find each other." : R + ", open your eyes. Choose your victim.";
      if (step === "seer") return R + ", open your eyes. Choose a player to " + (g.opts.seerSees === "role" ? "look at." : "check.");
      if (step === "doctor" || step === "bodyguard") return R + ", open your eyes. Choose someone to protect.";
      if (step === "witch") return R + ", open your eyes. Here is tonight's victim.";
    }
    return R + ", close your eyes.";
  }
  function nightKey(g) { return g.nightNo + ":" + g.night.i; }
  function enterNightStep() {
    // Called whenever the table game is at night: narrates and arms the step.
    const g = S.game;
    if (!g || g.phase !== "night" || ui.mode !== "table" || ui.view !== "game") return;
    const k = nightKey(g);
    if (ui.nightKey === k) return;
    ui.nightKey = k; ui.sel = null; ui.poison = null; ui.heal = false; ui.seerShown = false;
    const step = W.currentStep(g);
    const my = ui.gen;
    const lines = [];
    if (g.night.i === 0) lines.push({ say: g.nightNo === 1 ? "Night falls. Everyone, close your eyes." : "Night falls again. Everyone, close your eyes.", wait: 1400 });
    lines.push({ say: narration(step, "wake", g), wait: 300 });
    ui.nightStage = "talk";
    narrate(lines, () => {
      if (my !== ui.gen) return;
      const N = S.game.night;
      if (N && (step === "doctor" || step === "bodyguard") && N.picked[step]) { finishStep(); return; }
      if (W.stepIsIdle(g, step)) {
        // Nobody to wake (or wolves just meet): wait as long as a real turn would.
        ui.nightStage = "wait";
        render();
        const ms = (5000 + Math.floor(Math.random() * 4000)) * FAST;
        const bar = document.querySelector(".progress i");
        if (bar) { bar.style.transition = "width " + ms + "ms linear"; requestAnimationFrame(() => { bar.style.width = "100%"; }); }
        setTimeout(() => { if (my === ui.gen && ui.nightKey === k) finishStep(); }, ms);
      } else { ui.nightStage = "act"; render(); }
    });
  }
  function finishStep() {
    const g = S.game;
    const step = W.currentStep(g);
    const my = ui.gen;
    ui.nightStage = "talk";
    narrate([{ say: narration(step, "sleep", g), wait: 600 }], () => {
      if (my !== ui.gen) return;
      try { act({ type: "done", step }, { noUndo: true }); } catch (e) { toast(e.message); return; }
      if (S.game.phase === "night") { ui.nightKey = null; enterNightStep(); }
      else { ui.nightKey = null; announceMorning(); }
    });
  }
  function narrate(lines, done) {
    ui.say = lines.length ? lines[0].say : "";
    render();
    window.Narrator.play(lines, {
      voice: S.settings.voice, rate: { slow: 0.8, normal: 0.92, fast: 1.08 }[S.settings.rate] || 0.92,
      scale: FAST,
      onLine: (i, text) => { ui.say = text; const el = document.querySelector(".say"); if (el) el.textContent = text; },
      onDone: done,
    });
  }
  function renderNight(g) {
    const step = W.currentStep(g);
    const head = '<div class="step-head">' + moonArt() + "<span>Night " + g.nightNo + "</span></div>";
    let a = { center: moonArt("wait-moon"), ids: [], opts: {}, foot: "" };
    if (ui.nightStage === "act") a = nightActUI(g, step);
    else if (ui.nightStage === "wait") a.center = moonArt("wait-moon") + '<div class="progress"><i></i></div>';
    const main = playScreen(ring(g, a.ids, Object.assign({ night: true }, a.opts), head + '<div class="say">' + esc(ui.say) + "</div>" + a.center), "", a.foot, "night");
    return gameShell(g, "Night " + g.nightNo, "eyes closed", main, { noTabs: true, noSide: true, night: true });
  }
  function grid(g, ids, opts) {
    opts = opts || {};
    return '<div class="pgrid">' + g.players.map((p) => {
      if (!opts.showDead && !p.alive) return "";
      const can = ids.indexOf(p.id) >= 0;
      const sel = opts.sel === p.id;
      const sub = opts.sub ? opts.sub(p) : "";
      let odd = "";
      if (opts.odds && opts.odds[p.id] != null && p.alive) {
        const o = opts.odds[p.id];
        odd = '<span class="odds" style="color:' + wolfColor(o) + '">' + pct(o) + '</span><span class="bar"><i style="width:' + Math.round(o * 100) + "%;background:" + wolfColor(o) + '"></i></span>';
      }
      return '<button class="pbtn' + (sel ? " sel" : "") + (p.alive ? "" : " dead") + (odd ? " has-odds" : "") + (opts.me === p.id ? " me" : "") + '" data-act="' + (opts.act || "sel") + '" data-id="' + p.id + '" ' + (can ? "" : "disabled") + '><span class="pn">' + esc(p.name) + "</span>" + (sub ? '<span class="ps">' + sub + "</span>" : "") + odd + "</button>";
    }).join("") + "</div>";
  }
  function nightActUI(g, step) {
    const N = g.night;
    if (step === "seer") {
      const r = g.seerLog.filter((x) => x.n === g.nightNo).pop();
      if (r) {
        const t = g.players[r.target];
        const txt = r.role ? RN(r.role) : r.wolf ? "A " + RN("wolf").toLowerCase() : "Not a " + RN("wolf").toLowerCase();
        return { center: '<div class="result-card ' + (r.wolf ? "bad" : "good") + '"><span class="muted">' + esc(t.name) + " is</span><b>" + esc(r.role && T() === "mafia" && r.role === "wolf" ? "Mafia" : txt) + "</b></div>", ids: [], opts: {}, foot: '<button class="btn primary big" data-act="nightDone">Got it</button>' };
      }
      return { center: "", ids: W.validTargets(g, "seer"), opts: { sel: ui.sel }, foot: '<button class="btn primary big" data-act="seerCheck" ' + (ui.sel == null ? "disabled" : "") + ">Check</button>" };
    }
    if (step === "witch") {
      const victim = N.wolf != null ? g.players[N.wolf] : null;
      const canHeal = W.canHeal(g);
      const poisonOK = !g.mem.poisonUsed && !(ui.heal && !g.opts.witchBoth);
      const pt = poisonOK ? W.validTargets(g, "witch", "poison").filter(() => true) : [];
      let h = '<div class="witch-box"><div class="victim">' + (victim ? "Tonight's victim: <b>" + esc(victim.name) + "</b>" : "No one was attacked.") + "</div>";
      if (victim) h += canHeal || ui.heal ? '<div class="row"><button class="btn ' + (ui.heal ? "warm" : "") + '" data-act="witchHeal">' + (ui.heal ? "✓ Healing " : "Heal ") + esc(victim.name) + "</button></div>" : '<div class="muted" style="text-align:center;font-size:14px">' + (g.mem.healUsed ? "Heal potion used." : "Can't heal now.") + "</div>";
      if (poisonOK) h += '<p class="label" style="margin:4px 0 0;justify-content:center">Poison (once per game)</p>';
      else h += '<div class="muted" style="text-align:center;font-size:14px">' + (g.mem.poisonUsed ? "Poison used." : "One potion per night.") + "</div>";
      return { center: h + "</div>", ids: pt, opts: { sel: ui.poison, act: "poisonSel" }, foot: '<button class="btn primary big" data-act="witchDone">Done</button>' };
    }
    const ids = W.validTargets(g, step);
    const label = step === "wolf" ? "Kill" : "Protect";
    if (!ids.length && step !== "wolf") return { center: noGuard(), ids, opts: {}, foot: '<button class="btn primary big" data-act="nightDone">Done</button>' };
    return { center: "", ids, opts: { sel: ui.sel }, foot: '<button class="btn primary big" data-act="nightPick" ' + (ui.sel == null ? "disabled" : "") + ">" + label + (ui.sel != null ? " " + esc(g.players[ui.sel].name) : "") + "</button>" };
  }

  const noGuard = () => '<div class="muted" style="text-align:center;font-size:14px">Nobody can be protected tonight.</div>';
  function deathLines(g, ids, how) {
    const lines = [];
    if (!ids.length) { lines.push(how === "night" ? "Nobody died last night." : "Nobody was voted out."); return lines; }
    const names = ids.map((id) => g.players[id].name);
    const list = names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
    lines.push(how === "night" ? "Last night, " + list + (ids.length === 1 ? (isYou(g, ids[0]) ? " were killed." : " was killed.") : " died.") : list + (ids.length === 1 && isYou(g, ids[0]) ? " have been voted out." : " has been voted out."));
    ids.forEach((id) => { const p = g.players[id]; if (p.revealed) lines.push(p.name + was(g, id) + aRole(p.role) + "."); });
    return lines;
  }
  const aRole = (r) => { const n = RN(r); return (/^[AEIOU]/.test(n) ? "an " : "a ") + n; };
  const isYou = (g, id) => g.mode === "seats" && SEATED() && id === ME();
  const was = (g, id) => (isYou(g, id) ? " were " : " was ");
  function hunterLine(g) { const h = g.pendingHunters[0]; return h != null ? g.players[h].name + was(g, h) + "the " + RN("hunter") + ", and " + (isYou(g, h) ? "take" : "takes") + " one player along." : null; }
  function winLine(g) { return g.winner === "village" ? "The " + TH().village.toLowerCase() + " wins!" : "The " + TH().wolves.toLowerCase() + " win!"; }
  function announceMorning() {
    const g = G();
    const my = ui.gen;
    const lines = [{ say: "Everyone, open your eyes.", wait: 700 }].concat(deathLines(g, g.lastDeaths, "night").map((s) => ({ say: s, wait: 500 })));
    const hl = hunterLine(g); if (hl) lines.push({ say: hl });
    if (g.winner) lines.push({ say: winLine(g) });
    ui.say = "";
    render();
    window.Narrator.play(lines, { voice: S.settings.voice, scale: FAST, rate: { slow: 0.8, normal: 0.92, fast: 1.08 }[S.settings.rate] || 0.92, onDone: () => {
      if (my !== ui.gen) return;
      const gg = G();
      if (ui.mode === "table" && gg.phase === "morning" && !gg.pendingHunters.length) { act({ type: "day" }, { noUndo: true }); render(); }
      if (ui.mode === "cpu") pump();
    } });
  }

  // ---- day (morning / day / dusk), both modes
  function tableOdds(g, seat) {
    const info = W.oddsInfo(g, seat);
    const k = JSON.stringify(info);
    if (tableOdds._k === k) return tableOdds._v;
    let v;
    try { v = W.wolfOdds(info); } catch (e) { v = { odds: {} }; }
    tableOdds._k = k; tableOdds._v = v;
    return v;
  }
  function wolvesLeftText(g) {
    const known = g.players.filter((p) => p.revealed && p.role === "wolf").length;
    return g.opts.reveal ? (g.setup.wolf - known) + " of " + g.setup.wolf : "? of " + g.setup.wolf;
  }
  function renderDay(g) {
    const cpu = SEATED();
    const seat = cpu ? ME() : null;
    const me = cpu ? g.players[seat] : null;
    const od = tableOdds(g, seat);
    const alive = g.players.filter((p) => p.alive).length;
    // news card
    let news = "";
    const lastDeathEvt = latestNews(g);
    if (lastDeathEvt) news = '<div class="news">' + (lastDeathEvt.night ? IC.sun : IC.moon.replace("<svg", '<svg class="sun"')) + '<div class="nt">' + esc(lastDeathEvt.title) + (lastDeathEvt.sub ? "<small>" + esc(lastDeathEvt.sub) + "</small>" : "") + "</div></div>";
    const stats = '<div class="stat-line"><span>Alive <b>' + alive + "</b></span><span>" + esc(TH().wolves) + " left <b>" + wolvesLeftText(g) + "</b></span>" +
      (cpu ? "<span>You: <b class=\"" + (me.role === "wolf" ? "tagw" : "tagg") + "\">" + esc(RN(me.role)) + "</b>" + (me.alive ? "" : " (dead)") + "</span>" : "") +
      (!cpu && g.phase === "day" && S.settings.timer ? timerChip(g) : "") +
      '<span style="margin-left:auto">Wolf odds ' + q("odds") + "</span></div>";
    // hunter pending
    const hunter = g.pendingHunters[0];
    let main = "";
    let foot = "";
    let ids = [];
    let ropts = { odds: od.odds, me: cpu ? seat : undefined, sub: (p) => subFor(g, p, seat) };
    if (hunter != null) {
      const hp = g.players[hunter];
      const yours = !cpu || hunter === seat;
      main += '<p class="label" style="justify-content:center">' + esc(hp.name) + " the " + esc(RN("hunter")) + " shoots</p>";
      if (yours) {
        ids = g.players.filter((p) => p.alive).map((p) => p.id); ropts.sel = ui.sel;
        foot = '<button class="btn" data-act="shootAir">Into the air</button><button class="btn warm" data-act="shoot" ' + (ui.sel == null ? "disabled" : "") + ">Shoot" + (ui.sel != null ? " " + esc(g.players[ui.sel].name) : "") + "</button>";
      } else main += '<div class="empty">Waiting for the shot…</div>';
    } else if (g.phase === "day") {
      const claimsHtml = g.claims.length ? '<div class="claims">' + g.claims.map((c, i) => '<div class="claim"><span class="ct"><b>' + esc(g.players[c.by].name) + "</b> says " + esc(g.players[c.target].name) + " is " + (c.wolf ? '<span class="tagw">' + esc(aWolf()) + "</span>" : '<span class="tagg">not ' + esc(aWolf()) + "</span>") + "</span>" + (cpu ? "" : '<button class="x" data-act="unclaim" data-i="' + i + '" aria-label="Remove claim">×</button>') + "</div>").join("") + "</div>" : "";
      ropts.sel = ui.sel;
      if (cpu) {
        const voted = Object.keys(g.ballots).length;
        const myVote = g.ballots[seat];
        ids = me.alive && myVote == null ? g.players.filter((p) => p.alive && p.id !== seat).map((p) => p.id) : [];
        main += claimsHtml;
        const pend = pendingOf(g).length;
        const hintBtn = me.alive ? '<button class="btn" style="flex:0 0 auto" data-act="hint">Hint</button>' : "";
        if (me.alive && myVote == null) foot = hintBtn + '<button class="btn" data-act="cpuClaim">Claim</button><button class="btn" data-act="cpuSkip">Skip</button><button class="btn warm" data-act="cpuVote" ' + (ui.sel == null ? "disabled" : "") + ">Vote" + (ui.sel != null ? " " + esc(g.players[ui.sel].name) : "") + "</button>";
        else foot = hintBtn + '<div class="muted" style="flex:1;text-align:center;padding:10px">' + (me.alive ? "You voted. " : "") + "Votes in: " + (alive - pend) + " of " + alive + "</div>";
        void voted;
      } else {
        ids = g.players.filter((p) => p.alive).map((p) => p.id);
        main += claimsHtml;
        foot = '<button class="btn" data-act="claim">' + esc(RN("seer")) + ' claim</button><button class="btn" data-act="noVote">No one out</button><button class="btn warm" data-act="vote" ' + (ui.sel == null ? "disabled" : "") + ">Vote out" + (ui.sel != null ? " " + esc(g.players[ui.sel].name) : "") + "</button>";
      }
    } else if (g.phase === "morning") {
      foot = cpu ? '<div class="muted" style="flex:1;text-align:center;padding:10px">Morning…</div>' : '<button class="btn primary big" data-act="toDay">Start the day</button>';
    } else if (g.phase === "dusk") {
      main += voteBreakdown(g);
      foot = '<button class="btn primary big" data-act="toNight">' + moonInline() + " Start night " + (g.nightNo + 1) + "</button>";
    }
    const body = playScreen(ring(g, ids, ropts, news + main), stats, foot);
    const title = g.phase === "dusk" ? "Evening " + g.day : "Day " + Math.max(1, g.day);
    return gameShell(g, title, ui.mode === "online" ? "Room " + esc(ui.osnap.code || "") : cpu ? levelName(botLevel(g)) + " computers" : "", body);
  }
  // ---- day timer (table mode)
  let timerInt = null;
  function timerChip(g) {
    const t = ui.timer && ui.timer.day === g.day ? ui.timer : (ui.timer = { day: g.day, left: S.settings.timer * 60, running: false, warned: false });
    return '<button class="chip" data-act="timer" style="min-height:30px;padding:3px 10px;font-size:14px" aria-label="Day timer"><span id="timerTxt">' + fmtTime(t.left) + "</span>" + (t.running ? " ❚❚" : " ▶") + "</button>";
  }
  const fmtTime = (sec) => Math.floor(sec / 60) + ":" + String(Math.max(0, sec) % 60).padStart(2, "0");
  function toggleTimer() {
    const t = ui.timer; if (!t) return;
    t.running = !t.running;
    clearInterval(timerInt);
    if (t.running) {
      window.Narrator.unlock();
      timerInt = setInterval(() => {
        const g = S.game;
        if (!g || g.phase !== "day" || ui.timer !== t) { clearInterval(timerInt); return; }
        t.left -= 1;
        const el = document.getElementById("timerTxt"); if (el) el.textContent = fmtTime(t.left);
        if (t.left > 0 && t.left <= 10) sfx("tick");
        if (t.left === 0) sfx("alarm");
        if (t.left === 60 && !t.warned) { t.warned = true; window.Narrator.play([{ say: "One minute left." }], { voice: S.settings.voice }); }
        if (t.left <= 0) { clearInterval(timerInt); t.running = false; window.Narrator.play([{ say: "Time is up. Time to vote." }], { voice: S.settings.voice }); render(); }
      }, 1000);
    }
    render();
  }
  // ---- odds explained
  function oddsWhy() {
    const g = G(); if (!g) return "";
    const seat = SEATED() ? ME() : null;
    const info = W.oddsInfo(g, seat);
    if (!info.claims.length) return "";
    const withC = W.wolfOdds(info).odds;
    const noC = W.wolfOdds(Object.assign({}, info, { claims: [] })).odds;
    const rows = g.players.filter((p) => p.alive).map((p) => "<tr><td>" + esc(p.name) + '</td><td>' + pct(noC[p.id] || 0) + '</td><td style="color:' + wolfColor(withC[p.id] || 0) + '"><b>' + pct(withC[p.id] || 0) + "</b></td></tr>").join("");
    return '<table class="tbl"><thead><tr><th>Player</th><th>No claims</th><th>With claims</th></tr></thead><tbody>' + rows + "</tbody></table>";
  }
  function hintText() {
    const g = G(); const ms = ME(); const od = W.wolfOdds(W.oddsInfo(g, ms)).odds;
    const others = g.players.filter((p) => p.alive && p.id !== ms);
    if (g.phase === "night" && W.currentStep(g) === "seer") {
      const checked = new Set(g.seerLog.filter((r) => r.by === ms).map((r) => r.target));
      const c = others.filter((p) => !checked.has(p.id)).sort((a, b) => (od[b.id] || 0) * (1 - (od[b.id] || 0)) - (od[a.id] || 0) * (1 - (od[a.id] || 0)))[0];
      return c ? "Check " + c.name + ": " + pct(od[c.id] || 0) + " wolf — the least certain player." : "Nobody left to check.";
    }
    const me = g.players[ms];
    if (me.role === "wolf") {
      // A wolf already knows the truth: show what the rest of the table believes.
      const pub = W.wolfOdds(W.oddsInfo(g, null)).odds;
      const prey = others.filter((p) => p.role !== "wolf").sort((a, b) => (pub[b.id] || 0) - (pub[a.id] || 0));
      if (!prey.length) return "No one to vote for.";
      const lo = Math.min.apply(null, prey.map((p) => pub[p.id] || 0));
      if ((pub[prey[0].id] || 0) - lo < 0.005) return "The table has no suspect yet: every villager looks " + pct(lo) + " likely.";
      return "The table suspects " + prey[0].name + " most (" + pct(pub[prey[0].id] || 0) + "). " + prey[prey.length - 1].name + " looks safest to them.";
    }
    const pool = others.filter((p) => !(me.role === "wolf" && p.role === "wolf"));
    const top = pool.sort((a, b) => (od[b.id] || 0) - (od[a.id] || 0))[0];
    if (!top) return "No one to vote for.";
    const lo = pool.reduce((m, p) => Math.min(m, od[p.id] || 0), 1);
    if ((od[top.id] || 0) - lo < 0.005) return "Nobody stands out yet: every player is " + pct(od[top.id] || 0) + " likely to be " + aWolf() + ".";
    return me.role === "wolf" ? "The table trusts " + pool[pool.length - 1].name + " most; " + top.name + " looks guiltiest to them." : "Most likely wolf: " + top.name + " (" + pct(od[top.id] || 0) + ").";
  }
  function voteRecord(g) {
    const tally = {};
    g.log.forEach((e) => {
      if (!e.ballots) return;
      Object.keys(e.ballots).forEach((s) => {
        const t = e.ballots[s]; if (t < 0) return;
        const r = tally[s] || (tally[s] = { onWolf: 0, total: 0 });
        r.total++; if (g.players[t].role === "wolf") r.onWolf++;
      });
    });
    const rows = g.players.filter((p) => tally[p.id]).map((p) => { const r = tally[p.id]; return "<tr><td>" + esc(p.name) + (p.id === ME() ? " (you)" : "") + ' <span class="muted">' + esc(RN(p.role)) + "</span></td><td>" + r.onWolf + " of " + r.total + "</td></tr>"; }).join("");
    return rows ? '<p class="label" style="margin-top:14px">Votes on ' + esc(RN("wolf", true).toLowerCase()) + '</p><table class="tbl"><tbody>' + rows + "</tbody></table>" : "";
  }
  const aWolf = () => (T() === "mafia" ? "Mafia" : "a " + RN("wolf").toLowerCase());
  const moonInline = () => '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor"/></svg>';
  function subFor(g, p, seat) {
    if (!p.alive) return p.revealed ? esc(RN(p.role)) : "dead";
    if (seat != null) {
      const v = g.players[p.id];
      if (p.id === seat) return "you · " + esc(RN(v.role));
      const me = g.players[seat];
      if (me.role === "wolf" && v.role === "wolf") return '<span class="tagw">' + esc(RN("wolf")) + "</span>";
      const r = g.seerLog.filter((x) => x.by === seat && x.target === p.id).pop();
      if (me.role === "seer" && r) return r.wolf ? '<span class="tagw">' + esc(RN("wolf")) + "</span>" : '<span class="tagg">' + (r.role ? esc(RN(r.role)) : "not " + esc(aWolf())) + "</span>";
    }
    return "";
  }
  function latestNews(g) {
    for (let i = g.log.length - 1; i >= 0; i--) {
      const e = g.log[i];
      if (e.t === "vote") return { night: false, title: g.players[e.target].name + was(g, e.target) + "voted out", sub: g.players[e.target].revealed ? (isYou(g, e.target) ? "You were " : "They were ") + aRole(g.players[e.target].role) + "." : "" };
      if (e.t === "novote") return { night: false, title: e.tie ? "Tied vote — nobody out" : "Nobody was voted out", sub: "" };
      if (e.t === "dawn") {
        const shot = g.log.slice(i + 1).find((x) => x.t === "shot");
        const names = e.deaths.map((id) => g.players[id].name + (g.players[id].revealed ? " (" + RN(g.players[id].role) + ")" : ""));
        return { night: true, title: e.deaths.length ? names.join(" and ") + (e.deaths.length > 1 ? " died" : was(g, e.deaths[0]) + "killed") : "Nobody died last night", sub: shot ? (shot.target != null ? g.players[shot.by].name + " shot " + g.players[shot.target].name + "." : g.players[shot.by].name + " fired into the air.") : "" };
      }
      if (e.t === "day" && e.n === 1 && g.opts.dayFirst) return { night: true, title: "The first day", sub: "Talk, then vote." };
    }
    return null;
  }
  function voteBreakdown(g) {
    const e = g.log.slice().reverse().find((x) => (x.t === "vote" || x.t === "novote") && x.day === g.day);
    if (!e || !e.ballots) return "";
    const by = {};
    Object.keys(e.ballots).forEach((s) => { const t = e.ballots[s]; (by[t] = by[t] || []).push(g.players[s].name); });
    const rows = Object.keys(by).sort((a, b) => by[b].length - by[a].length).map((t) => '<div class="le vote"><b>' + (t === "-1" ? "Skip" : esc(g.players[t].name)) + "</b> · " + by[t].length + " — " + esc(by[t].join(", ")) + "</div>").join("");
    return '<p class="label" style="margin-top:6px">Votes</p><div class="log">' + rows + "</div>";
  }

  // ---- log
  function renderLog(g) {
    const over = !!g.winner;
    const L = g.log;
    const nm = (id) => esc(g.players[id] ? g.players[id].name : "?");
    let h = "";
    L.forEach((e) => {
      if (e.t === "night") h += '<div class="lh">' + moonInline() + " Night " + e.n + "</div>";
      else if (e.t === "secret") {
        if (!over) return;
        const bits = [];
        if (e.seer != null) bits.push(RN("seer") + " checked " + nm(e.seer));
        if (e.doctor != null) bits.push(RN("doctor") + " guarded " + nm(e.doctor));
        if (e.bodyguard != null) bits.push(RN("bodyguard") + " guarded " + nm(e.bodyguard));
        if (e.wolf != null) bits.push(RN("wolf", true) + " attacked " + nm(e.wolf));
        if (e.healed) bits.push(RN("witch") + " healed");
        if (e.poison != null) bits.push(RN("witch") + " poisoned " + nm(e.poison));
        if (bits.length) h += '<div class="le secret">' + bits.join(" · ") + "</div>";
      } else if (e.t === "dawn") h += '<div class="lh">Day ' + e.n + '</div><div class="le">' + (e.deaths.length ? e.deaths.map((id) => nm(id) + roleTag(g, id)).join(", ") + " died" : "Nobody died") + "</div>";
      else if (e.t === "day" && e.n === 1 && g.opts.dayFirst) h += '<div class="lh">Day 1</div>';
      else if (e.t === "claim") h += '<div class="le">' + nm(e.by) + " claims " + esc(RN("seer")) + ": " + nm(e.target) + " is " + (e.wolf ? '<span class="tagw">' + esc(aWolf()) + "</span>" : '<span class="tagg">not ' + esc(aWolf()) + "</span>") + "</div>";
      else if (e.t === "unclaim") h += '<div class="le muted">Claim by ' + nm(e.by) + " removed</div>";
      else if (e.t === "vote") h += '<div class="le vote">Voted out: <b>' + nm(e.target) + "</b>" + roleTag(g, e.target) + (e.counts ? ' <span class="muted">(' + e.counts[e.target] + " votes)</span>" : "") + "</div>";
      else if (e.t === "novote") h += '<div class="le vote">' + (e.tie ? "Tie — nobody out" : "Nobody voted out") + "</div>";
      else if (e.t === "shot") h += '<div class="le">' + nm(e.by) + (e.target != null ? " shot " + nm(e.target) + roleTag(g, e.target) : " fired into the air") + "</div>";
      else if (e.t === "end") h += '<div class="lh">' + esc(e.winner === "village" ? TH().village : TH().wolves) + " win</div>";
    });
    return '<p class="label">Log</p>' + (h ? '<div class="log">' + h + "</div>" : '<div class="empty">Nothing yet.</div>');
  }
  function roleTag(g, id) { const p = g.players[id]; return p.revealed || g.winner ? ' <span class="muted">(' + esc(RN(p.role)) + ")</span>" : ""; }

  // ---- game over
  function renderOver(g) {
    const win = g.winner;
    // Every card round the table is turned face up, like the end of a real game.
    const center = '<div class="over-head ' + win + '">' + (win === "village" ? IC.sun.replace('class="sun"', 'width="56" height="56"') : moonArt()) + "<h2>" + esc(win === "village" ? TH().village : TH().wolves) + ' win</h2><p class="muted">' + (SEATED() ? (W.TEAM[g.players[ME()].role] === (win === "village" ? "village" : "wolves") ? "You won." : "You lost.") : "Day " + Math.max(1, g.day)) + "</p></div>" +
      (SEATED() ? voteRecord(g) : "");
    const foot = '<button class="btn" data-act="home">Menu</button>' + (ui.mode === "online" ? '<button class="btn primary" data-act="leaveRoom">Leave room</button>' : '<button class="btn primary" data-act="again">Play again</button>');
    const main = playScreen(ring(g, [], { allUp: true, me: SEATED() ? ME() : undefined, sub: (p) => esc(RN(p.role)) + (p.alive || g.players.length > 12 ? "" : " · dead") }, center), "", foot, "over");
    return gameShell(g, "Game over", "", main);
  }

  // ---- vs computer night
  function renderCpuNight(g) {
    const step = W.currentStep(g);
    const ms = ME();
    const me = g.players[ms];
    const mine = me.alive && me.role === step && pendingOf(g).indexOf(ms) >= 0;
    let a;
    if (mine) {
      a = cpuActUI(g, step);
      a.center = '<div class="say">' + esc(narration(step, "wake", g)) + "</div>" + a.center;
    } else {
      const awake = ui.mode !== "online" && W.stepIsIdle(g, step) ? "…" : RN(step, step === "wolf") + (step === "wolf" ? " are" : " is") + " awake";
      const extra = me.alive && me.role === "wolf" && step === "wolf" ? pendingWolfInfo(g) : "";
      a = { center: '<div class="say">' + esc(me.alive ? "Eyes closed." : "You are dead — watching.") + "</div>" + moonArt("wait-moon") + '<div class="step-head"><span>' + esc(awake) + "</span></div>" + extra, ids: [], opts: {}, foot: "" };
    }
    const head = '<div class="step-head">' + moonArt() + "<span>Night " + g.nightNo + " · you are " + esc(aRole(me.role)) + "</span></div>";
    const main = playScreen(ring(g, a.ids, Object.assign({ night: true, me: ms, sub: (p) => subFor(g, p, ms) }, a.opts), head + a.center), "", a.foot, "night");
    return gameShell(g, "Night " + g.nightNo, "", main, { night: true });
  }
  function pendingWolfInfo(g) {
    const v = g.night.wolfVotes;
    const ks = Object.keys(v);
    if (!ks.length) return "";
    return '<div class="claims">' + ks.map((s) => '<div class="claim"><span class="ct">' + esc(g.players[s].name) + " wants " + esc(g.players[v[s]].name) + "</span></div>").join("") + "</div>";
  }
  function cpuActUI(g, step) {
    const N = g.night;
    if (step === "seer") {
      const r = g.seerLog.filter((x) => x.n === g.nightNo && x.by === ME()).pop();
      if (r) {
        const t = g.players[r.target];
        const txt = r.role ? RN(r.role) : r.wolf ? aWolf() : "not " + aWolf();
        return { center: '<div class="result-card ' + (r.wolf ? "bad" : "good") + '"><span class="muted">' + esc(t.name) + " is</span><b>" + esc(txt) + "</b></div>", ids: [], opts: {}, foot: '<button class="btn primary big" data-act="cpuDone">Close eyes</button>' };
      }
      return { center: "", ids: W.validTargets(g, "seer"), opts: { sel: ui.sel }, foot: '<button class="btn" style="flex:0 0 auto" data-act="hint">Hint</button><button class="btn primary big" data-act="cpuPick" ' + (ui.sel == null ? "disabled" : "") + ">Check</button>" };
    }
    if (step === "witch") {
      const victim = N.wolf != null ? g.players[N.wolf] : null;
      if (!N.picked.heal) {
        return { center: '<div class="witch-box"><div class="victim">' + (victim ? "Tonight's victim: <b>" + esc(victim.name) + "</b>" : "No one was attacked.") + "</div></div>", ids: [], opts: {}, foot: '<button class="btn" data-act="cpuHeal" data-v="0">Don\'t heal</button><button class="btn warm" data-act="cpuHeal" data-v="1" ' + (W.canHeal(g) ? "" : "disabled") + ">Heal</button>" };
      }
      if (!N.picked.poison) {
        const pt = W.validTargets(g, "witch", "poison");
        return { center: '<p class="label" style="justify-content:center">Poison someone?</p>', ids: pt, opts: { sel: ui.sel }, foot: '<button class="btn" data-act="cpuPoison" data-v="none">No poison</button><button class="btn warm" data-act="cpuPoison" ' + (ui.sel == null ? "disabled" : "") + ">Poison</button>" };
      }
      return { center: "", ids: [], opts: {}, foot: '<button class="btn primary big" data-act="cpuDone">Close eyes</button>' };
    }
    const ids = W.validTargets(g, step);
    const extra = step === "wolf" ? pendingWolfInfo(g) : "";
    if (!ids.length && step !== "wolf") return { center: noGuard(), ids, opts: {}, foot: '<button class="btn primary big" data-act="cpuDone">Close eyes</button>' };
    return { center: extra, ids, opts: { sel: ui.sel }, foot: '<button class="btn primary big" data-act="cpuPick" ' + (ui.sel == null ? "disabled" : "") + ">" + (step === "wolf" ? "Kill" : "Protect") + (ui.sel != null ? " " + esc(g.players[ui.sel].name) : "") + "</button>" };
  }

  // ------------------------------------------------------------ cpu driver
  let pumpTimer = null;
  function pump() {
    clearTimeout(pumpTimer);
    const my = ui.gen;
    const g = S.cpu;
    if (!g || ui.mode !== "cpu" || ui.view !== "game") return;
    if (g.winner) { render(); return; }
    // You stay in charge of your own Hunter shot, even though you're dead.
    const isBot = (s) => s !== 0 || (!g.players[0].alive && g.pendingHunters[0] !== 0);
    const pend = W.pendingActors(g);
    const bots = pend.filter(isBot);
    if (bots.length) {
      const delay = FAST * (g.phase === "night" ? 700 + Math.random() * 900 : g.phase === "day" ? 450 + Math.random() * 500 : 1200);
      pumpTimer = setTimeout(() => {
        if (my !== ui.gen) return;
        const a = W.nextBotMove(S.cpu, bots, Math.random, isBot);
        if (a) applyCpu(a);
        else if (!pend.filter((s) => !isBot(s)).length) hostStep();
        pump();
      }, delay);
      return;
    }
    if (pend.length) { render(); return; } // waiting on you
    const h = W.hostAction(g);
    if (!h) { render(); return; }
    if (h.type === "night") { render(); return; } // you tap "Start night"
    const wait = FAST * (h.type === "done" ? 1500 + Math.random() * 1500 : h.type === "day" ? 400 : 600);
    pumpTimer = setTimeout(() => { if (my === ui.gen) { hostStep(); pump(); } }, wait);
  }
  function hostStep() {
    const g = S.cpu; const h = W.hostAction(g);
    if (!h) return;
    applyCpu(h);
  }
  function applyCpu(a) {
    const prev = S.cpu;
    try { S.cpu = W.apply(S.cpu, a); } catch (e) { oops(e.message); return; }
    if (a.type !== "pick" || S.cpu.phase !== prev.phase) ui.sel = null;
    announceChange(prev, S.cpu);
    save();
    render();
  }
  // Narrate what changed between two states of a seat game (vs computer or online).
  function announceChange(prev, g) {
    if (!prev || !g) return;
    if (prev.phase === "night" && g.phase !== "night") { announceMorning(); return; }
    if (prev.phase === "day" && (g.phase !== "day" || g.day !== prev.day)) {
      const e = g.log.slice().reverse().find((x) => (x.t === "vote" || x.t === "novote") && x.day === prev.day);
      const lines = e && e.t === "vote" ? deathLines(g, [e.target], "day") : [e && e.tie ? "The vote is tied. Nobody goes out." : "Nobody was voted out."];
      const hl = hunterLine(g); if (hl) lines.push(hl);
      if (g.winner) lines.push(winLine(g));
      else if (g.phase === "night" && ui.mode === "online") lines.push("Night falls. Everyone, close your eyes.");
      window.Narrator.play(lines.map((s) => ({ say: s })), { voice: S.settings.voice, scale: FAST });
    }
  }
  // One move from the seat you hold.
  function seatAct(a) {
    if (ui.mode === "cpu") { a.seat = 0; applyCpu(a); pump(); return; }
    if (ui.mode !== "online" || !room) return;
    a.seat = ME(); ui.sel = null;
    room.act(a).then((r) => { if (r && !r.ok) oops(r.message || "That move didn't go through."); });
    render();
  }

  // ------------------------------------------------------------ actions (table)
  function act(a, o) {
    o = o || {};
    const g = S.game;
    const next = W.apply(g, a);
    if (!o.noUndo) { S.undo.push(g); if (S.undo.length > 40) S.undo.shift(); }
    S.game = next;
    save();
    return next;
  }

  // ------------------------------------------------------------ lab & rules pages
  function renderLab() {
    const rs = S.settings.ruleset in W.RULESETS ? S.settings.ruleset : "ultimate";
    const data = (window.WW_SETUPS || {})[rs] || {};
    const names = ["Simple", "Classic", "Full", "Rulebook"];
    const colors = { Simple: "#6ea8fe", Classic: "#4cc38a", Full: "#f0b354", Rulebook: "#e0605a" };
    const ns = Object.keys(data).map(Number).sort((a, b) => a - b);
    const Wd = 640, H = 260, L = 36, B = 28, Rr = 10, Tp = 10;
    const x = (n) => L + (n - ns[0]) / Math.max(1, ns[ns.length - 1] - ns[0]) * (Wd - L - Rr);
    const y = (p) => Tp + (1 - p) * (H - Tp - B);
    let svg = '<svg class="chart" viewBox="0 0 ' + Wd + " " + H + '" role="img" aria-label="Village win chance by player count">';
    [0, 0.25, 0.5, 0.75, 1].forEach((p) => { svg += '<line x1="' + L + '" x2="' + (Wd - Rr) + '" y1="' + y(p) + '" y2="' + y(p) + '" stroke="' + (p === 0.5 ? "#969db4" : "#2a3042") + '" ' + (p === 0.5 ? 'stroke-dasharray="4 4"' : "") + '/><text x="' + (L - 6) + '" y="' + (y(p) + 4) + '" fill="#969db4" font-size="11" text-anchor="end">' + p * 100 + "%</text>"; });
    ns.forEach((n) => { svg += '<text x="' + x(n) + '" y="' + (H - 8) + '" fill="#969db4" font-size="11" text-anchor="middle">' + n + "</text>"; });
    names.forEach((nmz) => {
      const pts = ns.map((n) => { const s = (data[n] || []).find((d) => d.name === nmz); return s ? [x(n), y(s.village)] : null; }).filter(Boolean);
      if (pts.length < 2) return;
      svg += '<polyline fill="none" stroke="' + colors[nmz] + '" stroke-width="2.5" stroke-linejoin="round" points="' + pts.map((p) => p.join(",")).join(" ") + '"/>';
      pts.forEach((p) => { svg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="' + colors[nmz] + '"/>'; });
    });
    svg += "</svg>";
    const legend = '<div class="legend">' + names.map((n) => '<span><i style="background:' + colors[n] + '"></i>' + n + "</span>").join("") + "</div>";
    const B2 = window.WW_BOTS;
    let bots = "";
    if (B2) {
      const lv = ["easy", "normal", "smart"];
      bots = '<table class="tbl"><thead><tr><th>Village ↓ / ' + esc(TH().wolves) + " →</th>" + lv.map((l) => "<th>" + levelName(l) + "</th>").join("") + "</tr></thead><tbody>" +
        lv.map((v) => "<tr><td>" + levelName(v) + "</td>" + lv.map((w) => { const c = B2.table[v][w]; return '<td style="color:' + balColor(c.village) + '">' + pct(c.village) + "</td>"; }).join("") + "</tr>").join("") + "</tbody></table>" +
        '<p class="muted" style="font-size:13px">Village win % · 8 players (2 ' + esc(RN("wolf", true).toLowerCase()) + ", " + esc(RN("seer")) + ", " + esc(RN("doctor")) + ", 4 " + esc(RN("villager", true).toLowerCase()) + ") · " + (function () { const gs = []; lv.forEach((v) => lv.forEach((w) => gs.push(B2.table[v][w].games))); const lo = Math.min.apply(null, gs), hi = Math.max.apply(null, gs); return lo === hi ? lo.toLocaleString() : lo.toLocaleString() + "–" + hi.toLocaleString(); })() + " games per cell " + q("bots") + "</p>";
    }
    const rows = ns.map((n) => "<tr><td>" + n + "</td>" + names.map((nmz) => { const s = (data[n] || []).find((d) => d.name === nmz); return s ? '<td style="color:' + balColor(s.village) + '">' + pct(s.village) + '<br><span class="muted" style="font-size:11px">' + s.setup.wolf + "w · UW " + fmtPts(W.uwPoints(s.setup)) + "</span></td>" : '<td class="muted">—</td>'; }).join("") + "</tr>").join("");
    const page = '<div class="page"><h2>Village win chance ' + q("balance") + '</h2><p class="muted" style="margin-top:0">' + esc(W.RULESETS[rs].name) + " rules · normal computers on both sides</p>" + svg + legend +
      '<h2>Every setup</h2><div class="scroll" style="overflow-x:auto"><table class="tbl"><thead><tr><th>Players</th>' + names.map((n) => "<th>" + n + "</th>").join("") + "</tr></thead><tbody>" + rows + "</tbody></table></div>" +
      '<h2>How strong are the computers?</h2>' + bots +
      '<h2>Simulation vs the point system ' + q("uw") + '</h2><p class="muted">Each setup above also shows its Ultimate Werewolf point total (UW). Zero is meant to be fair. Compare it with the measured win chance.</p></div>';
    return topbar("Setup lab", "", backBtn("home"), gearBtn) + '<div class="main"><div class="pane"><div class="pad scroll" style="flex:1">' + page + "</div></div></div>";
  }
  function renderRules() {
    const th = TH();
    const roles = W.ROLE_KEYS.map((r) => '<div class="mini-card" style="display:flex;gap:12px;text-align:left;align-items:center"><div class="mc-art" style="width:64px;flex:0 0 64px">' + art(r, 64) + '</div><div><b>' + esc(RN(r)) + '</b><div class="muted" style="font-size:14px">' + esc(W.ROLE_HELP[r]) + "</div></div></div>").join("");
    const page = '<div class="page"><h2>The game</h2><p>Everyone gets a secret card. A few are ' + esc(th.wolves) + "; the rest are the " + esc(th.village) + ". At night everyone closes their eyes and the phone wakes each role in turn. By day the living talk, accuse, and vote someone out.</p>" +
      "<p>The " + esc(th.village) + " wins when every " + esc(RN("wolf")) + " is gone. The " + esc(th.wolves) + " win when they can no longer be outvoted (equal numbers), or under Millers Hollow rules, when everyone else is dead.</p>" +
      '<h2>Roles</h2><div style="display:grid;gap:10px">' + roles + "</div>" +
      "<h2>Rule sets</h2><ul><li><b>Ultimate Werewolf</b> — first night the wolves only meet; the Seer learns wolf or not; wolves win at equal numbers.</li><li><b>Millers Hollow</b> — wolves kill on night one; the Seer sees the exact card; wolves win when every villager is dead.</li><li><b>Mafia</b> — opens with a day; the Detective learns Mafia or not; Mafia win at equal numbers.</li></ul><p class=\"muted\">Every rule is a switch in Settings. A tied vote sends nobody out in all three.</p>" +
      "<h2>Night order</h2><p>" + W.NIGHT_ORDER.map((r) => esc(RN(r, r === "wolf"))).join(" → ") + ". Every role in the game is called each night, even when dead, so the narration never gives anything away.</p>" +
      '<h2>Sources</h2><p class="muted">Rules checked against the Millers Hollow rulebook, Ultimate Werewolf rule summaries, and the Mafia article on Wikipedia. Details in the project\'s docs/rules-check.md.</p></div>';
    return topbar("Rules", RS_NAME(), backBtn("home"), gearBtn) + '<div class="main"><div class="pane"><div class="pad scroll" style="flex:1">' + page + "</div></div></div>";
  }

  // ------------------------------------------------------------ sheets
  function openSheet(title, body, foot) {
    $sheet.innerHTML = '<div class="sheet"><div class="sheet-head"><h2>' + title + '</h2><button class="icon-btn" data-act="closeSheet" aria-label="Close">' + IC.close + '</button></div><div class="sheet-body">' + body + "</div>" + (foot ? '<div class="sheet-foot">' + foot + "</div>" : "") + "</div>";
    $sheet.classList.remove("hidden");
    syncHistory();
  }
  function closeSheet() { $sheet.classList.add("hidden"); $sheet.innerHTML = ""; ui.sheet = null; }
  const HELP = {
    balance: ["Village wins", "How often the village won when computers played this setup thousands of times. Near 50% is a fair game; green is close, red is lopsided. The computers play simple, sensible habits, so real tables can differ. UW is the Ultimate Werewolf point total (0 = fair by that system)."],
    odds: ["Wolf odds", "Each living player's chance of being a wolf, using only what the whole table knows: the setup, cards shown on death, and Seer claims you enter. A real Seer never lies; a wolf might fake a claim; anyone else rarely does. Enter every claim and the odds update at once."],
    bots: ["How strong?", "Measured by letting computers play each other thousands of times. Easy plays at random. Normal plays like a sensible table. Smart uses the exact wolf odds for every choice and its wolves fake-claim."],
    uw: ["Point system", "Ultimate Werewolf prints a point value on each card (wolf −6, Seer +7, villager +1 …). The total is a quick balance guess. The win chance here is measured instead, so you can see where the two agree."],
  };
  function settingsSheet() {
    const s = S.settings;
    const o = s.opts;
    const sw = (k, label) => '<div class="set-row"><span class="sl">' + label + '</span><label class="switch"><input type="checkbox" data-opt="' + k + '" ' + (o[k] ? "checked" : "") + '><span></span></label></div>';
    const seg = (name, vals, cur) => '<div class="seg">' + vals.map(([v, l]) => '<button data-act="seg" data-name="' + name + '" data-v="' + v + '" class="' + (String(cur) === String(v) ? "sel" : "") + '">' + l + "</button>").join("") + "</div>";
    const preset = optsMatchPreset() ? s.ruleset : "custom";
    const body =
      '<div class="set-group"><p class="label">Look</p><div class="set-row"><span class="sl">Theme</span>' + seg("theme", [["werewolf", "Werewolf"], ["mafia", "Mafia"]], s.theme) + "</div></div>" +
      '<div class="set-group"><p class="label">Narrator</p><div class="set-row"><span class="sl">Voice</span><label class="switch"><input type="checkbox" data-set="voice" ' + (s.voice ? "checked" : "") + '><span></span></label></div><div class="set-row"><span class="sl">Speed</span>' + seg("rate", [["slow", "Slow"], ["normal", "Normal"], ["fast", "Fast"]], s.rate) + "</div>" +
      '<div class="set-row"><span class="sl">Day timer</span>' + seg("timer", [["0", "Off"], ["2", "2 min"], ["3", "3 min"], ["5", "5 min"]], s.timer) + "</div></div>" +
      (FX ? '<div class="set-group"><p class="label">Sound &amp; effects</p><div id="fxSet"></div></div>' : "") +
      '<div class="set-group"><p class="label">Computers</p><div class="set-row"><span class="sl">Level ' + q("bots") + "</span>" + seg("level", [["easy", "Easy"], ["normal", "Normal"], ["smart", "Smart"]], s.level) + "</div></div>" +
      '<div class="set-group"><p class="label">Rules <span class="grow"></span><span style="text-transform:none;letter-spacing:0">new games</span></p>' +
      '<div class="seg" style="width:100%;display:flex">' + [["ultimate", "Ultimate"], ["millers", "Millers H."], ["mafia", "Mafia"], ["custom", "Custom"]].map(([v, l]) => '<button style="flex:1" data-act="seg" data-name="ruleset" data-v="' + v + '" class="' + (preset === v ? "sel" : "") + '">' + l + "</button>").join("") + "</div>" +
      sw("firstNightKill", "Wolves kill on night 1") + sw("dayFirst", "Open with a day") + sw("reveal", "Show cards of the dead") +
      '<div class="set-row"><span class="sl">' + esc(RN("seer")) + " sees</span>" + seg("seerSees", [["team", "Wolf or not"], ["role", "Exact card"]], o.seerSees) + "</div>" +
      sw("doctorSelf", esc(RN("doctor")) + " may guard self") + sw("guardRepeat", "Same guard two nights") + sw("witchSelfHeal", esc(RN("witch")) + " may heal self") + sw("witchBoth", "Both potions one night") +
      '<div class="set-row"><span class="sl">Wolves win at</span>' + seg("win", [["parity", "Equal"], ["all", "All dead"]], o.win) + "</div></div>" +
      (ui.mode === "online" && ui.view === "game" && ui.osnap && ui.osnap.code ? '<div class="set-group"><p class="label">Room ' + esc(ui.osnap.code) + '</p><div class="set-row"><span class="sl">' + (ui.osnap.isHost && ui.osnap.status === "lobby" ? "Close the room for everyone" : "A computer takes your seat") + '</span><button class="btn" data-act="leaveRoom">' + (ui.osnap.isHost && ui.osnap.status === "lobby" ? "Close room" : "Leave room") + "</button></div></div>" : "") +
      '<p class="muted" style="font-size:12px;margin:0">' + esc(window.WW_BUILD || "") + "</p>";
    openSheet("Settings", body);
    const fxBox = document.getElementById("fxSet");
    if (FX && fxBox) FX.renderSettings(fxBox);
    ui.sheet = "settings";
  }
  function claimSheet() {
    const g = S.game;
    const st = ui.claim || (ui.claim = { by: null, target: null });
    const alive = g.players.filter((p) => p.alive).map((p) => p.id);
    const all = g.players.map((p) => p.id);
    const body = '<p class="label">Who claims to be the ' + esc(RN("seer")) + "?</p>" + grid(g, alive, { sel: st.by, act: "claimBy" }) +
      '<p class="label">Who did they check?</p>' + grid(g, all.filter((id) => id !== st.by), { sel: st.target, act: "claimT", showDead: true });
    const ok = st.by != null && st.target != null;
    openSheet(esc(RN("seer")) + " claim", body, '<button class="btn" data-act="claimSave" data-w="0" ' + (ok ? "" : "disabled") + ">Not " + esc(aWolf()) + '</button><button class="btn warm" data-act="claimSave" data-w="1" ' + (ok ? "" : "disabled") + ">" + esc(aWolf().replace(/^a /, "A ")) + "</button>");
    ui.sheet = "claim";
  }
  function cpuClaimSheet() {
    const g = G();
    const st = ui.claim || (ui.claim = { by: ME(), target: null });
    const body = '<p class="help-text">Tell the table you are the ' + esc(RN("seer")) + " (true or not) and what you saw.</p>" + grid(g, g.players.filter((p) => p.id !== ME()).map((p) => p.id), { sel: st.target, act: "claimT", showDead: true });
    const ok = st.target != null;
    openSheet("Claim " + esc(RN("seer")), body, '<button class="btn" data-act="cpuClaimSave" data-w="0" ' + (ok ? "" : "disabled") + ">Not " + esc(aWolf()) + '</button><button class="btn warm" data-act="cpuClaimSave" data-w="1" ' + (ok ? "" : "disabled") + ">" + esc(aWolf().replace(/^a /, "A ")) + "</button>");
    ui.sheet = "cpuClaim";
  }

  // ------------------------------------------------------------ starting games
  function startTable() {
    const n = S.count;
    const names = playerNames(n);
    const seen = {};
    for (const nm of names) { const k = nm.trim().toLowerCase(); if (seen[k]) { oops("Two players are called " + nm + ". Give one a different name."); ui.setupStep = 1; render(); return; } seen[k] = 1; }
    const setup = currentSetup(n);
    const prob = W.setupProblem(W.normalizeSetup(setup, n), n);
    if (prob) { oops(prob); return; }
    ui.gen++;
    S.game = W.newGame(names, setup, { opts: S.settings.opts, mode: "table" });
    S.undo = [];
    ui.mode = "table"; ui.view = "game"; ui.dealOpen = false; ui.tab = "play"; ui.sel = null; ui.nightKey = null;
    save(); render();
  }
  function startCpu() {
    const n = S.cpuCount;
    const names = cpuNames(n);
    const setup = currentSetup(n);
    const prob = W.setupProblem(W.normalizeSetup(setup, n), n);
    if (prob) { oops(prob); return; }
    ui.gen++;
    const g = W.newGame(names, setup, { opts: S.settings.opts, mode: "seats", kinds: names.map((_, i) => (i ? "bot" : "human")) });
    g.players.forEach((p) => { if (p.id) p.level = S.settings.level; });
    S.cpu = g;
    ui.mode = "cpu"; ui.view = "game"; ui.tab = "play"; ui.sel = null;
    ui.cpuSeen = false;
    save();
    render();
    // Show your card first, then start.
    showCpuCard();
  }
  function showCpuCard() {
    const g = G(); const me = g.players[ME()];
    const partners = me.role === "wolf" ? g.players.filter((x) => x.role === "wolf" && x.id !== me.id).map((x) => esc(x.name)) : [];
    openSheet("Your card", '<div class="deal" style="padding:0"><div class="flip open" style="width:180px"><span class="flip-in"><span class="face back">' + art(null, 180) + '</span><span class="face front">' + art(me.role, 180) + '</span></span></div><p class="role-title ' + team(me.role) + '">' + esc(RN(me.role)) + '</p><p class="role-help">' + esc(roleHelp(me.role, g)) + (me.role === "wolf" ? "<br><b>" + (partners.length ? "Your pack: " + partners.join(", ") : "You hunt alone.") + "</b>" : "") + "</p></div>", '<button class="btn primary big" data-act="cpuBegin">' + (ui.mode === "online" ? "Got it" : g.opts.dayFirst ? "Start the day" : "Start the night") + "</button>");
    ui.sheet = "cpuCard"; sfx("cardFlip");
  }

  // ------------------------------------------------------------ events
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (!el) { if (ev.target === $sheet) handle("closeSheet", $sheet, null); return; }
    const a = el.dataset.act;
    // Ignore a tap that lands just after the screen changed under the finger (double taps).
    if (Date.now() - (ui.changedAt || 0) < 380 * FAST && a !== "closeSheet" && a !== "tab" && $app.contains(el)) return;
    const id = el.dataset.id != null ? +el.dataset.id : null;
    const sc = $app.querySelector("[data-keep-scroll]");
    ui.scrollTop = sc ? sc.scrollTop : 0;
    try { handle(a, el, id); } catch (e) { oops(e.message || String(e)); }
  });
  function leaveGame() { ui.gen++; window.Narrator.stop(); clearTimeout(pumpTimer); clearInterval(timerInt); if (ui.timer) ui.timer.running = false; }
  function handle(a, el, id) {
    switch (a) {
      case "home": if (ui.view === "online") { ui.view = "home"; render(); return; } leaveGame(); ui.view = "home"; ui.scrollTop = 0; closeSheet(); render(); return;
      case "back": ui.view = ui.view === "setup" && ui.setupMode === "online" ? "online" : "home"; render(); return;
      case "settings": settingsSheet(); return;
      case "closeSheet": {
        // (Your card's × closes it too: the Ready screen's Start button shows it again.)
        const from = ui.sheet === "help" ? ui.helpFrom : null;
        closeSheet();
        if (from === "settings") { settingsSheet(); return; }
        if (from === "claim") { claimSheet(); return; }
        if (from === "cpuClaim") { cpuClaimSheet(); return; }
      }
      render(); return;
      case "help": { const h = HELP[el.dataset.k]; if (h) { const prev = ui.sheet; openSheet(h[0], '<p class="help-text">' + esc(h[1]) + "</p>" + (el.dataset.k === "odds" && ui.view === "game" ? oddsWhy() : "")); ui.sheet = "help"; ui.helpFrom = prev; } return; }
      case "newTable": ui.setupMode = "table"; ui.setupStep = 1; ui.view = "setup"; render(); return;
      case "newCpu": ui.setupMode = "cpu"; ui.setupStep = 1; ui.view = "setup"; render(); return;
      case "resume": ui.mode = "table"; ui.view = "game"; ui.nightKey = null; ui.gen++; render(); resumeTable(); return;
      case "resumeCpu": ui.mode = "cpu"; ui.view = "game"; ui.gen++; render(); if (S.cpu && S.cpu.phase === "start") showCpuCard(); else pump(); return;
      case "lab": ui.view = "lab"; render(); return;
      case "rules": ui.view = "rules"; render(); return;
      case "setupNext": ui.setupStep = 2; ui.scrollTop = 0; render(); return;
      case "setupBack": ui.setupStep = 1; render(); return;
      case "count": {
        const cpu = ui.setupMode !== "table";
        const k = ui.setupMode === "cpu" ? "cpuCount" : ui.setupMode === "online" ? "onCount" : "count";
        S[k] = Math.max(cpu ? 5 : 4, Math.min(cpu ? 12 : 20, S[k] + +el.dataset.d));
        save(); render(); return;
      }
      case "pickSetup": S.choice[setupCount()] = +el.dataset.i; save(); render(); return;
      case "pickCustom": {
        const n = setupCount();
        if (S.choice[n] !== "custom") { S.custom[n] = W.normalizeSetup(currentSetup(n), n); S.choice[n] = "custom"; }
        save(); render(); return;
      }
      case "cust": {
        const n = setupCount();
        const c = W.normalizeSetup(S.custom[n] || currentSetup(n), n);
        const r = el.dataset.r;
        c[r] = Math.max(r === "wolf" ? 1 : 0, (c[r] || 0) + +el.dataset.d);
        const nc = W.normalizeSetup(c, n);
        if (W.setupSize(nc) > n || W.setupProblem(nc, n)) { oops(W.setupProblem(nc, n) || "No room"); return; }
        S.custom[n] = nc; save(); render(); return;
      }
      case "startGame": if (ui.setupMode === "cpu") startCpu(); else if (ui.setupMode === "online") createRoom(); else startTable(); return;

      // --- table deal
      case "flip": if (!ui.dealOpen) {
        ui.dealOpen = true; el.classList.add("open"); sfx("cardFlip");
        // One face at a time (WebKit draws hidden back faces): swap to the face once the card is edge-on.
        const fg = G(), fr = fg && fg.players[fg.revealIdx] ? fg.players[fg.revealIdx].role : null;
        setTimeout(() => { const fi = el.querySelector(".flip-in"), bk = fi && fi.querySelector(".back"); if (bk && fr) { bk.remove(); fi.insertAdjacentHTML("beforeend", '<span class="face front">' + art(fr, 220) + "</span>"); } }, 110);
        setTimeout(render, 420);
      } return;
      case "dealNext": ui.dealOpen = false; act({ type: "seen" }, { noUndo: true }); render(); return;
      case "begin": {
        window.Narrator.unlock();
        if (ui.mode === "cpu") { showCpuCard(); return; }
        act({ type: "start" }, { noUndo: true });
        S.undo = [];
        if (S.game.phase === "night") { ui.nightKey = null; render(); enterNightStep(); }
        else { narrate([{ say: "Everyone, open your eyes. The first day begins." }], () => {}); render(); }
        return;
      }
      // --- table night
      case "sel": ui.sel = ui.sel === id ? null : id; render(); return;
      case "nightPick": {
        const step = W.currentStep(S.game);
        act({ type: "pick", step, target: ui.sel }, { noUndo: true });
        ui.sel = null; finishStep(); return;
      }
      case "seerCheck": act({ type: "pick", step: "seer", target: ui.sel }, { noUndo: true }); ui.sel = null; render(); return;
      case "nightDone": finishStep(); return;
      case "witchHeal": ui.heal = !ui.heal; if (ui.heal && !S.game.opts.witchBoth) ui.poison = null; render(); return;
      case "poisonSel": ui.poison = ui.poison === id ? null : id; render(); return;
      case "witchDone": {
        if (ui.heal) act({ type: "pick", step: "witch", extra: "heal", target: true }, { noUndo: true });
        if (ui.poison != null) act({ type: "pick", step: "witch", extra: "poison", target: ui.poison }, { noUndo: true });
        finishStep(); return;
      }
      // --- table day
      case "toDay": act({ type: "day" }, { noUndo: true }); render(); return;
      case "vote": {
        const g = S.game; const t = ui.sel; ui.sel = null;
        act({ type: "vote", target: t });
        const lines = deathLines(S.game, [t], "day"); const hl = hunterLine(S.game); if (hl) lines.push(hl);
        if (S.game.winner) lines.push(winLine(S.game));
        narrate(lines.map((s) => ({ say: s })), () => {});
        void g; render(); return;
      }
      case "noVote": act({ type: "noVote" }); ui.sel = null; render(); return;
      case "shoot": case "shootAir": {
        const t = a === "shoot" ? ui.sel : null; ui.sel = null;
        if (SEATED()) { seatAct({ type: "shoot", target: t }); return; }
        const g = S.game; const by = g.pendingHunters[0];
        act({ type: "shoot", by, target: t });
        const lines = [t != null ? g.players[by].name + " shoots " + g.players[t].name + "." : g.players[by].name + " fires into the air."];
        if (t != null && S.game.players[t].revealed) lines.push(g.players[t].name + " was " + aRole(S.game.players[t].role) + ".");
        if (S.game.winner) lines.push(winLine(S.game));
        narrate(lines.map((s) => ({ say: s })), () => {
          if (S.game && S.game.phase === "morning" && !S.game.pendingHunters.length) { act({ type: "day" }, { noUndo: true }); render(); }
        });
        render(); return;
      }
      case "toNight": {
        if (ui.mode === "cpu") { window.Narrator.unlock(); applyCpu({ type: "night" }); pump(); return; }
        window.Narrator.unlock();
        act({ type: "night" }); ui.nightKey = null; ui.sel = null; render(); enterNightStep(); return;
      }
      case "claim": ui.claim = null; claimSheet(); return;
      case "claimBy": ui.claim.by = id; if (ui.claim.target === id) ui.claim.target = null; if (ui.sheet === "claim") claimSheet(); return;
      case "claimT": ui.claim.target = id; if (ui.sheet === "claim") claimSheet(); else cpuClaimSheet(); return;
      case "claimSave": act({ type: "claim", by: ui.claim.by, target: ui.claim.target, wolf: el.dataset.w === "1" }); closeSheet(); render(); return;
      case "unclaim": act({ type: "unclaim", index: +el.dataset.i }); render(); return;
      case "undo": {
        if (!S.undo.length) return;
        window.Narrator.stop();
        S.game = S.undo.pop(); ui.sel = null; ui.fxSkip = true; save(); render(); return;
      }
      case "tab": ui.tab = el.dataset.t; render(); return;
      case "timer": toggleTimer(); return;
      case "hint": toast(hintText()); return;
      case "again": {
        leaveGame();
        if (ui.mode === "cpu") { startCpu(); return; }
        const g = S.game;
        S.game = W.newGame(g.players.map((p) => p.name), g.setup, { opts: S.settings.opts, mode: "table" });
        S.undo = []; ui.dealOpen = false; ui.nightKey = null; ui.tab = "play"; save(); render(); return;
      }
      // --- cpu
      case "cpuBegin": if (ui.mode === "online") { closeSheet(); window.Narrator.unlock(); render(); return; }
        closeSheet(); window.Narrator.unlock(); applyCpu({ type: "start" }); if (S.cpu.phase === "night") window.Narrator.play([{ say: "Night falls. Everyone, close your eyes." }], { voice: S.settings.voice, scale: FAST }); pump(); return;
      case "cpuPick": seatAct({ type: "pick", step: W.currentStep(G()), target: ui.sel }); return;
      case "cpuDone": seatAct({ type: "done", step: W.currentStep(G()) }); return;
      case "cpuHeal": seatAct({ type: "pick", step: "witch", extra: "heal", target: el.dataset.v === "1" }); return;
      case "cpuPoison": seatAct({ type: "pick", step: "witch", extra: "poison", target: el.dataset.v === "none" ? null : ui.sel }); return;
      case "cpuVote": seatAct({ type: "ballot", target: ui.sel }); return;
      case "cpuSkip": seatAct({ type: "ballot", target: null }); return;
      case "cpuClaim": ui.claim = { by: ME(), target: null }; cpuClaimSheet(); return;
      case "cpuClaimSave": seatAct({ type: "claim", target: ui.claim.target, wolf: el.dataset.w === "1" }); closeSheet(); return;
      // --- online
      case "online": ui.view = "online"; render(); return;
      case "resumeOnline": resumeOnline(); return;
      case "onCreate": ui.setupMode = "online"; ui.setupStep = 1; ui.view = "setup"; render(); return;
      case "onJoin": joinRoom(); return;
      case "seatKind": if (room) room.setSeat(+el.dataset.i, el.dataset.k).then((r) => { if (r && !r.ok) toast(r.message); }); return;
      case "onStart": if (room) { window.Narrator.unlock(); room.start().then((r) => { if (r && !r.ok) toast(r.message); }); } return;
      case "copyCode": try { navigator.clipboard.writeText(ui.osnap.code); toast("Code copied"); } catch (e) { toast(ui.osnap.code); } return;
      case "leaveRoom": leaveRoom(); return;
      case "seg": {
        const name = el.dataset.name, v = el.dataset.v;
        if (name === "theme" || name === "rate" || name === "level") S.settings[name] = v;
        else if (name === "timer") { S.settings.timer = +v; ui.timer = null; }
        else if (name === "ruleset") { S.settings.ruleset = v; if (W.RULESETS[v]) S.settings.opts = Object.assign({}, W.RULESETS[v].opts); if (v === "mafia") S.settings.theme = "mafia"; }
        else { S.settings.opts[name] = v; syncRuleset(); }
        save(); settingsSheet(); render(); return;
      }
      default: return;
    }
  }
  function syncRuleset() {
    const hit = Object.keys(W.RULESETS).find((k) => Object.keys(W.RULESETS[k].opts).every((o) => W.RULESETS[k].opts[o] === S.settings.opts[o]));
    S.settings.ruleset = hit || "custom";
  }
  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.dataset.opt) { S.settings.opts[t.dataset.opt] = t.checked; syncRuleset(); save(); settingsSheet(); render(); }
    else if (t.dataset.set) { S.settings[t.dataset.set] = t.checked; save(); }
  });
  document.addEventListener("input", (ev) => {
    const t = ev.target;
    if (t.dataset.name != null) { S.names[+t.dataset.name] = cut14(t.value); save(); }
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !$sheet.classList.contains("hidden")) handle("closeSheet", $sheet, null); });

  function resumeTable() {
    const g = S.game;
    if (!g) return;
    if (g.phase === "night") { ui.nightKey = null; enterNightStep(); }
  }

  // Hook: whenever the table game sits at night with no step armed, arm it.
  const _render = render;
  render = function () {
    const fxEv = fxDiff();
    _render();
    try { afterDraw(); } catch (e) { /* the table look never breaks the game */ }
    if (fxEv && fxEv.length) { try { window.WWFX.fire(fxEv); } catch (e) { /* effects never break the game */ } }
    if (ui.view === "game" && ui.mode === "table" && S.game && S.game.phase === "night" && ui.nightKey !== nightKey(S.game)) enterNightStep();
    syncHistory();
  };
  // ---- the phone's Back (swipe / browser button) goes to the screen you were just on,
  // never out of the app: one history entry per level below the menu.
  function screenDepth() {
    const v = ui.view;
    const sheet = $sheet.classList.contains("hidden") ? 0 : 1; // an open sheet is one more step
    if (v === "home") return sheet;
    if (v === "setup") return (ui.setupMode === "online" ? 2 : 1) + (ui.setupStep === 2 ? 1 : 0) + sheet;
    return 1 + sheet; // game, lab, rules, online
  }
  ui.hd = 0; ui.popSkip = 0;
  function syncHistory() {
    if (!window.history || !history.pushState) return;
    const d = screenDepth();
    try {
      while (ui.hd < d) { ui.hd++; history.pushState({ ww: ui.hd }, ""); }
      if (ui.hd > d) { ui.popSkip++; history.go(d - ui.hd); ui.hd = d; }
    } catch (e) { /* history blocked: Back simply leaves, as before */ }
  }
  window.addEventListener("popstate", () => {
    if (ui.popSkip) { ui.popSkip--; return; }
    ui.hd = Math.max(0, ui.hd - 1);
    if (!$sheet.classList.contains("hidden")) {
      // An open sheet closes first.
      handle("closeSheet", $sheet, null); return;
    }
    if (ui.view === "setup" && ui.setupStep === 2) { ui.setupStep = 1; render(); return; }
    if (ui.view === "setup" && ui.setupMode === "online") { ui.view = "online"; render(); return; }
    if (ui.view !== "home") { handle("home", $app, null); return; }
    render();
  });
  // What changed in the game since the last screen (any mode: your taps, computers, online players).
  function fxDiff() {
    if (!FX || !window.WWFX) return null;
    const g = ui.view === "game" ? G() : null;
    const prev = ui.fxMode === ui.mode ? ui.fxG : null;
    const before = ui.fxMine;
    const mineNow = !!(g && SEATED() && !g.winner && pendingOf(g).indexOf(ME()) >= 0);
    ui.fxG = g; ui.fxMode = ui.mode; ui.fxMine = mineNow;
    if (!g || g === prev) return null;
    if (ui.fxSkip) { ui.fxSkip = false; return null; } // undo: going back makes no sound
    try { return window.WWFX.events(prev, g, { seat: SEATED() ? ME() : null, mineBefore: !!(prev && before), mineNow: !!prev && mineNow }); } catch (e) { return null; }
  }

  // ------------------------------------------------------------ online rooms
  // The shared module (js/online.js, an ES module) loads only when online play
  // is first opened, so local play never touches the network.
  let room = null;
  let roomLoading = null;
  function getRoom() {
    if (room) return Promise.resolve(room);
    if (roomLoading) return roomLoading;
    roomLoading = import("./online.js?v=a3d0418b").then((mod) => {
      room = mod.createOnline({ game: window.WWOnline.game, gameId: "werewolf", botDelayMs: Math.round(900 * Math.max(FAST, 0.2)) });
      room.on("change", onSnap);
      room.on("error", (m) => { if (m) toast(m); });
      return room;
    }).catch((e) => { roomLoading = null; throw new Error("Couldn't load online play. Check the connection."); });
    return roomLoading;
  }
  function onSnap(snap) {
    const prev = ui.og;
    ui.osnap = snap;
    ui.og = snap && snap.pub ? window.WWOnline.mergeView(snap.pub, snap.mine) : null;
    if (snap && snap.code && (snap.status === "lobby" || snap.status === "playing")) { S.online = { code: snap.code }; save(); }
    if (snap && (snap.status === "closed" || snap.status === "left" || snap.status === "none")) {
      if (S.online) { S.online = null; save(); }
      if (ui.mode === "online" && ui.view === "game") { ui.view = "home"; toast(snap.status === "closed" ? "The room was closed." : "You left the room."); render(); }
      return;
    }
    if (ui.mode !== "online" || ui.view !== "game") return;
    const g = ui.og;
    if (g && prev && prev.seed === g.seed) {
      if (g.phase !== prev.phase || g.day !== prev.day || g.nightNo !== prev.nightNo || (g.night && prev.night && g.night.i !== prev.night.i)) ui.sel = null;
      announceChange(prev, g);
    }
    // First look at a new game: show your card.
    if (g && !g.winner && ui.cardSeed !== g.seed) {
      ui.cardSeed = g.seed;
      render();
      showCpuCard();
      return;
    }
    render();
  }
  function onlineName() { return cut14((S.names[0] || "").trim() || "Player"); }
  function renderOnline() {
    const body = '<div class="page online-pick" style="max-width:520px">' +
      '<p class="label">Your name</p><div class="names"><div class="nm"><span class="seat">' + IC.play.replace("<svg", '<svg width="16" height="16"') + '</span><input type="text" data-name="0" maxlength="14" placeholder="Your name" value="' + esc(S.names[0] || "") + '" aria-label="Your name" autocomplete="off"></div></div>' +
      '<p class="label" style="margin-top:18px">Join a room</p><div class="row join-row"><input id="joinCode" class="code-in" type="text" inputmode="text" autocapitalize="characters" autocomplete="off" maxlength="5" placeholder="CODE" aria-label="Room code"><button class="btn primary" data-act="onJoin">Join</button></div>' +
      '<p class="label" style="margin-top:18px">Or host one</p><button class="menu-item main-item" data-act="onCreate"><span class="mi-ic">' + IC.table + '</span><span><b>Create a room</b><small>Pick players and roles, then share the code</small></span></button>' +
      '<p class="muted" style="font-size:13px;margin-top:16px">Everyone plays on their own phone. Open seats can be filled by computers. The host\'s phone runs the game, so keep it open.</p></div>';
    return topbar("Play online", "", backBtn("home"), gearBtn) + '<div class="main"><div class="pane"><div class="pad scroll" style="flex:1">' + body + "</div></div></div>";
  }
  function renderLobby() {
    const snap = ui.osnap;
    if (!snap || !snap.code) {
      const msg = snap && snap.status === "joining" ? "Joining…" : "Connecting…";
      return topbar("Online", "", '<button class="icon-btn" data-act="home" aria-label="Menu">' + IC.back + "</button>", gearBtn) + '<div class="main"><div class="pane"><div class="empty" style="margin:auto">' + msg + "</div></div></div>";
    }
    const host = snap.isHost;
    const rows = snap.seats.map((s, i) => {
      const me = i === snap.mySeat;
      const kind = s.kind === "human" ? (s.name || "Player") : s.kind === "computer" ? "Computer" : "Open seat";
      const dot = s.kind === "human" ? '<span class="dot ' + (s.online ? "on" : "") + '" aria-label="' + (s.online ? "online" : "away") + '"></span>' : "";
      let ctl = "";
      if (host && !me && s.kind !== "human") ctl = '<button class="btn ghost seat-btn" data-act="seatKind" data-i="' + i + '" data-k="' + (s.kind === "computer" ? "empty" : "computer") + '">' + (s.kind === "computer" ? "Open" : "Computer") + "</button>";
      return '<div class="nm' + (s.kind === "human" ? "" : " bot") + '"><span class="seat">' + (i + 1) + "</span><span class=\"seat-name\">" + dot + esc(kind) + (me ? ' <span class="muted">(you)</span>' : "") + (s.isHost ? ' <span class="tagbot">host</span>' : "") + "</span>" + ctl + "</div>";
    }).join("");
    const filled = snap.seats.filter((s) => s.kind !== "empty").length;
    const o = snap.options || {};
    const setup = o.setup ? W.normalizeSetup(o.setup, snap.seats.length) : null;
    const chips = setup ? '<div class="so-roles" style="margin:6px 0 2px">' + W.ROLE_KEYS.filter((r) => setup[r]).map((r) => '<span class="chip ' + team(r) + '">' + glyph(r) + (setup[r] > 1 ? setup[r] + " " : "") + esc(RN(r, setup[r] > 1)) + "</span>").join("") + "</div>" : "";
    const body = '<div class="lobby"><button class="code-big" data-act="copyCode" aria-label="Copy room code"><small>Room code</small><b>' + esc(snap.code) + '</b><small>Friends type this in “Play online”</small></button>' +
      chips + '<p class="label" style="margin-top:12px">Seats · ' + filled + " of " + snap.seats.length + "</p><div class=\"names\">" + rows + "</div>" + (filled < snap.seats.length ? '<p class="muted" style="font-size:13px;margin:6px 0 0">' + (host ? "Open seats become computers when you start." : "Open seats become computers when the host starts.") + "</p>" : "") + "</div>";
    const foot = host ? '<button class="btn" data-act="leaveRoom">Close room</button><button class="btn primary big" data-act="onStart">Start</button>'
      : '<button class="btn" data-act="leaveRoom">Leave</button><div class="muted" style="flex:1;text-align:center;padding:10px">Waiting for the host…</div>';
    return topbar("Room " + esc(snap.code), "", '<button class="icon-btn" data-act="home" aria-label="Menu">' + IC.back + "</button>", gearBtn) +
      '<div class="main"><div class="pane"><div class="day"><div class="day-body">' + body + '</div><div class="day-foot">' + foot + "</div></div></div></div>";
  }
  function enterOnline() { ui.mode = "online"; ui.view = "game"; ui.tab = "play"; ui.sel = null; ui.gen++; render(); }
  function createRoom() {
    const n = S.onCount;
    const setup = currentSetup(n);
    const prob = W.setupProblem(W.normalizeSetup(setup, n), n);
    if (prob) { oops(prob); return; }
    ui.osnap = null; ui.og = null; enterOnline();
    getRoom().then((r) => r.createRoom({ name: onlineName(), seats: ["human"].concat(Array(n - 1).fill("empty")), options: { setup: W.normalizeSetup(setup, n), opts: Object.assign({}, S.settings.opts), level: S.settings.level } }))
      .then((res) => { if (!res.ok) { toast(res.message || "Couldn't create the room."); ui.view = "online"; render(); } })
      .catch((e) => { toast(e.message); ui.view = "online"; render(); });
  }
  function joinRoom() {
    const inp = document.getElementById("joinCode");
    const code = (inp ? inp.value : "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 5) { oops("Room codes have 5 letters."); return; }
    ui.osnap = null; ui.og = null; enterOnline();
    getRoom().then((r) => r.joinRoom(code, onlineName()))
      .then((res) => { if (!res.ok) { toast(res.message || "Couldn't join that room."); ui.view = "online"; render(); } })
      .catch((e) => { toast(e.message); ui.view = "online"; render(); });
  }
  function resumeOnline() {
    enterOnline();
    if (room && ui.osnap && ui.osnap.code) { render(); return; }
    getRoom().then((r) => r.resume()).then((ok) => {
      if (!ok) { S.online = null; save(); ui.view = "home"; toast("That room has ended."); render(); }
    }).catch((e) => { toast(e.message); ui.view = "home"; render(); });
  }
  function leaveRoom() {
    const r = room;
    const closing = ui.osnap && ui.osnap.isHost && ui.osnap.status === "lobby";
    S.online = null; save();
    ui.osnap = null; ui.og = null; ui.view = "home"; closeSheet(); window.Narrator.stop();
    render();
    if (r) (closing ? r.close() : r.leave()).catch(() => {});
  }

  // The same game open in two tabs: when the other tab saves, take its newer state here, so this
  // (now stale) tab can never write an older game over it.
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    const playing = ui.view === "game" && ui.mode !== "online";
    S = load();
    if (playing) { leaveGame(); closeSheet(); ui.view = "home"; render(); toast("This game moved on in another tab."); }
    else if (ui.view === "home") render();
  });

  // Debug/test hook (used by headless checks): window.__ww
  window.__ww = { S: () => S, ui, W, room: () => room, fit: { layoutTables, applyFit, seatClashes } };
  render();
})();
