/* wwprofile.js: Werewolf's part of the player profile (shared kit js/profile.js, never edit that one here):
 * the computer levels' ratings, the achievements, the Daily game and turning a game into a result.
 *
 * What counts: one whole game vs computers. Starting a new game over one you have already moved in
 * counts as a loss. A game where you used Hint or Undo counts as "with help" and isn't rated.
 * The guided first game isn't counted. Online and table games aren't counted.
 * Plain script: window.WWProfile in the browser, module.exports in node (tests/profile.test.js). */
(function (root) {
  "use strict";
  // Elo of each level from measured head-to-head play (tests/roles.test.js, progress.md): each level plays
  // both teams against the other; the fair-share score p is the mean of its two win rates.
  // difference = 400·log10(p / (1 − p)), rounded to 10. Easy anchored at 1200.
  //   Normal vs Easy 76.7% -> +210.   Smart vs Normal 80.8% -> +250.
  const LEVELS = [{ id: "easy", name: "Easy", rating: 1200 }, { id: "normal", name: "Normal", rating: 1410 }, { id: "smart", name: "Smart", rating: 1660 }];
  const RANK = { easy: 0, normal: 1, smart: 2 };

  const won = (c) => !!(c.last && c.last.won);
  const ex = (c) => (c.last && c.last.extra) || {};
  const ACH = [
    { id: "first", title: "First win", desc: "Win a game of Werewolf", test: (c) => c.stats.wins >= 1 },
    { id: "normal", title: "Sharp eyes", desc: "Win against Normal computers", test: (c) => won(c) && RANK[c.last.level] >= 1 },
    { id: "smart", title: "Old hand", desc: "Win against Smart computers", test: (c) => won(c) && c.last.level === "smart" },
    { id: "wolf", title: "Wolf in the fold", desc: "Win as a werewolf", test: (c) => won(c) && ex(c).team === "wolves" },
    { id: "seer", title: "Second sight", desc: "As the Seer, find a werewolf", test: (c) => ex(c).seerFound >= 1 },
    { id: "hunter", title: "Last shot", desc: "As the Hunter, take a werewolf with you", test: (c) => ex(c).hunterWolf >= 1 },
    { id: "alive", title: "Still standing", desc: "Win and be alive at the end", test: (c) => won(c) && ex(c).alive },
    { id: "crowd", title: "Full house", desc: "Win a game with 10 or more players", test: (c) => won(c) && ex(c).players >= 10 },
    { id: "streak", title: "Hat trick", desc: "Win 3 in a row", test: (c) => c.stats.bestStreak >= 3 },
    { id: "daily", title: "Every night", desc: "3-day Daily streak", test: (c) => c.daily.streak >= 3 },
  ];

  // Today's Daily game: the same deal for everyone that day. Ultimate rules, you + 7 Normal computers.
  const DAILY = { level: "normal", players: 8, setup: { wolf: 2, seer: 1, doctor: 1, hunter: 1, villager: 3 } };

  function init(onDaily) {
    if (!root.Profile) return false;
    root.Profile.init({
      game: "werewolf", levels: LEVELS, achievements: ACH, draws: false,
      modes: { computer: { name: "vs computer" }, help: { name: "With help" } },
      daily: { title: "Daily game", onPlay: () => onDaily && onDaily() },
    });
    return true;
  }

  const teamOf = (role) => (role === "wolf" ? "wolves" : "village");

  /** A finished (or abandoned) game vs computers -> Profile.recordResult input.
   *  g: the engine state; me: your seat; meta: { helped, daily } */
  function result(g, me, meta) {
    meta = meta || {};
    const p = g.players[me];
    const team = teamOf(p.role);
    const over = !!g.winner;
    const w = over && g.winner === team;
    const bot = g.players.find((x) => x.id !== me && x.level);
    const mode = meta.helped ? "help" : "computer";
    const level = mode === "computer" && bot && RANK[bot.level] != null ? bot.level : null;
    const seerFound = (g.seerLog || []).filter((r) => r.by === me && (r.wolf || r.role === "wolf")).length;
    const hunterWolf = (g.log || []).filter((e) => e.t === "shot" && e.by === me && e.target != null && g.players[e.target].role === "wolf").length;
    const extra = { role: p.role, team, alive: !!p.alive, seerFound, hunterWolf, players: g.players.length, day: g.day };
    if (!over) extra.quit = true;
    return { mode, level, won: w, daily: !!meta.daily, extra };
  }

  const api = { LEVELS, ACH, DAILY, RANK, init, result };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.WWProfile = api;
})(typeof window !== "undefined" ? window : globalThis);
