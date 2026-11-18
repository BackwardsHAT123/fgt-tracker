# NOTES-LOG

Dated history for FGT Tracker. Split off from the working notes on 2026-11-18. Append new dated entries at the END of this file; do not add them to CLAUDE.md. Grep it before re-fixing something.

## 2026-11-09 to 2026-11-15: build

- Built the entry page, Apps Script endpoint and Pages deploy. Public repo `fgt-tracker`; rules `.docx` kept out of the repo by Tom's choice.
- Tom: "LIV is now dead as of last week, so remove/ignore any of those rules", then "there will be no bump or other special rules for LIV players."
- Tom: "when i ask for changes in this project, just go ahead and commit and push them if you finish the task successfully. if you have errors let me know".
- Tom said to lock final point values when he tells me.
- Features: points counter with 25 cap, under-25 warning dialog, accent-insensitive search, write-in 1-pointers, honeypot, Venmo confirmation page, logo/favicon, TAH styling (design system v12 published with Chip, Input, Alert additions), Danny Willett hover popup (three lines, "Masters Champion" underlined; `tips` map in `players.js`, `_underscores_` underline, `\n` breaks). Final Willett commit: 806a3cb.
- Duplicate lineups: server rejects with `duplicate:true` (commit 67633b1); page shows "That lineup is already taken" and returns to the picker with picks kept. "Duplicate Of Row" column is now always blank.
- Apps Script URL deployed with access "Anyone"; GET returns `{"ok":true,"message":"FGT entry endpoint is running."}`.
- Tom said "team entry looks good."

## 2026-11-16: points updated after the Austin Championship

- Tom said the Austin Championship finished Monday after a weather delay. Pulled the FedExCup Fall page (projected ranks) and rebuilt tiers, commit a9372ab, still provisional.
- Moves: Max Homa 3 to 4, Jordan Smith 3 to 4, Doug Ghim 4 to 3, Harry Hall 4 to 3, Chad Ramey 1 to 3, Stephan Jaeger 3 to 2, Trace Crowe 1 to 2, Billy Horschel 2 to 1, Chandler Phillips 2 to 1. Rasmus Hojgaard moved from featured to `more`.
- Checked data only (267 golfers, no duplicates, section sizes unchanged); jsdom tests were gone, not rerun.
- Earlier I wrongly told Tom the Austin event might not exist; a search showed Fox Sports listing "Austin Championship, Nov 12, 2026" and the Fall standings confirmed it. The RSM Classic is Nov 19-22.

## 2026-11-18: switched to short CLAUDE.md plus this log

- Created CLAUDE.md and NOTES-LOG.md at Tom's request after "slim the context". There was no CLAUDE.md before, so nothing was moved.

## 2026-11-18: Sheet expansion (Golfers, Tournaments, Lineups, Standings)

- Tom's sheet is "2027 FGT". The Drive connector (connected via /mcp) could not find it by id or by title search, so nothing was read from it. The script is bound to the Sheet, so it creates the tabs itself.
- `Code.gs`: new Entry ID column (M) on Entries; each submission also appends to Lineups (one row per golfer, Fantasy Points = SUMIF over Tournaments) and Standings (rank, team, name, points used, fantasy points). Extra-tab writes are in try/catch so an entry is never lost. Added `onOpen` menu FGT > Set up tabs / Refresh Golfers tab / Rebuild Lineups and Standings.
- `tools/build-golfers.js` generates `apps-script/Golfers.gs` (267 golfers, version provisional).
- Tournaments columns: Tournament, Date, Golfer, Finish, Position, Score To Par, Earnings, Fantasy Points. Fantasy scoring rules are NOT defined in the repo; Fantasy Points is entered by hand until Tom gives the scoring rules.
- Not tested in Apps Script itself (syntax checked in node only). Tom must paste both files, redeploy a New version, then run FGT > Set up tabs.

## 2026-11-18 (later): scoring is prize money

- Tom: scoring is total money. The team with the most earnings in an event wins that event, winner take all. Two events the same weekend are separate events (each team has earnings from each). Separate season-long money list pays the top ~17-18% of teams.
- Replaced the earlier "fantasy points" idea. Tournaments is now Tournament, Date, Golfer, Finish, Earnings (one row per golfer per event, one Tournament name per event). New EventScores tab (Tournament, Entry ID, Team, Earnings, Event Rank, Event Win) built by FGT > Update event scores. Standings now has Season Earnings, Event Wins, Paid Spot. Settings tab holds the payout share (default 17.5%, paid spots = ROUND(teams x share)).
- Open: tie handling for an event win (tied teams both show Event Win = 1); exact payout count rule; payout amounts. Not tested in Apps Script, formulas only syntax-reviewed.

## 2026-11-18 (later still): migration for the first Sheet version

- Tom had already pasted the first Code.gs and run Set up tabs, so tabs existed with old headers. `setupSheets` now calls `fixHeaders_()` to rewrite each extra tab's header row (skips Tournaments if it already holds results). Tom must paste the new Code.gs, redeploy, and run Set up tabs again.

## 2026-11-18 (end of day): paid spots are set by hand

- Tom: the number of paid season teams will be decided once the total teams entered is known. Settings B2 is now "Season paid spots", blank until Tom types a number; Paid Spot in Standings shows nothing until then. Settings also shows Teams entered and a 17.5% reference figure. Replaces the percent-based rule.

## 2026-11-18 (evening): ties split the weekly pot

- Tom: if two teams tie in an event, they split that event's pot. EventScores column renamed "Pot Share" (1 for an outright winner, 1/n for n tied at the top, 0 if top earnings are $0). Standings "Event Wins" is the sum, so it can be fractional (0.5). Rebuild by pasting Code.gs, redeploying, running Set up tabs.

## 2026-11-18 (night): results come from me, not by hand

- Tom: he will not type results. After each week finishes (usually Sunday evening) I scrape prize money from pgatour.com/leaderboard (Past Results) in Chrome and push it to the Sheet. The Drive connector is read-only, so the route is the Apps Script web app: `Code.gs` `saveResults_` (action `results`) checks a token in the Script Property `RESULTS_TOKEN`, replaces that tournament's rows in Tournaments, then rebuilds EventScores. Sender: `tools/post-results.js` (env `FGT_RESULTS_TOKEN`, JSON file of {tournament, date, rows[{golfer, finish, earnings}]}). The token is never committed.
- Same-weekend events: scrape and post each leaderboard separately under its own tournament name.
- Names match to the Golfers/Lineups spelling ignoring case, accents and punctuation. Response lists unmatched golfers with money. Logic tested with stubs in node only; not run in Apps Script, and no real pgatour.com scrape done yet.
- Open: Tom must create the token, paste Code.gs, redeploy. I only run when Tom has a session open and asks (or a schedule is set up).

## 2026-11-18 (late): EventScores showed $0, fixed

- First real run (Austin Championship posted via the results feed): Tournaments, Lineups and Standings Season Earnings were right, but EventScores Earnings was $0 for both demo teams. Cause not confirmed in Sheets; most likely the SUMPRODUCT(SUMIFS(..., array criteria)) formula does not expand without ARRAYFORMULA. `refreshEventScores` now computes each team's earnings per event in the script (accent/case-insensitive name match) and writes numbers; Event Rank and Pot Share remain formulas. Checked with stub data in node only. Consequence: EventScores earnings update only when the results feed or FGT > Update event scores runs.
