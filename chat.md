# Werewolf / Mafia — session log

## 2026-10-21 → 10-27 — visibility pass (builder agents; paused 10-21, finished 10-27)
- **Asked** (Tim via manager): "Fix this so the view of what's happening and where everything is is very clear. Consider parts of the board that are dense in what's happening and if the user can reasonably see it." (full quote in progress.md)
- **Built** (`js/app.js`, `styles.css`): `layoutTables()` now grows the cards to the largest size where no two seats touch and nothing pokes off the table (each card style scaled smoothly, text floors 10 px names / 12 px odds); seats clamp by their widest label, so role labels no longer push the fit to the smallest card; the middle gets three tries (all news in view → scrolling only if roomy → seats alone); same seats keep the same size when the footer wraps. Landscape phone: table takes full height, stat line + buttons in a right column. New `tools/qa/layout-check.mjs`.
- **Verified**: layout check 22 failures on the old build, 0 on the new (WebKit and Chromium). `node tests/run.js` 46 passed. Before/after shots at 393, 320, 659×393, 1280, 1440 (manager scratchpad `vis/werewolf/`).
- **Open**: 320 px with 20 players stays tight (18 px cards, short names cut); see NOT verified.

## 2026-10-20 — edge pass (builder agent)
- **Asked** (Tim via manager): "making each game perfect especially in scenarios that the game doesn't expect or are a little weird" (full quote in progress.md); plus the known 320 px / 20-player plates and the phone Hint row.
- **Built**: re-copied `_table` kit 1.0.1 and `fx.js` (`.gitattributes` keeps them byte for byte); engine refuses unclaiming another seat's claim; app.js: no-target Doctor/Bodyguard Done, reload after a Doctor pick carries on, phone Back steps back inside the app, two-tab guard, timer stops on leaving, game's real computer level, emoji-safe name cut, Hint in the footer, seats auto-shrink until none overlap; 320 px `--sw` 48 px. Rare rules in `docs/rules-check.md`.
- **Verified**: `tests/edge.test.js` 9 (unclaim failed first); `node tests/run.js` 46 passed. 46 scenarios in headless WebKit (scripts + `scenarios.md` in the manager's scratchpad `edge/werewolf/`): 14 failed before, all pass after; random double-tap drives played to a winner with 0 errors.
- **Open**: see NOT verified (real iPhone back-swipe, long background, online two-browser of the new code).

## 2026-10-20 — table look (builder agent)
- **Asked** (Tim via manager): make each game look "almost identical to how the board or card layout looks like in real life … like you're looking through a camera that is connected to a user's glasses" (full quote in progress.md).
- **Built**: seats round a dark-wood table from your seat (`ring()`, `layoutTables()`, `afterDraw()` in app.js) for table day/night/ready/over, vs computer and online; real-ratio cards, 3-D turn when a card is shown; paper news/claim slips in the middle; role deck stack on the deal screen that thins and deals; shared `css/table.css` + `js/table.js` and `fx.js` 1.0.3 copied byte for byte. Research: `scratchpad/table/werewolf/real.md`.
- **Verified**: `node tests/run.js` 37 passed (before and after merge). `tools/qa/drive-table.js` + `drive-cpu.js` played to the end in WebKit iPhone, 0 errors. Shots at 393, 1280, 320 and 659×393 landscape: 0 console errors, no page overflow (`scratchpad/table/werewolf/after5/`). Two read-only reviewer rounds; fixed blank deal card, landscape stacking, cards left edge-on, clipped labels.
- **Open**: see NOT verified (real iPhone, live online run, 320 px with 20 players is tight).

## 2026-10-20 — sound & effects (builder agent)
- **Asked** (Tim via manager): "add opptional sounds … win celebrations, and other fun annimations … customizable in the settings".
- **Built**: `js/fx.js` (shared copy), `js/game-fx.js` (event → sound map in progress.md, custom `nightFall` howl and `dayBreak` chime), hook in `render()` that diffs game states for every mode, error sound on refused taps, timer tick/alarm, "Sound & effects" group in Settings (styled like the other rows in `styles.css`).
- **Verified**: `tests/fx.test.js` failed first (module missing), then 4 pass; `node tests/run.js` 37 passed. Full vs-computer and table drives in WebKit iPhone with `FX.play` spied: right sounds in order, 0 console errors, no overflow; confetti shots in Chrome (`scratchpad/design/werewolf-fx/`).
- **Open**: see NOT verified (real iPhone sound, online two-browser run).

## 2026-10-20 — visual design pass (builder agent)
- **Asked** (Tim via manager): "review them again for design improvements especially visually."
- **Built** (`styles.css`, 2 small `app.js` edits): laptop player grid 4 across at 84 px, centred night (hidden log column dropped at night), deal card sized by screen height, outlined disabled main buttons, 40 px Hint/?/claim-x taps, full-width online form, laptop setup shows one main button, bigger laptop chips/menu/table, darker dead cards on game over.
- **Verified**: `tools/qa/screens.mjs` before/after at iPhone (WebKit) and 1280 px, 0 console errors, no overflow; phone-view cpu night at 1440 px; `node tests/run.js` 33 passed on the merged main.
- **Open**: see NOT verified (laptop game-over shot, lingering toast).

## 2026-10-20 — QA agent's 9 fixes (project lead, builder agent)
- **Asked** (coordinator, forwarding the QA report): 20-player witch Done unreachable; computer fired a dead human's Hunter shot; double taps skipped Start the day / Vote out / Seer result; no Leave mid online game; damaged saves crashed; resume skipped your card; duplicate names accepted.
- **Built**: `.night` scrolls with sticky actions; `isBot` keeps your own Hunter shot; 380 ms tap guard after each screen change; Leave/Close room in Settings; `clean()` validates every saved field + render falls back home with a toast; resume shows your card; duplicate-name toast. Also found and fixed a stray backspace in the `?fast` regex (test mode ran at full speed).
- **Verified** (local, WebKit iPhone 15): QA scripts rerun. 20 players Done at y=647/659; dead Hunter waited 5 s, then the human shot; at real speed every double tap moved exactly one step and the game ended (0 errors); 10 damaged saves → home, 0 errors; resume card shown; "Sam"/"sam " blocked; online Settings → Leave room → home. 33 tests, both drives to a winner, screens phone + laptop 0 errors, two-browser online game finished.
- **Open**: none new.

## 2026-10-19 — first build (project lead, builder agent)
- **Asked** (via the games manager): build the Werewolf / Mafia companion: voice narrator, balanced role setups, each player's wolf chance, Secret Hitler-style app with a vote/day log. Phase 2: exact rules with variants and sources, online seats (shared `_online` module), an ideas brainstorm with the good ones built, polished original art, and a full QA pass.
- **Built**:
  - Engine with 3 rule sets and switches.
  - Exact wolf odds.
  - Easy/Normal/Smart computers, with a measured matrix.
  - Setup simulator: 10,000 games per setup, n = 5–16, × 3 rule sets.
  - Table game with narrator; vs computer; online rooms.
  - Setup lab; rules page; Settings.
  - Original SVG cards.
  - Ideas 8–11: odds "why" table, hint, vote record, day timer.
- **Bugs found by headless drives and fixed**:
  - "You was voted out" grammar.
  - The hint named a player when every player's odds were equal.
  - A wolf's hint said "0%" for everyone (it now shows the table's view).
  - Online computers were named "Computer 3".
  - Names were cut to "Play…" next to the odds on a phone.
  - A toast covered the vote buttons.
  - The lab caption overstated the game count.
- **Verified**:
  - `node tests/run.js`: 33 passed, including 4 online-adapter tests (each seen failing on a broken adapter) and 6 `createLocal` rooms played to the end.
  - Headless WebKit iPhone and 1280px: every screen, zero console errors, no overflow (`tools/qa/screens.mjs`).
  - Full table game and 5 vs-computer games played to the end (`tools/qa/drive-*.js`).
  - Two-browser online game on the real Firebase project, twice, with a reload and resume mid-game (`tools/qa/online-two-browsers.mjs`).
- **Open**: see progress.md NOT verified (real iPhone voice, 3+ humans online, host takeover).
