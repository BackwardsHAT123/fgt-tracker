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

## 2026-11-18 (night): 2027 schedule

- Scraped pgatour.com/schedule/2027 (season picker, 2027). 36 events, Jan 21-24 (The American Express) through the Tour Championship (Aug 26-29, 2027). **2027 purses are not posted yet** (page shows "-"); the dollar figure shown under each event is last year's winner share, not a purse. Fall 2027 events are not on the page yet.
- Added a Schedule tab (Event, Finish Date, Purse, Reference Purse 2026, Counts for FGT, Notes) and an `action:'schedule'` feed (same token, replaces the whole tab). `tools/post-results.js` sends a file with an `events` list as a schedule. Reference purses are the 2026 purse of the same event (renamed ones matched by course and defending winner: The Sentry = old Farmers, GO by Raymond James = old Wyndham, Myrtle Beach Classic). Sompo has no reference.
- Counts for FGT: Tour Championship = No, TBD (Additional Event, Feb 18-21) = TBD, others Yes. Same-weekend pairs (separate events): Genesis + TBD (Feb 21), Truist + Myrtle Beach (May 16), Scottish Open + ISCO (Jul 11), Open + Corales (Jul 18). Zurich Classic is a team event; prize money split per golfer needs checking.
- Re-run later when purses post: re-scrape, fill `purse`, resend the schedule JSON.
- Tournament names used in results should match the Schedule's event names (the Austin results used the long official name).

## 2026-11-18 (night): Zurich Classic rule

- Tom: for the Zurich Classic, pgatour.com reports each team's winnings and each golfer gets half of their team's earnings. Handled at scrape time (halve before sending), no code change. Schedule note for Zurich updated in the local JSON only; the Sheet's note updates the next time the schedule is resent (when purses post).

## 2026-11-18 (night): dashboard plan

- Tom wants a public web dashboard in this repo, using his Tableau Public dashboard as the template (option b: I build the page). Privacy rule from Tom: team names only, no user-identifiable info. The Standings tab's "Name" column must never go into the feed. Waiting on the dashboard link from Tom before designing anything.

## 2026-11-18 (night): dashboard, first slice

- Studied Tom's Tableau Public dashboard (2025FGTScoring / 2026FGTTracker): tabs 2026 FGT Tracker, Weekly Results, Leaderboard, Top 37, Team Performance, Winner List, How Many Times Picked?, Past Finishes, Duplicate Teams?, Lineup Analysis (221 teams in 2026, 36 events, top 37 paid). Decisions from Tom: drop "most teams from a single owner/group" and Duplicate Teams (the entry form rejects duplicates); hide lineups until all entries close; keep the Tableau look; build home page and leaderboard first.
- Built: `Code.gs` `doGet(?view=dashboard)` returns team name, earnings, ranks, schedule, results, golfers, and lineups only when closed (Settings B5 = Yes or DEADLINE passed). It never reads Entries and omits the Standings Name column and Entry IDs; checked with stub data. `site/dashboard.html` Tracker and Leaderboard tabs. Preview with `?demo=1` / `?demo=pre`.
- Tested only in jsdom (text and structure, no visual check, not in a real browser; the sandbox blocks a local server and Chrome blocks file:// URLs). Tom must check the look on his phone and desktop.
- Needed next for the remaining tabs: send every golfer in the field (cuts and withdrawals too) with each result so Team Performance (made the cut) and Past Finishes work. The Austin test only sent golfers who earned money.
- jsdom for tests lives in the scratchpad, not the repo.

## 2026-11-18 (night): dashboard column alignment

- Tom (looks OK) asked that the three Tracker columns line up so the first golfer in each starts at the same height. Each column is now header row (40px, picker beside the title) + a fixed 214px top block (card, plus trend line where used) + bar rows of a fixed 34px. Checked structure in jsdom only; Tom to confirm the alignment visually in a real browser.

## 2026-11-18 (night): points-level charts and footer

- Tom asked for the "What point level is the $ coming from?" charts under each Tracker column plus a footer bar ("Designed & maintained by Tom Hewett | Questions or errors? Let me know at FGT_MT@outlook.com", email taken from Tom's screenshot). Charts: stacked columns, x = point level 0-7, one segment per golfer, per column (leader season, weekly winner for the chosen event, selected team season). Hidden with the lineups until entries close. Demo lineup points are now random 1-6 so the chart has some shape. jsdom check only; Tom to eyeball.

- Point-level chart revised (Tom): every golfer segment is the same height (column height = number of golfers at that level), and colour depth shows money earned (darker = more, scaled per chart to its biggest earner, square-root scale so mid earners stay distinguishable; $0 golfers light grey). jsdom check only.

## 2026-11-18 (night): Weekly Results and Winner List tabs

- Added both to `site/dashboard.html` following Tom's Tableau tabs. Weekly Results: event picker, highlight-team search, teams ranked by that event's money (only teams that earned money show; Tableau also showed teams whose golfers all missed the cut, which needs cut rows in the results feed), click a team to see its golfers' earnings on the right (hidden until entries close). Winner List: numbered events with winning team(s), ties shown as "A & B (split)", and the amount. jsdom check only.
- Still to build: Top (paid) Teams pies, Team Performance, How Many Times Picked, Past Finishes, Lineup Analysis.

- Tom supplied a point-level palette (1 grey-green, 2 light blue, 3 teal, 4 magenta, 5 orange, 6 muted red; hex values estimated from his screenshot). Applied to the Weekly Results golfer bars, with a Points legend. The Tracker column bars stay in their column colour and the point-level charts stay money-shaded, since neither is coloured by point level.

- 2026-11-18: deploy of commit a1118ae failed with the known transient "No artifacts named github-pages" error. The push itself was fine (local and origin/main identical). Re-ran with `gh run rerun`; it succeeded. No code change.

- Tom sent the exact palette hex values (point levels 1-6: #adbcb6, #96d0ff, #57c8c6, #ff57ff, #fbb457, #c55657). Replaced my eyeballed estimates in `PT` in `site/dashboard.html` and in CLAUDE.md.
