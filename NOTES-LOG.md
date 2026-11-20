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

- Tom (looking at the live page): the palette colours are right but he expected more saturation. Added `SAT` = 1.35 in `site/dashboard.html`, which raises HSL saturation of his base hex values (levels 2 and 4 are already fully saturated, so they do not change; 1 barely changes because it is a grey). Tunable in one place.

- Tom confirmed the Tracker changes (column alignment, point-level charts, footer) look good on the live page.

## 2026-11-18 (night): How Many Times Picked? tab

- Added to `site/dashboard.html`: golfers ranked by how many teams picked them, in columns of 25 (#1-25, #26-50, ...), bar length by pick count and colour by point level (Tom's palette, with the saturation boost), a "Highlight golfer" search and the Points legend. Hidden until entries close, since pick counts reveal lineups. Tom confirmed the Tracker changes earlier. jsdom check only; Tom to eyeball.
- Still to build: Top (paid) Teams pies, Team Performance, Past Finishes, Lineup Analysis.

## 2026-11-18 (night): TAH design on the dashboard

- Tom asked for the TAH design on most of the dashboard (fonts, headings, buttons, etc.), keeping his point palette and the tracker's green/purple/blue, plus a light/dark toggle top right. Done in `site/dashboard.html` using the same tokens as `index.html`: Outfit, pill tabs (selected = green), pill toggle button, rounded inputs, hairline cards, no shadows, dark default with light via the toggle (choice saved in localStorage). The green/purple/blue and the money-shaded point-level chart have dark-mode variants (in dark, more money = more vivid; low = dim). Chart colours are set when drawn, so toggling redraws.
- Changed from the Tableau look: title no longer all caps, the selected team in Weekly Results is green instead of orange (TAH keeps orange for primary buttons only), footer is a hairline card. Backup of the pre-TAH page was kept in the scratchpad only.
- jsdom check of toggle and charts; look to be confirmed in a real browser.

- How Many Times Picked: golfer-name label background lowered from 78% to 35% surface colour so more of the point-level bar shows through (Tom).

## 2026-11-18 (night): Lineup Analysis tab

- Added: stat cards (Teams entered, Different golfers picked, Golfers picked only once; the "most teams from one owner" stat dropped per Tom), and "Ownership %" for the top 25 most-picked golfers: golfer cell in the point-level colour, picked / teams, and a heat bar (pale gold = fewer picks, deep red = most) with the percentage. Hidden until entries close. Shares a `pickCounts()` helper with How Many Times Picked. Demo lineups give a golfer random points per team, so the demo can show the same golfer at different levels; real data will not.
- Still to build: Top (paid) Teams pies, Team Performance, Past Finishes.

## 2026-11-18 (night): Top Teams (pies) tab

- Added "Top N Teams": one pie per paid team (rank, team, season money), slices = each golfer's share of the team's money, coloured by point level, hover shows golfer, money, points and share. Hidden until entries close. N = Settings B2; until Tom sets it, a placeholder of 17.5% of an assumed 215 teams (Tom: "assume 215 teams") = 38. Constants `ASSUMED_TEAMS`, `PAID_SHARE` in `site/dashboard.html`. The Leaderboard payout line still appears only once B2 is set.

- Demo expanded to 40 fake teams (Tom) with paid spots unset, so the Top Teams tab shows the 38-team placeholder. The demo Leaderboard no longer shows a payout line (that needs paid spots set).

- Payout line (Tom): the Leaderboard now shades the top N as paid and draws "Payout line: top N paid" after the Nth team, and Top Teams draws the same line after the last paid pie and shows the next 4 teams below it, faded, as "on the bubble". N comes from `paidCount()` (Settings B2, else the 38 placeholder), so both tabs show it now. Rows are shaded by position, not the Sheet's Paid Spot column.

- Top Teams (Tom): teams just outside the money now continue in the same grid to fill out the last row of pies (count depends on how many pies fit across; recalculated on resize; if the paid pies end exactly on a full row, a full extra row is shown). They are faded, and a vertical dashed green line sits before the first one (a horizontal dashed line if they start a new row). Replaced the full-width "payout line" divider. The 40-team demo only has 2 teams past 38, so it cannot fill a whole row.

- Tracker golfer popups (Tom): hovering (or tapping on a phone) a golfer's bar shows a popup. Left column: name, season earnings, points. Middle and right columns: the same plus the money at the event chosen in the Weekly Winner picker. One shared floating popup (`showTip`/`attachTip`), hidden on mouse-out, scroll, tapping elsewhere or redraw.
- Popup order changed (Tom): name, Points, Season earnings, then the selected-event money.

- Weekly Results golfer popup (Tom's Tableau template): name; "- is a N pointer and picked on N teams."; "- made $X this week, bringing the season total to $Y." (this week's money in green); then "<Team> earned a total of $Z this week." Template said "his total"; I wrote "the season total" to avoid assuming pronouns. Popups support bold/green text parts now; pick counts per golfer are in the model (`M.pickN`).
- Tom chose "bringing his total to" for the Weekly Results popup (PGA Tour only), matching his template.

- Top Teams pie slice popup (Tom's Tableau template): team name, "Team Total" (green), then Golfer / Points / Total Golfer Earnings for the hovered slice, then a table of all the team's golfers (points, season earnings bar in point colour), hovered golfer's row bold. The hovered slice gets a thick outline. Tap works on phones. `showTipNode` added for custom popup content.
- Fix (Tom): pie slice outline stayed after hovering. Cause: the slice was moved to the front on hover, which stops the browser firing the mouse-out event. The outline is now a separate copy drawn on top and removed on mouse-out, leaving the pie, scroll, tapping elsewhere, or hovering another slice.

## 2026-11-18 (night): Team Performance planning

- Tom sent page 1 of 2 of his Tableau Team Performance tab: header with team picker and a "Weekly Performance" button (page 2), ranking card, season total, weekly trend line, Total Earnings golfer bars, SG Total trend for a selected golfer, SG Long Game vs Short Game scatter (sized by earnings, quadrants ELITE / LONGKNOCKERS WHO CANT PUTT / SHORTKNOCKERS WHO CAN PUTT / BAD), Recent Performance table (last 10 events: finish, SG OTT/APP/ARG/PUTT/Total, plus Points, OWGR, DG Rank).
- Tom has a DataGolf subscription/API. Quadrant colours: blue Elite, orange Longknockers, grey Shortknockers, red Bad; earnings bars use them. Load 2026 season data too. Waiting for page 2 before building.
- DataGolf API (from datagolf.com/api-access, read 2026-11-18): host feeds.datagolf.com, `key=` query param, Scratch Plus membership, 45 requests/min shared (over = 5-minute suspension). Endpoints: `/preds/get-dg-rankings` (top 500, skill estimate + OWGR rank; confirm DG rank field on a live response), `/historical-raw-data/event-list` + `/historical-raw-data/rounds?tour=pga&event_id=<id|all>&year=<calendar year>` (round-level scoring, stats, SG; field names in datagolf.com/raw-data-notes, not yet read; event totals would be summed from rounds), `/historical-event-data/event-list` + `/events?tour=pga&event_id&year` (finishes, earnings, FedExCup points; 2025-2026). The page does not cover public display terms; see datagolf.com/terms-and-conditions (Tom to check).

## 2026-11-18 (night): real dashboard connected

- Tom pasted the latest Code.gs, redeployed a New version and ran Set up tabs. Live `?view=dashboard` feed checked: 2 teams, 64 Austin result rows, 36-event schedule, 267 golfers, lineups hidden (entries not closed), paid spots 0. Privacy scan of the response: no emails, no phone-like numbers, no Entry IDs; standings carry only rank, team, earnings, wins, paid.
- Real dashboard (no `?demo`) loads in Chrome with the two test teams. Fixed: trend lines were invisible with only one event (a line needs two points); now a dot shows.

## 2026-11-18 (night): full-field results script

- `tools/pull-results.js`: reads pgatour.com's past-results page data (`__NEXT_DATA__`: the `tournament` and `pastResults` queries) instead of copying page text. Writes every golfer (finish, earnings; cuts, W/D and amateurs at $0). Stops if the event is not COMPLETED or the past results are for another tournament id/season. `--name` sets the stored name, `--halve` for the Zurich Classic.
- Tested on the Austin Championship: 120 golfers, 64 with money, 50 cut, 5 W/D, winner Chad Ramey $1,080,000; money rows identical to the hand-built file except cents (pgatour.com data has e.g. $16,345.71 where the page showed $16,345). RSM Classic correctly refused (NOT_STARTED). Not yet used for a real post.

## 2026-11-18 (night): Team Performance tab

- Built from Tom's two Tableau screens. Shared header: "<Team> Performance", a Weekly Performance / Stats switch, team picker; cards for current ranking (#N of N) and season total (through N events); weekly earnings trend.
- Weekly view: "How many golfers were in each tournament... and how many made the cut?" (grey = in the field, orange = made the cut, "made / in" label, hover shows the event); "Weekly Ranking" chart of season rank after each event, the chosen team in orange with start/end rank, every other team in grey, green band for the payout spots.
- Stats view: Total Earnings golfer bars (grey until strokes gained groups exist) and a placeholder for the DataGolf panels (SG Total trend, Long vs Short Game, Recent Performance).
- Made-the-cut uses finishes in Tournaments: CUT, W/D, WD, DQ, DNS, MC count as missed. Needs full-field results (pull-results.js). Lineup parts hidden until entries close.
- Demo data now built from Austin's full field (`tools/make-demo-data.js /tmp/claude-501/fgt/austin-full.json`), so cuts appear.

## 2026-11-18 (night): Past Finishes tab

- Added: a grid of golfers (on the points list or picked, with at least one result), most season money first, columns Golfer / Points / Total Earnings then one column per event. Each finish cell is coloured purple by position (win darkest; 2-5, 6-10, 11-25, 26+ lighter), missed cut and WD grey. Hover shows event, finish, money and points (one listener for the whole grid). Highlight-golfer search. Sticky header and golfer column, scrolls inside its box. Not hidden before entries close (no lineup data). Demo now carries the real points list.

## 2026-11-19: Team Performance popups (Tom's templates)

- Earnings trend: hover an event for "N of the N golfers on <Team> who played in the <Event> made the cut and the team earned a total of $X" (before entries close: "At the <Event>, <Team> earned a total of $X", since cut counts need lineups). "the" is skipped when the event name already starts with "The".
- Made-the-cut columns: "made / in" (made in red), "golfers made the cut at the <Event>.", the team's money there in green, then the team's golfer table (points, season earnings bar in point colours). Table shared with the pie popup (`golferTable`).
- Weekly ranking chart: hover an event for team name, "Rank this week: N", "made $X at the <Event>, to bring total to $Y". Hover strips are per event for the chosen team.
- Weekly Ranking chart (Tom): every team's line now has the popup. Hovering finds the nearest event and the team line nearest the pointer (the chosen orange team wins near-ties), outlines that line, and shows its rank, money and running total. Replaced the per-event strips with one hover area (uses the SVG's screen transform).

## 2026-11-19: team picker gets its own address

- Tom: give the team picker its own page address and unfold the "More 1-pointers" list, in 4 columns so older players can scan it. Moved `site/index.html` to `site/team-picker.html` (git mv); the new `site/index.html` just forwards to it (meta refresh plus JS, keeping any query string), so old links and bookmarks still work.
- More list: open on load and stays open after searching; newspaper-style columns (4 desktop, 3 under 900px, 2 under 600px); alphabetical by last name (suffixes like Jr. ignored) on the page only, so `players.js` order is untouched. My idea, not asked for, to make names easier to find.
- jsdom check: list open, 123 names, sorted, search and picking still work. Weekly Ranking chart popups for every team line also confirmed live in Chrome.
- Tom confirmed the team picker (team-picker.html, open 1-pointer list in columns) looks good on his phone.

## 2026-11-19: custom domain fgt-mt.com

- Tom bought fgt-mt.com and fgt-mt.net at Cloudflare. He added the GitHub Pages DNS records for fgt-mt.com; they were first Proxied (orange), which returned Cloudflare's addresses, so he switched them to DNS only. Once Cloudflare's name servers and 1.1.1.1/8.8.8.8 all returned GitHub's addresses, I set the Pages custom domain with `gh api -X PUT repos/BackwardsHAT123/fgt-tracker/pages -f cname=fgt-mt.com`. GitHub approved the certificate within a minute (covers fgt-mt.com and www, expires 2027-02-17, auto-renews), and I set `https_enforced=true`.
- Checked: https://fgt-mt.com/team-picker.html and /dashboard.html load; www forwards to the bare domain; old github.io links 301 to fgt-mt.com. My Mac's DNS cache still held the earlier Cloudflare-proxy addresses for a few minutes (a 404 on the bare domain via a Cloudflare IP); asking GitHub's IP directly returned the forwarding page.
- Domain verification on GitHub (protects against takeover) shows "unverified"; optional, offered to Tom.
- fgt-mt.net: no records yet; Tom will add 2 proxied placeholder records and a redirect rule later.
- fgt-mt.net set up by Tom (proxied placeholder records + redirect rule). Tested: http/https, bare and www, all 301 to the same path on https://fgt-mt.com, query string kept.
- Public DNS for fgt-mt.com is correct (Cloudflare name servers and 1.1.1.1 return GitHub's addresses), but this Mac's local resolver still returned the old Cloudflare-proxy addresses after ~30 minutes, so the bare domain showed a Cloudflare 404 here. Local cache only; fix on a Mac with `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder` or by waiting.
- GitHub domain verification done: Tom added fgt-mt.com under his account's Settings > Pages, put the TXT record `_github-pages-challenge-BackwardsHAT123` in Cloudflare (seen on Cloudflare, 1.1.1.1 and 8.8.8.8), clicked Verify. The Pages API now reports `protected_domain_state: verified`. The bare domain also loads (200) from this Mac now that its cache cleared.

## 2026-11-19: landing page

- Tom asked for a main landing page on fgt-mt.com with the FGT logo and two large buttons, Team Picker and 2027 Tracker. `site/index.html` (which had been a redirect to team-picker.html) is now that page: TAH style, logo, title and deadline from `config.js`, Team Picker as the orange primary button, 2027 Tracker as the outlined secondary, contact email in the footer, follows the dashboard's saved light/dark choice. `site/logo-480.jpg` (46 KB) made from the 1024px original with Pillow; the original stays out of the repo.
- Side effect: the bare domain no longer jumps straight to the team picker; people land here first.
- Tom: landing page looks fine on his phone. The dashboard needs phone work; Tom wants to wait on that for now (open item).

## 2026-11-19: faster dashboard loading

- Tom: dashboard pages load too slowly. Measured: the page files arrive in ~0.3 s, but the live Apps Script feed takes 2.4-3.9 s (almost all of it before the first byte, i.e. Google spinning up the script), and it will grow with a full season.
- Fix: the page now shows data in three steps, each replacing the last only if the data changed (compared without the `generated` time): (1) the copy saved in this browser from the last visit, (2) `site/data/dashboard.json`, a snapshot published with the site (fast, from GitHub's servers), (3) the live feed, saved for next time. The error banner appears only if both the snapshot and the live feed fail. `start()` can now run more than once (banners cleared each time).
- New `tools/snapshot-dashboard.js` writes the snapshot from the live feed and refuses to write if it sees anything like an email, phone number or Entry ID. Added to the weekly routine. First snapshot: 3 teams, 1 event, lineups hidden, 22 KB.
- Tested in jsdom: snapshot shows first, a changed live feed replaces it, an unchanged one does not redraw, no snapshot falls back to live, both failing shows the error. No Code.gs change, so no redeploy.

## 2026-11-20: my team, schedule, prizes, emails, automation, theme

- Tom picked suggestions 1 and 3-6 (not 2, shareable links). Rules for weekly prizes from his rules sheet: $150 regular, $200 Players and Signature Events, $300 Majors winner plus $100 for 2nd; season payout to the top ~17% (exact number later; no season dollar amounts yet).
- 1 My team: picker under the dashboard tabs, saved per device; default team on Tracker (Your Team), Weekly Results, Team Performance; outlined blue on Leaderboard, Weekly Results list and Top Teams.
- 3 Schedule: new Schedule tab (dates as Thu-Sun ranges, type badge and prize, purse or TBA, status Won by / Next up / Upcoming / Not part of the FGT / to be announced); "Next up" line on the Tracker and the home page (from the snapshot).
- 4 Automation: `tools/weekly-update.js` + `.github/workflows/weekly-results.yml` (cron Sun evening twice, Mon morning, Mon evening). Uses pgatour.com's season schedule data (tournament ids and status) and the past-results page (slug not needed: `/tournaments/<season>/event/<id>/past-results`). Shared code moved to `tools/fgt-lib.js`. Dry run against a test schedule: Austin pulled, fake name flagged, unfinished RSM skipped.
- 5 Prizes: Code.gs computes a Prize per team per event (EventScores col G) from the Schedule tab's new Type column; Standings col J Weekly Winnings. Ties share the prizes for the places they occupy (tested: two tied at a Major split $400; tie for 2nd splits $100). Dashboard computes the same if the feed is older. Playoff events typed regular pending Tom.
- 6 Confirmation email (MailApp, from the script owner's account, reply-to FGT_MT@outlook.com; never fails the entry) and a Paid checkbox column (Entries N, private). Menu item to send a test email to the owner.
- Theme (Tom): light by default, following the device's light/dark setting; the toggle's saved choice wins. Applied to home, team picker (which now has the toggle too) and dashboard.
- Tom declined showing point numbers on bars/slices (#11 part).
- `data/schedule-2027.json` now in the repo with event types; it is the schedule source for the automation.
- Needs from Tom: paste Code.gs + redeploy (new Gmail permission prompt), run Set up tabs, set the repo secret, resend the schedule.
- Higher-paying events (Tom): Schedule rows, the Next up line (Tracker and home page) and the Weekly Results header now carry an amber "★ Higher payout" flag for Majors, The Players and Signature Events, and the Schedule note explains the higher amounts. The live site showed every event as $150 because the Sheet's Schedule tab has no Type until Code.gs is redeployed and the schedule resent; the page now works the type out from the event name when the Sheet has none (13 events flagged), so it is right either way.
- Tom redeployed Code.gs and resent the schedule (36 stored). Live feed now has schedule types (8 signature, 1 players, 4 major, 23 regular incl. TBD and Tour Championship), EventScores prizes and Standings weekly winnings (test team "ramey won?" $150 for Austin). Snapshot refreshed. GitHub secret FGT_RESULTS_TOKEN not set yet (gh secret list empty).
- GitHub secret FGT_RESULTS_TOKEN: first set via `!` saved an empty value (no prompt without a terminal); added a `--check` option to weekly-update.js and a "check" input to the workflow (resends the schedule file, changes no results). Tom re-set it with `--body`; the check run passed ("the Sheet accepted the schedule (36 events)"). Weekly job is ready. The token equals the Apps Script Script property RESULTS_TOKEN; if one changes, change the other.

## 2026-11-20: playoff prizes, test email, entry timing

- Tom: the test confirmation email looks good (Gmail permission approved).
- Tom: FedEx St. Jude and BMW pay $200. Added event type `playoff` ($200, badge "Playoffs", Higher payout flag) to Code.gs, dashboard, home page and `data/schedule-2027.json`. The dashboard falls back to its own prize list if the Sheet does not know a type yet. Needs a Code.gs redeploy, then the schedule resent (done through the weekly job's check run, which resends the repo's schedule file).
- Tom: season payout amounts come later; the paid-team count and dollars are set once entries are final, around the middle of the first event, because latecomers always enter on the Thursday it starts. Recorded in CLAUDE.md (deadline will be mid-event).
- Tom redeployed Code.gs (playoff type). Schedule resent through the weekly job's check run; live feed shows 2 playoff events and `playoff: [200]`.
- Tom sent the 2026 year-end payout table (37 places, $14,950). New Payouts tab in the Sheet, filled with it by Set up tabs; Settings B6 "Payouts final" switch; feed sends `payouts` and `payoutsFinal`. Dashboard: placeholder paid-spot count is now the table length (37) instead of 215 x 17.5% = 38, and Leaderboard, Top Teams, Your Team and Team Performance show "in line for $X if the season ended today" (ties share the places they occupy), labelled as 2026 amounts until B6 = Yes. Needs one more Code.gs redeploy and Set up tabs.
- Tom: the higher-payout flag is now just the amber star (★), with "Higher payout" as its hover text and screen-reader label; the Schedule note says "★ Starred events pay more: ...".
- Schedule tab: the star now has its own column between the event number and the event name (Tom). On phones the type, purse and status wrap under the event name.
- Tom redeployed and ran Set up tabs. Live feed: payouts 37 places, $14,950 ($1,500 to $100), payoutsFinal false, paidSpots 0 (so the dashboard uses 37). Snapshot refreshed.

## 2026-11-20: site polish (Tom: "do them")

- Shared header (`site/sitebar.js`, `site/sitebar.css`) on home, team picker and dashboard: logo linking home, Team Picker and 2027 Tracker (current page highlighted green), one light/dark toggle (replaces the per-page toggles; the dashboard redraws charts on the `fgt-theme-change` event).
- Link previews: og/twitter tags with per-page titles and descriptions, image `site/og-image.jpg` (logo, "2027 PGA Fantasy Golf Tour", "Pick your team", "Follow the 2027 season", fgt-mt.com).
- Grouped dashboard tabs: group pills (Season, Weekly, Teams, Golfers) and a second row of tabs inside the group (remembers the last tab per group; Teams has one tab, so no second row). Nav styles now scoped to `#nav` so they don't touch the header.
- Phones: rows in Leaderboard/Weekly Results put the name above the amounts (no overlap), Winner List wraps, Team Performance header stacks, the made-the-cut chart scrolls sideways (26 px per event), popups fit the screen width, golfer tables in popups narrower, Times Picked/Lineup numbers smaller.
- Readability (#11 without point numbers): popups close with Esc as well as tap elsewhere and scroll; dark text on the palette fills already meets contrast (checked the boosted magenta).
- jsdom re-checks pass (two old tests checked removed features). Phone view still to be confirmed by Tom.
- Fix: the Tracker's top blocks grew from 214 to 268 px (all three columns, so they still line up); the Your Team card's new prize and payout lines had pushed its trend line down onto the golfer bars. Chrome would not resize to phone width here, so the phone view is for Tom to check.
- Tom: the dashboard's first tab is now labelled "Main" instead of "Tracker" (internal id still `tracker`). Tom asked what the blue outline is (the My team marker); I suggested a "My team" tag instead; no answer yet.
- Tom chose option 1: the blue outline around "my team" is replaced by a blue "My team" tag in front of the name (Leaderboard, Weekly Results list) and under the name on Top Teams pies. The My team bar's hint now says so.
- Tom: the blue "My team" pill was hard to see on the green bars; it is now a flag (⚑) in front of the name, in the text colour so it shows on any bar (hover text "My team"); the Top Teams pie card shows "⚑ My team".
- Font pairings suggested (1 Fraunces + Outfit, 2 Barlow Condensed + Inter (my pick), 3 DM Serif Display + DM Sans, 4 Archivo Black + Archivo). Temporary preview in `site/sitebar.js`: `?font=1..4` on any page loads that pairing (headings, numbers, body) with a small switcher bottom-left; remembered in this browser (`fgt-font-preview`) across pages; `?font=0` turns it off. Remove the preview code once Tom picks.
- Tom liked pairings 2 and 3 and picked 2: Barlow Condensed for headings, team names on cards and big numbers, Inter for all other text, tabular numbers everywhere. Applied on home, team picker and dashboard (replacing Outfit; `--head` and `--sans` tokens). Temporary font preview removed from sitebar.js/css.
- Main tab, Your Team card (Tom): now only the team name and "made $X at the <event>", using the event picked in the Weekly Winner column (like his Tableau user-selection card). Season rank/total, last event, weekly prize money and "in line for" removed from this card (still shown on the Leaderboard and Team Performance).
- Tom's screenshot showed a serif heading font: his browser still had the old preview script cached with pairing 3 saved; it clears after a hard refresh (the preview code is gone).
- Main tab: the "Your team (blue) vs the overall leader (grey), by event" caption is 11 px on one line on desktop (cut with "..." if a very narrow column can't fit it), 13 px with tighter line spacing on phones.
- Fix: long event names (Austin's sponsor title) widened the middle Main-tab column; the three columns are now forced equal (`minmax(0, 1fr)`), long text wraps inside.
- Shorter tournament names (Tom): Austin Championship (drops "presented by Compliance Solutions"), Cognizant Classic, Arnold Palmer Invitational, Memorial Tournament, FedEx St. Jude. Schedule file uses the short names with `pgaName` keeping pgatour.com's full name for the weekly job's matching (dry run on Austin found it). Dashboard and home page map long names to short ones on load (`SHORT_NAMES`), so data already in the Sheet under the long name (Austin) also shows short. Schedule resent via the job's check run.
- Main tab (Tom): the green Overall Leader card and the blue Your Team card are now the same height (an invisible spacer matches Your Team's chart caption); the purple card is unchanged.

## 2026-11-20: live test entry and phone check (Tom)

- Tom sent a real test entry from his phone: it reached the Sheet, the confirmation email arrived and a repeat lineup was rejected, so the duplicate-lineup Code.gs (67633b1) is live. Removed both "Open" items from CLAUDE.md.
- Tom checked the dashboard on his phone: looks good. The phone-view item is closed.

## 2026-11-20: safety nets (Tom: "do 5-7")

- 5 Backups: Code.gs `backupSheet()` copies the whole Sheet into the Drive folder "FGT Sheet backups" (id saved in script property BACKUP_FOLDER_ID), named "<Sheet name> backup yyyy-MM-dd HHmm", newest 12 kept (older ones trashed). Menu: Back up the Sheet now; Turn on weekly backups (Tuesday ~3am trigger, replaces any earlier one, makes a first copy). Adds Drive access, so Google asks Tom to approve once.
- 7 Unpaid list: menu Email me the unpaid list. Emails the script owner only: entries with the Paid box unticked (team, name, phone, email, date entered), count and $ outstanding; notes rows marked duplicate.
- 6 Missing-results alarm: `weekly-update.js` reads the live feed; any Schedule event (counts Yes) that finished 2+ days ago with no rows in the feed's results is retried in that run, and if still missing the run fails with a MISSING line (GitHub emails Tom). The Monday-evening run is the first that checks a Sunday finish. `liveFeed()` added to fgt-lib. Dry run on a test schedule: Austin caught up and pulled, fake event flagged, not-counted and future events ignored; real schedule exits 0.
- Tom must paste the new Code.gs, save, run FGT > Back up the Sheet now (approve Drive), then Turn on weekly backups, then redeploy (New version).
- Tom: done (Code.gs pasted, backups on, redeployed). Live feed checked afterwards: ok, 0 teams (test entry removed), 1 event.

## 2026-11-20: housekeeping (#10)

- `.gitignore` now covers `*.docx`, `*.pdf` and `.bench/` (rules sheet and Workbench folder). Closed the open item.
- CLAUDE.md trimmed under 15 KB: dropped the dashboard "Built so far" list (repeats the tab list), the 37 payout amounts (they are `PAYOUTS_2026` in Code.gs), and tidied the public-dashboard and DNS lines. No rules changed.

## 2026-11-20: Sunday 4pm run; slow past-results page (Tom)

- New Sunday 4pm Mountain run. GitHub cron is UTC only, so two lines (22:00 and 23:00 UTC Sunday) and the job step skips the one whose Mountain offset is wrong (-0600 summer, -0700 winter).
- Tom: pgatour.com's past-results page (the money) often lags the event going official. `pullResults` now marks these as "not ready" (err.notReady) instead of errors: page still on last year's event or season, no Official Money column, fewer than 30 golfers with money or the winner at $0, or total money under 70% of the purse (weekly job passes `purse || refPurse`). The weekly job logs "results not ready yet ... will try again" and does not fail; the MISSING check still fails the run once the event is 2+ days old with nothing in the Sheet. Every later run in the window re-sends the event, so the Monday runs refresh Sunday's data.
- Tested live: Austin passes with its $6M purse, flagged not ready against a fake $10M purse; RSM (in progress) waits; real schedule exits 0. The last-year-page case could not be tested live (RSM is not official yet).

## 2026-11-20: Monday morning run at 4:44am (Tom)

- Replaced the Monday 15:00 UTC run (8-9am MT) with 4:44am Mountain year-round: pair "44 10 * * 1" (summer) and "44 11 * * 1" (winter). The skip step now uses a case list for all paired lines; unpaired lines and manual runs always run. Skip logic checked for every line and both offsets.

## 2026-11-20: beehiiv weekly emails (Tom)

- Tom's beehiiv account is on the free Launch plan. Per beehiiv's help centre, creating posts by API needs Max or Enterprise, so no automatic drafts. Tom chose: weekly recap emailed to him, and adding entrants to the list.
- Recap: `buildRecap_(event)` in Code.gs, built only from `dashboardData_()` (public feed, team names only). Sections: winner + prize (ties split; Majors also 2nd), top 5 teams with real places (T for ties), top 5 golfers ("on N teams" once lineups are public), season top 10 through that event with up/down moves vs the event before, biggest climber, next event and its prize, dashboard link. Text + simple HTML (headings, line breaks; pastes cleanly into beehiiv). Season totals count only Schedule events with counts Yes (skips the 2026 Austin test data). `saveResults_` calls `maybeSendRecap_` after refreshEventScores: once per event (script property `RECAP_SENT:<event>`), never fails the results post. Menu: Email me the latest weekly recap (beehiiv) resends.
- Entrants: menu Email me new entrants for beehiiv (CSV): one row per email, entrants since the last export (property BEEHIIV_EXPORTED_AT) or everyone; emailed to the owner only for Tom to import himself. No player data goes to beehiiv by script.
- Tested in Node with demo data (vm-loaded Code.gs, stubbed MailApp/Properties): wording, ties, Major 2nd place, moves, once-per-event (2 deliveries = 1 email), no email/phone-like text in the recap.
- Needs Tom: paste Code.gs, save, redeploy (New version; the recap runs inside the web app's results call). Not confirmed yet.

## 2026-11-20: recap story, order, pick counts, leader line (Tom)

- Tom deployed the beehiiv Code.gs and got the test email. Asked for: golfers section above top teams; pick counts on every golfer; a blurb on how the winner won; a call-out when the season leader changes.
- Story: `storyFromRounds` in `tools/fgt-lib.js` from the past-results page's round scores (no hole-by-hole data there, so nothing like "over the last 3 holes"; that would need each contender's scorecard). Cases: wire to wire (solo or shared), came from X back (place) into the final round, took an X-shot lead / started tied and won or "held on" (margin 1), playoff (equal totals), "low round of the day", and the 54-hole/overnight leader(s) who didn't win ("could only manage", "fell apart" if +3 or worse or +1 or worse and 4+ back, "lost the playoff"). Last names: last word plus lowercase particles and suffixes (pgatour's short name gives "S. Woo Kim"). No pronouns. Skipped for team events. Sent as `story` with the results; Code.gs stores it in script property `STORY:<event>`; the weekly run log prints it. Checked on 13 real 2026 events (3M to Austin).
- Fix found while testing: the "fewer than 30 golfers with money = not ready" rule would have blocked the 30-man TOUR Championship forever (29 paid). Now not ready only if fewer than 30 AND under 80% of the field are paid.
- Recap order now: title, story, FGT winner + prize, Major 2nd, season-leader line ("X has the early season lead" / "New season leader: X takes over the top spot from Y" / "X stays on top of the season standings (N weeks running)"; ties share), Golfers who paid off ("picked by N teams" / "picked by no one", counted from the Lineups tab so it works while the feed hides lineups; counts only), Top teams this week, Season standings, biggest climb, Next up.
- Tested with demo data (vm harness). Needs Tom: paste Code.gs, save, redeploy (New version).

## 2026-11-20: amateurs (Tom)

- Tom: amateurs can play but can't accept prize money (unless they turn pro); their money is redistributed among the professionals who made the cut. pgatour.com's Official Money already reflects this (amateurs $0, pros paid as if the amateur weren't there), so the data was right.
- Fix: the readiness check's "winner at $0 = not ready" would have blocked an amateur win forever (Nick Dunlap won the 2024 American Express, our first event's tournament). It now uses the best-placed professional (`player.amateur` flag), and the 80%-paid rule counts professionals only. Run summary notes an amateur winner, the top pro and the number of amateurs at $0.
- Story: "Amateur Nick Dunlap ... Amateurs can't take prize money, so the pros were paid as if Dunlap weren't in the field: Bezuidenhout (2nd) got the winner's share." Also fixed "the The American Express". Tested on R2024002 and the 2026 events. No Code.gs change.

## 2026-11-20: recap story test on Austin

- The menu test recap had no story because Austin was loaded before stories existed. Re-pulled Austin with the story under the Sheet's exact name ("... presented by Compliance Solutions"; story text uses the short name) and Tom posted it: ok, 113 rows stored (was 64: more golfers now match the points list or Lineups), Christiaan Maas has money but is not on the points list (write-in 1-pointer). Snapshot refreshed. The resend should have triggered the automatic recap email (first delivery since the recap feature).
- No email after the resend, and the menu said "No event has results yet": the Sheet has 0 teams (test entry deleted), so EventScores was empty and `buildRecap_` returned null. Now the recap is built whenever the event has results: with no teams it shows the story, golfers (picked by no one) and Next up, with "No FGT teams have scores yet." in place of the team sections; the menu also looks at Tournaments results. Tested against the live feed (0 teams, 113 results). Tom: paste Code.gs and save (menu works at once); redeploy so the automatic send has it too.
- Tom: the menu recap with the story arrived and looks right ("that's perfect").
- Tom redeployed Code.gs (recap fixes live). Feed checked: ok.

## 2026-11-20: control heights (Tom)

- Weekly Results: the Select tournament dropdown and Highlight team search box were different heights. All search boxes and dropdowns on the dashboard now share the dropdown's height (32px, box-sizing border-box; search box appearance reset so Safari honours it).

## 2026-11-20: DataGolf resubscribed (Tom)

- Tom resubscribed. Key file `~/.config/fgt/datagolf.key` does not exist yet; asked Tom to save it from the clipboard (pbpaste) so it never shows in chat.
- DataGolf terms (datagolf.com/terms-and-conditions, read today): clause 13 grants "personal, non-commercial use" and says "you will not redistribute or transfer" the services or content. No attribution rule, no explicit public-display policy. A public dashboard is a grey area; suggested Tom ask DataGolf for permission (or keep SG panels off the public page). API: 45 requests/min shared, 5-minute suspension; key goes in the query string, so fetch server-side (weekly job) and publish only the derived numbers.
- Key saved (second try; first clipboard had text). Test request to /preds/get-dg-rankings: 200, 500 players, fields am, country, datagolf_rank, dg_id, dg_skill_estimate, owgr_rank, player_name ("Last, First"), primary_tour. Waiting on Tom's choice about public display.

## 2026-11-20: DataGolf strokes gained panels (Tom: "build and publish now")

- `tools/datagolf.js`: 3 requests (get-dg-rankings, historical-raw-data/rounds event_id=all for last and this calendar year). Keeps golfers from players.js, the snapshot's lineups/results and the demo lineups; writes `site/data/sg.json` (~150 KB): events table plus per golfer dg rank, owgr, rounds in last 12 months, avg [OTT, APP, ARG, PUTT, Total] per round over 12 months, last 15 events [event, finish, rounds, 5 SG per-round]. Names "Last, First" flipped and folded; 272 of 274 matched (Sandy Scott, Dylan Menante have no DG rounds). Key from $DATAGOLF_KEY or ~/.config/fgt/datagolf.key, scrubbed from errors, refuses to write if the key appears in output; skips quietly with no key; leaves the file alone if only the time changed.
- Weekly workflow: new continue-on-error step runs it with secret DATAGOLF_KEY; commit step includes sg.json. I was not allowed to set the secret (auto-mode classifier); Tom to run `! gh secret set DATAGOLF_KEY < ~/.config/fgt/datagolf.key`. Tom set it. Manual run 44788153562: all steps succeeded, the DataGolf step reached DataGolf with the secret (key masked in logs) and found sg.json unchanged.
- Dashboard Team Performance > Stats: earnings bars coloured by quadrant (striped = no data), Long vs Short Game bubble chart (size = season earnings, quadrant tints and labels, hover/tap details), golfer picker (default top earner with data), SG Total trend (last 15 events, red dots below zero), Recent Performance (Points, OWGR, DG Rank, 12-month SG Total; last 10 events newest first, green/red numbers), DataGolf credit link. Hidden until lineups are public, like the rest of Stats. Checked on the live demo in Chrome; phone view for Tom.

## 2026-11-20: Team Performance money card (Tom)

- Removed the "Weekly prize money won" line from the Team Performance season-total card; "In line for $X at season's end" stays. Weekly winnings still show on Main, Weekly Results, Leaderboard and Winner List.

## 2026-11-20: SG Total chart as rounds (Tom)

- Tom: the SG Total chart should be pale green bars for each past round with a line for the 50-round average. `tools/datagolf.js` now stores `rd` per golfer: last 50 rounds [event, round, SG Total, average of the 50 rounds up to and including it (fewer if less history)]. sg.json grew to ~334 KB (loaded in the background). Chart: pale green bars (darker green in dark mode), dark green average line, event start dates under the bars, hover/tap per round, legend.
