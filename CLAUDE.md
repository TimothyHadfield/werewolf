# Werewolf / Mafia — project rules

Live: https://timothyhadfield.github.io/werewolf/ · Repo: https://github.com/TimothyHadfield/werewolf (public, GitHub Pages from `main` root).

Read `progress.md` first (START HERE). Tim's global rules (`~/.claude/CLAUDE.md`) and the Code Projects rules apply.

## How it's built
- Static site, no build step, $0. `index.html` loads plain scripts: `js/build.js`, `engine.js` (rules, UMD `window.WW`), `game-online.js` (adapter for the shared online module), `setups-data.js` (generated), `art.js`, `narrator.js`, `app.js` (UI). `js/online.js` is the shared ES module, loaded with `import()` only when online play opens.
- **Rules live only in `js/engine.js`**: `apply(state, action)` returns a new state, `view(state, seat)` hides secrets. The UI never changes rules.
- **`js/online.js` is copied unchanged** from `Board and Card Games/_online/online.js`. Never edit it here; re-copy when the shared one changes.
- Generated data: `node tools/build-setups.js ultimate|millers|mafia`, `node tools/measure-bots.js`, then `node tools/merge-setups.js` writes `js/setups-data.js`. It takes about 50 minutes for all three plus the bots (run in background).
- After any change to `js/` or `styles.css`: `node tools/stamp.js` (cache-buster for iPhone Safari), then commit.

## Verify
- `node tests/run.js` (all must pass; about 70 s). New test: see it fail on broken code first.
- Headless only: `node ~/.claude/tools/phone-view.mjs "http://localhost:<port>/?fast" ...`. `?fast` runs the narrator and computers 20× faster. `window.__ww` exposes `S()`, `ui`, `W`, `room()` for drive scripts.
- QA scripts in `tools/qa/` (run them from a scratch folder; they write PNGs to the current folder):
  - `screens.mjs [url]`: every screen at iPhone (WebKit) and 1280px, with overflow and console errors.
  - `drive-table.js` / `drive-cpu.js`: pass to phone-view `--eval` to play a full game; pipe the output to `summary.js`.
  - `layout-check.mjs [url] [webkit|chromium]`: 20 and 8 players at 393 / 320 / landscape / 1280, day and game over; fails on small cards, small text, overlapping seats, a squeezed or scrolling table. Run after any table layout change.
  - `online-two-browsers.mjs [url]`: two phones in one real room, a full game, a reload mid-game, then the room is closed.
