/* wwcoach.js: Werewolf's part of the shared coach kit (js/coach.js, never edit that one here):
 * the rules sheet and the guided first game.
 *   WWCoach.ROLES, WWCoach.SEED   the guided game's deal (always the same: you are the Seer, 6 players)
 *   WWCoach.steps(ctx)            ctx: { state() -> the game state or null, sel() -> the player you have tapped or null }
 *   WWCoach.rules(names)          COACH.rules() options; names = the theme's words
 * Plain script: window.WWCoach in the browser, module.exports in node. */
(function (root) {
  "use strict";
  const ID = "werewolf-first";
  const SEED = 41;
  const ME = 0;
  // You are the Seer; one werewolf, a Doctor and three villagers, all Easy computers.
  const ROLES = ["seer", "villager", "wolf", "villager", "doctor", "villager"];

  function steps(ctx) {
    const st = () => ctx.state();
    const phase = () => { const g = st(); return g ? g.phase : ""; };
    const night = () => { const g = st(); return g ? g.nightNo : 0; };
    const step = () => { const g = st(); return g && g.night ? g.night.steps[g.night.i] : ""; };
    const checked = () => { const g = st(); return !!g && g.seerLog.some((r) => r.by === ME && r.n === g.nightNo); };
    const voted = () => { const g = st(); return !!g && g.ballots && g.ballots[ME] != null; };
    const over = () => { const g = st(); return !g || !!g.winner; };
    const picked = () => !!ctx.sel && ctx.sel() != null;
    return [
      { title: "Your first game of Werewolf", html: "Six players sit round the table. <b>One is a werewolf</b>, played by a computer. Everyone else is the village. You are the <b>Seer</b>. The village wins when the werewolf is voted out; the werewolf wins when it can no longer be outvoted.", when: () => phase() === "night" || phase() === "day", skipIf: over },
      { target: ".ww-seat:not([disabled])", title: "Night: look at a card", html: "At night everyone closes their eyes and each role wakes in turn. You wake now. <b>Tap a player</b> to look at their card.", when: () => phase() === "night" && step() === "seer" && !checked(), until: () => picked() || checked(), skipIf: () => over() || night() > 1 || phase() === "day" },
      { target: '[data-act="cpuPick"]', title: "Check", html: "Tap <b>Check</b> to learn if that player is the werewolf.", when: () => phase() === "night" && step() === "seer" && !checked() && picked(), until: checked, skipIf: () => over() || night() > 1 || phase() === "day" },
      { target: ".result-card", title: "Only you know", html: "Nobody else saw this. Tomorrow you decide whether to tell the table. Tap <b>Close eyes</b> to let the night go on.", when: () => phase() === "night" && checked() && step() === "seer", until: () => step() !== "seer" || phase() !== "night", next: true, skipIf: () => over() || night() > 1 },
      { target: ".stat-line", title: "Day: talk and vote", html: "Morning. Each number on the table is that player's <b>chance of being the werewolf</b>, from what everyone knows so far. Tap <b>?</b> next to Wolf odds for how it works.", when: () => phase() === "day" && !voted(), next: true, skipIf: () => over() || voted() },
      { target: '[data-act="cpuClaim"]', title: "Claim", html: "<b>Claim</b> tells the table you are the Seer and what you saw. The computers listen, but a werewolf may fake a claim too.", when: () => phase() === "day" && !voted(), next: true, skipIf: () => over() || voted() },
      { target: ".ww-seat:not([disabled])", title: "Vote", html: "Tap the player you think is the werewolf. Whoever gets the most votes is out. A tie sends nobody out.", when: () => phase() === "day" && !voted(), until: () => picked() || voted(), skipIf: () => over() || voted() },
      { target: '[data-act="cpuVote"]', title: "Cast your vote", html: "Tap <b>Vote</b>. (Changed your mind? Tap someone else first.)", when: () => phase() === "day" && !voted() && picked(), until: voted, skipIf: () => over() || voted() },
      { target: '[data-act="hint"]', title: "Stuck?", html: "<b>Hint</b> shows the computer's best read. <b>Undo</b> (top right) takes back your last move. Either one makes that game count as \"with help\" in My stats.", when: () => phase() === "day" || phase() === "dusk", next: true, skipIf: over },
      { title: "You've got it", html: "Nights and days take turns until one side wins. Other roles (Doctor, Witch, Hunter …) wake at night too. The full rules are in <b>Settings</b> → Rules." },
    ];
  }

  // Learn-more videos on YouTube (each checked with YouTube's oEmbed on 2026-10-28: id, title, channel · what it's for).
  const VIDEOS = [
    ["3Ez7sPnTPp0", "Learn how to play Ultimate Werewolf in 3 minutes", "Bezier Games (the publisher) · the basics"],
    ["VDRSUgcKuf8", "How to Play &amp; Moderate Ultimate Werewolf (Rules School)", "Game Boy Geek · full rules and running a game"],
    ["CvKH43WXhNk", "Ultimate Werewolf: Guide to Roles", "Meeple University · every role, Tanner, Minion and Lycan included"],
    ["CU1fGfErrXA", "How to Play Mafia", "Play-In Games · the Mafia version"],
  ];

  /** Rules sheet. n: { wolf, wolves, village, seer, doctor, bodyguard, witch, hunter, mason, prince, lycan, minion, tanner, villager } in the theme's words. */
  function rules(n) {
    n = n || {};
    const w = (k, d) => n[k] || d;
    return {
      title: "How to play",
      sections: [
        { id: "goal", short: "Goal", title: "Goal", html: "<p>Everyone gets a secret card. A few players are the <b>" + w("wolves", "Werewolves") + "</b>; the rest are the <b>" + w("village", "Village") + "</b>.</p><ul><li>The village wins when every " + w("wolf", "Werewolf") + " is gone.</li><li>The " + w("wolves", "Werewolves") + " win when they can no longer be outvoted (equal numbers), or under Millers Hollow rules when every villager is dead.</li></ul><p class=\"tip\">No moderator: the phone runs the night and the narrator reads it out.</p>" },
        { id: "night", short: "Night", title: "Night", html: "<ul><li>Everyone closes their eyes. Each role is called in turn and wakes alone.</li><li>The " + w("wolves", "Werewolves") + " wake together and pick one victim.</li><li>The " + w("seer", "Seer") + " looks at one player: " + w("wolf", "Werewolf") + " or not (Millers Hollow: the exact card).</li><li>The " + w("doctor", "Doctor") + " and " + w("bodyguard", "Bodyguard") + " guard one player from the attack.</li><li>The " + w("witch", "Witch") + " has one heal and one poison for the whole game.</li></ul><p class=\"tip\">Every role is called each night, even when dead, so the narration gives nothing away.</p>" },
        { id: "day", short: "Day", title: "Day", html: "<ul><li>Morning: the narrator says who died. Under most rules their card is shown.</li><li>The living talk, accuse and claim. Anyone may lie, including a fake " + w("seer", "Seer") + ".</li><li>Then everyone votes. Most votes goes out. A tie sends nobody out.</li></ul><p class=\"tip\">Wolf odds: the number on each seat is that player's chance of being a " + w("wolf", "Werewolf") + ", worked out exactly from what the whole table knows.</p>" },
        { id: "roles", short: "Roles", title: "Special roles", html: "<ul><li><b>" + w("hunter", "Hunter") + "</b>: when killed, shoots one player at once.</li><li><b>" + w("mason", "Mason") + "s</b>: wake on the first night to see each other.</li><li><b>" + w("prince", "Prince") + "</b>: if voted out, the card is shown and the " + w("prince", "Prince") + " stays in.</li><li><b>" + w("lycan", "Lycan") + "</b>: on the village's side, but the " + w("seer", "Seer") + " sees a " + w("wolf", "Werewolf") + ".</li><li><b>" + w("minion", "Minion") + "</b>: plays for the " + w("wolves", "Werewolves") + " and knows them; they don't know the " + w("minion", "Minion") + ". The " + w("seer", "Seer") + " sees a " + w("villager", "Villager") + ".</li><li><b>" + w("tanner", "Tanner") + "</b>: wins if they die, by any cause; the game goes on.</li><li><b>" + w("villager", "Villager") + "</b>: no power, only a vote.</li></ul><p class=\"tip\">" + w("lycan", "Lycan") + ", " + w("minion", "Minion") + " and " + w("tanner", "Tanner") + " are off unless you add them in a Custom setup.</p>" },
        { id: "sets", short: "Rule sets", title: "Rule sets (Settings)", html: "<ul><li><b>Ultimate Werewolf</b>: the first night the wolves only meet; the Seer learns wolf or not; wolves win at equal numbers.</li><li><b>Millers Hollow</b>: wolves kill on night one; the Seer sees the exact card; wolves win when every villager is dead.</li><li><b>Mafia</b>: opens with a day; the Detective learns Mafia or not.</li></ul><p class=\"tip\">Every rule is also a switch of its own in Settings.</p>" },
        { id: "videos", short: "Videos", title: "Videos", html: "<ul class=\"ww-videos\">" + VIDEOS.map((v) => '<li><a href="https://www.youtube.com/watch?v=' + v[0] + '" target="_blank" rel="noopener">' + v[1] + "</a><br><small>" + v[2] + "</small></li>").join("") + "</ul><p class=\"tip\">Opens YouTube in a new tab.</p>" },
      ],
    };
  }

  const api = { ID, SEED, ME, ROLES, steps, rules };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.WWCoach = api;
})(typeof window !== "undefined" ? window : globalThis);
