# Werewolf / Mafia — progress

## START HERE
Read order: this file → `CLAUDE.md` → `docs/rules-check.md` → `docs/ideas.md` → `chat.md` (latest entry).
Last updated: 2026-10-27, by the improve-pass builder agent (kits, Undo, Daily, layout).

## Goal right now
A no-moderator Werewolf / Mafia companion on Tim's iPhone. It covers:
- **Table game**: one phone at a real table, with a voice narrator.
- **Vs computer**.
- **Online rooms**: friends on their own phones, with computers filling seats.

The study layers are measured setup balance, live wolf odds, and computers at three measured strengths. All rules and variants are exact and sourced.

## Status
| Part | State |
|---|---|
| Rules engine (`js/engine.js`) | Done. Ultimate / Millers Hollow / Mafia rule sets, and every rule is a Settings switch. 20 engine tests. |
| Wolf odds | Done. Exact enumeration; brute-force and hand-worked tests. "Why this %" table (no claims vs with claims) sits behind the odds ?. |
| Setup balance | Done. 10,000 simulated games per suggested setup, n = 5–16, all three rule sets (`js/setups-data.js`). Custom setups are measured live in a Web Worker. |
| Computers | Done. Easy / Normal / Smart, measured matrix in the Setup lab. Bots only see `view(state, seat)` (test proves it). |
| Table game | Done. Pass-the-phone deal, narrated night, day with claims, odds, vote, no-vote, Hunter shot, undo, day timer (Settings, off by default). |
| Vs computer | Done. Your card, night actions, claim / skip / vote, hint, vote record on the game-over screen. |
| Online | **Done and wired** with the shared `_online` module (`js/online.js` copied unchanged, adapter `js/game-online.js`). Create room → code → join → host sets open seats to computer → start. Measured: two-browser game played to the end twice on the real Firebase project, including a reload plus "Resume online" mid-game. |
| Art | Done. Original SVG role cards (werewolf + mafia themes), card back, icon. |
| Docs | `docs/rules-check.md` (sources), `docs/ideas.md` (17 ideas: 11 built, 6 skipped). |
| Design pass (10-20) | Done. Laptop: player tiles 4 per row at 84 px (they were one 60 px strip), night centred at 900 px with the hidden log column removed, bigger setup chips and home menu. iPhone: the deal card shrinks with screen height so "Hide · pass on" fits (it was cut off). Disabled main buttons are a coloured outline with readable text (were muddy fills). Hint button and ? marks have 40 px taps. Online name field and "Create a room" are full width. Laptop setup shows only "Deal cards". Shots: `scratchpad/design/werewolf/before|after/`. |
| Sound & effects (10-20) | Done. Shared `js/fx.js` (copied unchanged from `_fx/`) + `js/game-fx.js` (this game's event → sound map, two custom sounds, animations, celebrations). Driven by state diffs in `render()`, so table, vs computer and online all sound the same. Settings has a "Sound & effects" group. Test `tests/fx.test.js` (4 tests). |
| Table look (10-20) | Done. Every play screen is a dark-wood table (shared kit `css/table.css` + `js/table.js`, copied unchanged from `_table/`). Players sit round a rounded-rectangle table from your seat (`ring()` / `layoutTables()` in app.js): one real-ratio card each, name plate, odds pill; your card peeked face up at the bottom (vs computer / online). Dead cards turn face up with a 3-D turn and grey out. News, claims and the Seer's answer are paper slips in the middle; night darkens the same table. Deal: the role deck is a stack that thins per card, top-left, and deals onto the table. Sizes: s-l ≤8, s-m ≤12, s-s 13-20 (markers laid on the card); short (landscape) and ≤360 px rules. Shots: `scratchpad/table/werewolf/before|after5/`. |
| QA fixes (10-20) | Done, all 9 from the QA agent: the night panel scrolls with Done pinned (20 players: Done at y=647 of 659), a dead human Hunter chooses their own shot vs computer, taps are ignored for 380 ms after a screen change (double taps), Settings has Leave room online, damaged saves fall back to defaults (and a broken game goes home with a toast), resume shows your card, duplicate names are blocked with a toast. |
| Edge pass (10-20) | Done. 46 weird scenarios tested (table below), 14 failures fixed. Tests `tests/edge.test.js` (9). |
| Visibility pass (10-27) | Done. Cards grow to fill the table (largest size with no seat touching another or poking off the table); names ≥ 10 px, odds ≥ 12 px everywhere; landscape phone puts the stat line and buttons in a right column so the table gets the full height. Card width, 20 players: 1280 px 40 → 52, 393 px 22 → 24, 320 px 20 → 18 (text up from 9 px, 2 overlaps gone); 8 players at 1280: 64 → 100. Check: `tools/qa/layout-check.mjs <url> [webkit/chromium]` (needs a local server). |
| Improve pass (10-27) | Done. Smart computers re-tuned (Smart vs Normal 59% → 81%), Mason + Prince roles. Shared kits copied unchanged: `_coach` (guided first game `js/wwcoach.js`, rules sheet in Settings → Learn), `_profile` (My stats pill on home, achievements, Daily game `js/wwprofile.js`), `_pwa` 1.2.0 (manifest, `sw.js`, icons), `_fx` re-copied. Undo vs computer (top bar; not in the Daily). Avatars on table plates (name-hashed). Laptop home is two columns (menu + card fan); phone setup fills the empty lower part with a live table preview + Daily item. Revealed dead card zooms to the centre on phones (`spotlight()` in game-fx; off with reduced motion / FX off). Tests 57/57, `tools/pwa-check.mjs` 18/18. |

## Edge pass scenarios (2026-10-20)
Full list with evidence: `scratchpad/edge/werewolf/scenarios.md` (manager session). Headless WebKit iPhone 393x659 unless noted.

| Family | Tested | Failed before → fixed |
|---|---|---|
| Rare rules | 12 | Bodyguard/Doctor with nobody to guard got stuck (now Done / Close eyes + "Nobody can be protected tonight."); a seat could take back another seat's claim |
| Odd people | 5 | an emoji name was cut in half at 14 characters |
| Odd taps | 10 | phone Back left the app (setup step 2, Settings, Rules); timer kept ticking on the menu; subtitle showed the Settings computer level, not the game's; "Your card" × did nothing |
| Odd devices | 14 | reload right after the Doctor chose got stuck; two tabs: the stale tab saved over the newer game; seats on top of each other at 320 px (8/10/12 players), 393 px (12) and 320 px x 20 (plates) |
| Odd screens | 5 | phone Hint button on a row of its own (now first button in the footer row) |

## Measured numbers
- Computers, village win % on 8 players (2 wolves, Seer, Doctor, 4 villagers), Ultimate rules, rows = village level, columns = wolves level:

  | Village | Easy wolves | Normal wolves | Smart wolves |
  |---|---|---|---|
  | Easy | 15% | 6% | 6% |
  | Normal | 57% | 47% | 27% |
  | Smart | 56% | 48% | 46% |

- Setups (Ultimate, 8 players, village win): Simple 47.6%, Classic 55.8%, Full 43.3%, Rulebook 66.6%.
- Head to head (fair share, both sides, 3 setups × 1,000 games, 10-27): Normal vs Easy 76.7%, Smart vs Normal 80.8% (was 59.2%). My stats ratings from these: Easy 1200, Normal 1410, Smart 1660.

## Standing instructions (Tim's words, via the manager)
- "Voice narrator, role setups, each player's chance of being a wolf" — a real-table companion, no human moderator.
- "Base the style off of what I did with the other games" (Hub dark look, phone-first, odds layer, measured computers, study mode).
- "build regular play online with a computer or other online players for all the games and their common varients that match exactly the play of the in-person game"
- "make sure that everything works properlly without errors… get everything right like rules and artwork and specific numbers"
- $0, static GitHub Pages, no copyrighted art or rule text.
- (2026-10-20) "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered."

- (2026-10-20) "could you also make sure that each of the games also have a look to them so that the game (either board or card layout) looks almost identical to how the board or card layout looks like in real life, so it's easy to understand if you've already played it before, and also so it feels more like you're actually playing in real life rather than you're playing it online. Even things like how youre cards or other things are laid out infront of you, make it look like they are actual cards laid out similar to how it looks like in real life. Make the decks look like actual decks. Make the board have the same design as it does in real life with the same layouts. It should look kind of like you're looking through a camera that is connected to a user's glasses that is playing in real life (not actually, but the layout and style of everything should be similar)."
- (2026-10-21) "for a lot of the games the cards or board layout is too small to easily see what's going on. Some games just need small design imporvements like filling the screen with the board view and fitting the cards and other things in the empty space, some have severe errors like TTR. Fix this so the view of what's happening and where everything is is very clear. Consider parts of the board that are dense in what's happening and if the user can reasonably see it."
- (2026-10-20) "I've noticed the games often have good user interfaces but could be improved especially when a scenario happens that the game might've not really thought about or whatnot. Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird."

## Event → sound map (`js/game-fx.js`)
| Event | Sound | Animation |
|---|---|---|
| New game dealt | `shuffle` | — |
| Table deal: card tapped / your card shown (vs computer, online) | `cardFlip` | existing CSS flip |
| Table deal: phone passed on | `cardSlide` | next dot pops |
| Night falls | `nightFall` (custom: low wolf howl over wind) | moon pops |
| Day breaks | `dayBreak` (custom: rooster-ish chime + soft bell) | sun pops |
| Night death / vote-out / Hunter's shot | `stamp` (shot adds `hit`), 0.7 s after dawn | the tile shakes + red flash |
| Dead card shown face up | `cardFlip` just after the stamp | tile pops |
| Nobody voted out / tie | `miss` | — |
| Hunter fires into the air | `whoosh` | — |
| Seer claim entered | `pop` | the new claim pops |
| Ballot cast (seat games, each player) | `place` (yours full volume, others 0.7) | "Votes in" pops |
| Your own night pick (wolf / doctor / bodyguard / witch; table: wolf/doctor/bodyguard only) | `place` | — |
| Seer's answer (your seat, or the table phone) | `cardFlip` | result card pops; finding a wolf on your own phone = `big` sparkle |
| It becomes YOUR turn (seat games) | `turn` | footer / night actions pulse |
| Illegal tap / move refused / bad setup | `error` (with the toast) | — |
| Day timer last 10 s / time up | `tick` / `alarm` | — |
| Game over | celebrate `win` (table phone: winners' colours) or your own `win`/`lose` (seat games) | confetti in the winning side's colours |

## Traps
- **Kits re-copied 2026-10-27 (kitfix):** game-coach 1.1.0 wraps the rules tabs itself (the styles.css `.coach-rules .coach-rules-nav` override is now redundant but harmless) and keeps a note beside a tall target readable; game-pwa 1.3.0 (`data-extra`). Copies stay byte-identical to `../_coach` / `../_pwa`.
- **online.js cache stamp (2026-10-27):** `js/app.js` imports `./online.js?v=a3d0418b`, the `_online` content stamp. After a re-copy: put the new stamp from `node ../_online/tools/stamp.mjs` there, run `node tools/stamp.js` (bumps every `?v=` in index.html), then `node ../_online/tools/stamp.mjs --check .` must say OK.
- `js/online.js` is a shared file: never edit it here.
- The Firebase project `th-board-games` is shared by every game (Spark plan, about 15 long games a day in total). Solo play never touches the network.
- Online: the host's phone runs the game (and the computers). If the host vanishes, another online player takes over after about 75 s (module behaviour).
- Headless WebKit logs "…Firestore/Listen/channel … due to access control checks" when a page **reloads** mid-room. That's the SDK's long-poll being cut by the unload, not an app error.
- Firebase logs an "OAuth … domain not authorized" *warning* on localhost. Anonymous login still works.
- The deal screen's hidden step buttons stay in the DOM (`.step-hidden`). Drive scripts must click only visible elements (`offsetParent !== null`).
- After editing `js/` or CSS, run `node tools/stamp.js` or iPhones keep the old files.
- `js/fx.js` is shared: never edit it here; re-copy from `_fx/fx.js`. Game sounds live in `js/game-fx.js`. Night sounds must never give away a role: no potion sound at the table, the "found a wolf" sparkle only on the Seer's own phone, other players' night moves are silent.
- Headless WebKit runs only one animation frame while a phone-view `--eval` awaits, so confetti looks stuck in the corners there. Use `--engine chrome` for celebration screenshots.
- Double-tap guard: taps within `380 * FAST` ms of a screen change are ignored (19 ms in `?fast`). Test scripts must pause about 30 ms before each tap; to test the guard itself, run **without** `?fast` (QA script `scratchpad/qaL/t5-dbltap.mjs` with `WURL=http://localhost:8620/ TD=420`).
- **WebKit draws hidden back faces** (`backface-visibility` fails on these cards, worst under filters). Every card shows ONE face in the DOM at a time: `seatCard()` renders back-only, or front + `.ww-turn` for a fresh turn, and `turnCard()` swaps faces at edge-on (with a timer fallback so no card is left edge-on). The deal `.flip` renders only the back when closed and only the front when open; the click handler swaps at 110 ms.
- `css/table.css` and `js/table.js` are shared: never edit them here; re-copy from `_table/`.
- Seat positions are set in JS after every render (`afterDraw()` → `layoutTables()`, also on resize). Selectors `.pbtn[data-id]`, `.pane .pbtn`, `.flip`, `.odds` are kept for drive/QA scripts and game-fx.
- Headless WebKit with confetti can delay the card-turn timers by over 1.5 s; screenshot game over after ~3.5 s.
- Phone Back: `syncHistory()` (called from the render wrapper) keeps browser history as deep as `screenDepth()`; `popstate` closes the sheet / steps back. `ui.popSkip` stops our own `history.go()` from being handled twice. New screens or sheets must fit `screenDepth()`.
- A `storage` event from another tab reloads `S`; a stale tab in a game goes to the menu with a toast, so two tabs never overwrite each other.
- `layoutTables()` → `fitTable()` binary-searches a scale for each card style (s-l, s-m, s-s) and keeps the biggest card where `seatClashes()` is 0 (cards, plates, odds, labels, odds bars) and the middle passes its tier (no scroll; if that leaves cards < 40 px, scrolling in a middle ≥ 42% of the table wins when it gives 1.3× bigger cards; last, the middle is ignored). A smaller style only wins while the bigger style's card is < 56 px (so laptops keep labels under the cards). A card mid-animation (3-D turn) is measured at its resting box, or the turn would shrink the table for good. It sets `--cw/--sw/--pf/--of/--sf` on `.ww-table.fit`. About 2–35 ms per layout. `fitMemo` keeps the size when only the table height changes by < 48 px (footer wrap), so nothing resizes under the finger. `placeSeats()` clamps each seat by its widest label (role labels wider than the card). `window.__ww.fit` exposes `layoutTables/applyFit/seatClashes` for debugging.
- Names are cut with `cut14()` (never splits an emoji).
- Kit files `js/coach.js`, `css/coach.css`, `js/profile.js`, `css/profile.css`, `js/pwa.js`, `sw.js`, `tools/make-icons.mjs`, `tools/pwa-check.mjs` are shared: never edit here, re-copy from `_coach/_profile/_pwa`. `tools/stamp.js` also rewrites `data-version=` on the pwa.js tag.
- `PWA.safeToReload` (app.js) says no during a live cpu/table/online game, an open sheet/overlay or a focused input. A My stats result is recorded once per game (`S.cpuMeta.recorded`); leaving a cpu game after your first move records a loss (`abandonCpu`); the guided game (`cpuMeta.tutorial`) never records.
- pwa-check play script must retry the Vote click (computer ballots re-render the footer and the tap guard drops the click).
- Until 10-20 the `?fast` regex held a stray backspace character (from a Python patch with `\b` in a normal string), so `?fast` silently ran at full speed. Write regexes in patch scripts with raw strings.

## Decisions
- Online night: the moderator's steps (start, empty night steps, morning, dusk → night) run instantly inside the adapter's `apply`, so `toAct` is never empty. The table-mode random "fake wait" for dead roles is not used online.
- The online snapshot's `toAct` technically shows who is acting at night (devtools only). The UI never shows it. The same class of risk as "the host's browser holds full state", which the shared module already accepts.
- Wolves' hint shows what the *table* believes (public odds), not the truth they know.
- Hint, vote record and day timer are plain versions (toast, table, chip); Tim may restyle.
- Edge pass (builder's picks, Tim may change): Hint is the first button in the day footer; "Nobody can be protected tonight." wording; last wolf and last villager dying the same night = village wins (no rulebook covers it); crowded small screens get smaller cards automatically; the "Your card" × closes it; "This game moved on in another tab." toast.
- Visibility pass (builder's picks, Tim may change): landscape phone puts the stat line and buttons in a 176 px right column (four buttons two by two); the middle of the table may shrink to half the table's width so cards can grow; 320 px with 20 players keeps 18 px cards to hold 10 px names (was 20 px cards with 9 px names).
- Improve pass (builder's picks, Tim may change): Prince is protected from every vote-out (not only the first); Mason/Prince keep their names in the Mafia theme; avatars are picked from your name (no picker); laptop home card fan; Daily = 8 players, 2 wolves + Seer + Doctor + Hunter + 3 villagers vs Normal, wording "Same deal for everyone today"; tutorial wording; Normal left beatable on purpose so the balance numbers stay valid.
- Table look (builder's picks, Tim may change): dark wood in both themes; a top-down view (cards upright, not rotated to face each seat) for readability; rounded-rectangle seating; deck top-left on the deal screen; 13+ players at game over show the role without "· dead" (the struck-through plate shows it).

## NOT verified
- Real iPhone speech voice and quality (headless runs have no speech engine). Narration timing was verified only in `?fast` mode.
- Online with three or more humans, and host takeover after the host disappears. Both are covered by the shared module's own tests, not by Werewolf tests.
- Day timer spoken warnings: built, but only checked as code, not listened to.
- Design pass: the game-over screen on laptop was not re-shot (`screens.mjs` step 13 shows Day 1 on laptop, a script quirk). A hint toast can linger for 2.4 s onto the next screen (left as is; a fix would change behaviour).

- Sound & effects: no sound was heard (headless has no Web Audio on Windows WebKit); sounds checked by spying on `FX.play` during full drives. Real iPhone sound, silent switch and speech + sound together not checked. Online sounds checked only by code path (the same `render()` diff), not in a two-browser run. Storage-blocked behaviour relies on fx.js's own tests.

- Table look: not checked on a real iPhone or in a live online two-browser game (online unit tests pass; seat screens share `ring()`). Landscape centre text scrolls. The vs-computer "Your card" is still the existing sheet. (320 px plates and the Hint row were fixed in the edge pass.)

- Edge pass: real iPhone back-swipe, a game left in the background for 10+ minutes, and an online two-browser run of the new Back / two-tab code were not checked. At 320 px the day stat line ("Wolf odds …") still wraps to two lines (text, not a button).

- Visibility pass: not on a real iPhone; online two-browser not re-run (seat screens share `ring()`, checked through vs computer). At 320 px with 20 players short names are still cut ("Ros…") and cards are 18 px; the corner seats are what clash first. No pinch zoom was added. Landscape side column has empty space between the stat lines and the buttons. Once (1 of 4 capture runs, 1280 px, game over → Home) headless WebKit left the app to the previous page (`__ww` gone): looks like the Back/history code going one step too far; not reproduced, not checked on the old build, not touched by this pass.

- Improve pass: Add to Home Screen / offline on a real iPhone; pwa-check was not first run against the unfixed build. At 320×568 the home moon is clipped at the top, and on laptop the roles column keeps an empty band under Custom (both from before this pass).

## Authorized next steps
- None pending from Tim. Possible: Sheriff and extra roles (parked in ideas.md #16).

## Rejected / parked
- ~~Fake-claim-rate slider~~: another knob; the weight is explained behind the ?.
- ~~Live "village win chance from here"~~: too slow on a phone, shaky to explain.
- ~~Seat-position heatmap~~: no seating in the app.
- Parked: Sheriff, Cupid, Thief and other extra roles; UW tie variants (see rules-check "Not built").
