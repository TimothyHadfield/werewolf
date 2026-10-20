# Werewolf / Mafia — progress

## START HERE
Read order: this file → `CLAUDE.md` → `docs/rules-check.md` → `docs/ideas.md` → `chat.md` (latest entry).
Last updated: 2026-10-19 (night), by the Werewolf project lead (builder agent).

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

## Measured numbers
- Computers, village win % on 8 players (2 wolves, Seer, Doctor, 4 villagers), Ultimate rules, rows = village level, columns = wolves level:

  | Village | Easy wolves | Normal wolves | Smart wolves |
  |---|---|---|---|
  | Easy | 15% | 6% | 6% |
  | Normal | 57% | 47% | 27% |
  | Smart | 56% | 48% | 46% |

- Setups (Ultimate, 8 players, village win): Simple 47.6%, Classic 55.8%, Full 43.3%, Rulebook 66.6%.

## Standing instructions (Tim's words, via the manager)
- "Voice narrator, role setups, each player's chance of being a wolf" — a real-table companion, no human moderator.
- "Base the style off of what I did with the other games" (Hub dark look, phone-first, odds layer, measured computers, study mode).
- "build regular play online with a computer or other online players for all the games and their common varients that match exactly the play of the in-person game"
- "make sure that everything works properlly without errors… get everything right like rules and artwork and specific numbers"
- $0, static GitHub Pages, no copyrighted art or rule text.

## Traps
- `js/online.js` is a shared file: never edit it here.
- The Firebase project `th-board-games` is shared by every game (Spark plan, about 15 long games a day in total). Solo play never touches the network.
- Online: the host's phone runs the game (and the computers). If the host vanishes, another online player takes over after about 75 s (module behaviour).
- Headless WebKit logs "…Firestore/Listen/channel … due to access control checks" when a page **reloads** mid-room. That's the SDK's long-poll being cut by the unload, not an app error.
- Firebase logs an "OAuth … domain not authorized" *warning* on localhost. Anonymous login still works.
- The deal screen's hidden step buttons stay in the DOM (`.step-hidden`). Drive scripts must click only visible elements (`offsetParent !== null`).
- After editing `js/` or CSS, run `node tools/stamp.js` or iPhones keep the old files.

## Decisions
- Online night: the moderator's steps (start, empty night steps, morning, dusk → night) run instantly inside the adapter's `apply`, so `toAct` is never empty. The table-mode random "fake wait" for dead roles is not used online.
- The online snapshot's `toAct` technically shows who is acting at night (devtools only). The UI never shows it. The same class of risk as "the host's browser holds full state", which the shared module already accepts.
- Wolves' hint shows what the *table* believes (public odds), not the truth they know.
- Hint, vote record and day timer are plain versions (toast, table, chip); Tim may restyle.

## NOT verified
- Real iPhone speech voice and quality (headless runs have no speech engine). Narration timing was verified only in `?fast` mode.
- Online with three or more humans, and host takeover after the host disappears. Both are covered by the shared module's own tests, not by Werewolf tests.
- Day timer spoken warnings: built, but only checked as code, not listened to.

## Authorized next steps
- None pending from Tim. Possible: Sheriff and extra roles (parked in ideas.md #16).

## Rejected / parked
- ~~Fake-claim-rate slider~~: another knob; the weight is explained behind the ?.
- ~~Live "village win chance from here"~~: too slow on a phone, shaky to explain.
- ~~Seat-position heatmap~~: no seating in the app.
- Parked: Sheriff, Cupid, Thief and other extra roles; UW tie variants (see rules-check "Not built").
