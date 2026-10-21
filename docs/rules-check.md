# Rules check — Werewolf / Mafia

Every rule the app enforces, with where it was checked (research run 2026-10-19). "Two sources" means two independent pages agreed. Rules that differ between versions are **switches in Settings** and are grouped into three rule sets (`RULESETS` in `js/engine.js`). Tests in `tests/engine.test.js` assert each one.

Werewolf has no single official rulebook. The app follows three published versions:
- **Ultimate Werewolf** (Bezier Games): [RulesPal rulebook](https://rulespal.com/ultimate-werewolf/rulebook), [Whitebox rulebook](https://rulespal.com/ultimate-werewolf-whitebox-edition/rulebook), [Ultimate Edition summary](https://board-game-rules.com/boardgames/ultimate-werewolf-ultimate-edition/)
- **The Werewolves of Millers Hollow** (Asmodee/Zygomatic): [rulebook PDF](https://www.world-of-board-games.com.sg/docs/Werewolves-Millers-Hollow.pdf), [RulesPal](https://rulespal.com/the-werewolves-of-millers-hollow/rulebook), [Board Game Arena roles](https://en.doc.boardgamearena.com/Characters_in_%22The_Werewolves_of_Miller's_Hollow%22)
- **Mafia** (Davidoff's original and its folk versions): [Wikipedia](https://en.wikipedia.org/wiki/Mafia_(party_game)), [variants page](https://fringe.davesource.com/Fringe/Entertainment/Games/Indoors/Mafia/v23.htm)

## Flow

| Rule | Ultimate | Millers Hollow | Mafia | Sources | Status |
|---|---|---|---|---|---|
| Game opens with | night | night | day (`dayFirst`) | UW + MH rulebooks; Wikipedia | checked (2 sources each for UW/MH). Mafia "day first" is common practice; Davidoff's night 1 is a mafia-only meeting, which is the same thing in effect |
| Wolves kill on night 1 | no, they only meet (`firstNightKill` off) | yes | n/a (day first) | UW rulebook; MH rulebook PDF | checked |
| Night order (app) | Seer → Doctor → Bodyguard → Wolves → Witch | same | same | MH: Fortune Teller → Wolves → Witch (PDF). UW Ultimate Edition: Bodyguard → Wolves → Witch → Seer | **App order differs from UW's call order** (Seer first). All night actions resolve together at dawn, so order changes nothing except narration. |
| Dead roles still called at night | yes | yes | yes | standard moderator practice | our choice (keeps deaths secret) |
| Card shown on death (`reveal`) | yes | yes | yes | UW (default + no-reveal variant), MH PDF | checked; "no reveal" is a switch |
| Tied vote | nobody out | nobody out | nobody out | MH PDF ("no one is eliminated"); UW needs a majority | checked |
| Village wins | all wolves dead | all wolves dead | all mafia dead | all sources | checked |
| Wolves win (`win`) | wolves ≥ others ("can't be outvoted") | every villager dead | mafia ≥ others | UW rulebook; MH PDF; Wikipedia | checked — a real difference, so it's a switch |

## Rare moments (edge pass 2026-10-20, tests in `tests/edge.test.js`)

| Moment | Rule in the app | Source | Status |
|---|---|---|---|
| The last wolf and the last villager die the same night (wolf kill + Witch poison) | Village wins: the village's goal (every wolf dead) is met, and the wolves' goal is checked second | No rulebook covers it (MH and UW only state each side's goal) | **app choice**, flagged for Tim |
| Everyone skips the vote, or skips tie the top player | Nobody goes out | Same as "tied vote" above | checked |
| Voting out the Hunter brings the wolves to equal numbers | The Hunter shoots first; the game is decided after the shot | MH PDF ("immediately"), UW summary | checked |
| Doctor / Bodyguard with nobody they may guard (only someone they guarded last night is left) | They wake, guard nobody, and close their eyes | Follows from the "not two nights running" rule | checked |
| A seat taking back a claim (seats mode) | Only your own claim | — (app rule; online already refused it) | checked |

## Roles

| Role | Rule in the app | Sources | Status |
|---|---|---|---|
| Werewolf / Mafia | Wolves wake together, see each other, agree on one living non-wolf. | all | checked |
| Seer / Detective (`seerSees`) | UW and Mafia: learns *wolf or not*. MH: sees the exact card. | UW rulebook (thumbs up/down); MH PDF (Fortune Teller sees the card) | checked |
| Doctor | Guards one player from the wolf attack. May guard self (`doctorSelf`, on). Not the same player two nights running (`guardRepeat`, off), except under Mafia rules where repeats are allowed. | Not in UW core; Mafia's Doctor has no standard rules (Wikipedia) | **⚠ no official source**. Rules copied from the Bodyguard limits and made switches |
| Bodyguard | Guards one *other* player. Not the same player two nights running. | UW rulebook + Ultimate Edition summary | checked (2 sources). MH's Savior may guard self (French fan sources only) — not modelled separately |
| Witch | Sees the wolves' target. One heal and one poison per game. May heal herself (`witchSelfHeal`, on), may use both in one night (`witchBoth`, on). Poison can't be blocked by guards. | MH PDF + Board Game Arena | checked. **Not built:** UW's rule that she stops being shown the victim once she has used a power |
| Hunter | When killed (night or vote), shoots one player right away; may fire into the air. The game isn't decided until the shot. | MH PDF, BGA, UW summary | checked |
| Villager | No power. | all | checked |

## Numbers

| Number | Value | Source | Status |
|---|---|---|---|
| MH wolves by players | 8–11: 2 · 12–17: 3 · 18: 4 | MH rulebook PDF | checked (test asserts) |
| UW first game wolves | 6–8: 1 · 9–11: 2 · 12–15: 3 | UW rulebook | checked (test asserts) |
| Mafia wolves | about a third | Davidoff via Wikipedia | checked. (The "one quarter" habit has no source.) |
| UW points | Werewolf −6, Seer +7, Bodyguard +3, Witch +4, Hunter +3, Villager +1 | board-game-rules.com + [BGG thread](https://boardgamegeek.com/thread/879524/ultimate-werewolf-role-values) | checked (2 sources). Doctor +3 comes from the German "Werwölfe" Healer card, a different publisher; that rulebook also gives the Witch +5 |

## Not built (variants found but left out)
- Millers Hollow **Sheriff** (elected, vote counts double, names a successor). Its tie rules are fan house rules.
- UW tie variants **Secret Ballot** (all tied players die) and **German Style** (revote between tied players).
- UW "reveal team only" and "reveal wolf/villager only".
- Extra roles: Cupid/Lovers, Thief, Little Girl, Mason, Lycan, Minion, Tanner, Apprentice Seer, Priest, Scapegoat.
- Witch "stops seeing the victim after using a power" (UW).
