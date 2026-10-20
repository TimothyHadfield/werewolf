# Werewolf / Mafia — session log

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
