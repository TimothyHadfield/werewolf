# Werewolf / Mafia — session log

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
