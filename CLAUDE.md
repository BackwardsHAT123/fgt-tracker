# FGT Tracker

Entry page and tooling for the PGA Fantasy Golf Tour (FGT), a private fantasy golf league. Owner: Tom (the commissioner). Explain things in plain terms; he is not a web developer.

Keep this file under ~15 KB. Dated entries, review results and feature write-ups go at the END of NOTES-LOG.md, never here.

## What it is

- Public entry page (team picker): https://fgt-mt.com/team-picker.html; https://fgt-mt.com/ forwards there. Dashboard: https://fgt-mt.com/dashboard.html. Hosted on GitHub Pages (repo https://github.com/BackwardsHAT123/fgt-tracker, public, branch `main`) with the custom domain set in repo Settings > Pages (no CNAME file; HTTPS enforced). Old backwardshat123.github.io/fgt-tracker/... links forward to fgt-mt.com.
- Domains: fgt-mt.com and fgt-mt.net, both registered and managed at Cloudflare (Tom's account). fgt-mt.com DNS: 4 A + 4 AAAA records to GitHub Pages (185.199.108-111.153, 2606:50c0:8000-8003::153) and CNAME www -> backwardshat123.github.io, all "DNS only" (grey cloud; orange breaks GitHub's certificate). fgt-mt.net forwards everything to https://fgt-mt.com (same path and query, 301) via a Cloudflare redirect rule; its two placeholder records (A @ 192.0.2.1, CNAME www) are Proxied (orange) on purpose.
- Players enter name, phone, email, team name (address optional) and pick golfers within a 25-point budget. Entry fee $100, paid by Venmo (handle in `site/config.js`).
- Submissions go to a Google Sheet through a Google Apps Script web app.

## Map

- `site/team-picker.html`: the whole entry page (HTML, CSS, JS, no build step). The "More 1-pointers" list is open by default, alphabetical by last name, in 4 columns (3 on tablets, 2 on phones). `site/index.html` is only a redirect to it, so old links keep working.
- `site/players.js`: golfer point tiers and page layout (`window.FGT_DATA`). The file you edit most.
- `site/config.js`: `SCRIPT_URL`, `VENMO_HANDLE`, `ENTRY_FEE`, `DEADLINE_TEXT`.
- `apps-script/Code.gs`: server side. Validates, recomputes points, rejects duplicate lineups, appends to the "Entries" tab.
- `apps-script/Golfers.gs`: GENERATED from `site/players.js` by `node tools/build-golfers.js`. Never hand-edit. Tom pastes it into the Apps Script project as a second file.
- Sheet "2027 FGT" (id in the Drive URL Tom gave; the Drive connector could not find it by id) has tabs: Entries (contact info, private), Golfers, Tournaments (golfer prize money per event, filled by me from pgatour.com after each event via `tools/post-results.js` and the token-protected `action:'results'` call in Code.gs), Lineups (one row per golfer per entry), EventScores (one row per event per team), Standings (team and name only, no contact info; feeds the future dashboard), Settings (number of paid teams, set by Tom after entries close), Schedule (2027 events, finish date, purse; loaded by me with `tools/post-results.js` from a JSON file with an `events` list). Menu "FGT" in the Sheet runs setup/refresh. Scoring is money: highest team earnings wins each event outright (tied teams split that event's pot; EventScores "Pot Share" is 1, or 1 divided by the number tied); two events on one weekend are separate events; a season money list pays a number of top teams Tom sets once entries close (about 17-18% of teams).
- `site/dashboard.html`: public dashboard. TAH design (Outfit, pill tabs and buttons, hairline cards, same tokens as team-picker.html) with a light/dark toggle top right (dark default, saved in localStorage `fgt-theme`); Tom's own point-level palette and the tracker's green/purple/blue stay. Reads `?view=dashboard` from the Apps Script (`dashboardData_` in Code.gs). Built so far: Tracker, Weekly Results, Leaderboard, Top Teams (pies), Team Performance (Weekly view done; Stats view has earnings bars, strokes gained waits on DataGolf), Winner List, How Many Times Picked?, Past Finishes, Lineup Analysis tabs. `?demo=1` shows fake teams from `site/dashboard-demo.js` (made by `tools/make-demo-data.js`); `?demo=pre` previews the entries-still-open state. Still to build: Team Performance strokes gained panels (DataGolf). All other Tableau tabs are done (Duplicate Teams dropped).
- `.github/workflows/pages.yml`: deploys `site/` on every push to `main` (Pages source is "GitHub Actions").
- `README.md`: setup and behavior notes.

## Verify a change

- No build step. Data checks: `node -e 'global.window={};require("./site/players.js");console.log(window.FGT_DATA.columns.length)'`. Expect 267 golfers total, no duplicates, sections sized 10/25/15 (column 1), 10/20/20 (column 2), 25/19 (column 3), 123 in `more`.
- The old jsdom page tests were lost with a cleared scratchpad. To bring them back: `npm install jsdom` in a temp folder and write a script that loads `site/team-picker.html` with a stubbed `fetch` and clicks chips. Not in the repo.
- I have not tested the page in a real browser. Ask Tom to check on his phone after visual changes.

## Point values (rules that stand)

- Tiers by final FedExCup rank: 1-10 = 6, 11-35 = 5, 36-60 = 4, 61-80 = 3, 81-100 = 2, everyone else = 1. Any golfer not listed is a 1-pointer via the write-in box.
- No LIV rules, no LIV bump, no special rules for LIV players. Tom: LIV is dead.
- Ranks 1-50: pgatour.com/fedexcup/fedexcup (final season standings; ranks 1-30 follow Tour Championship finish, not season points). Ranks 51+: pgatour.com/fedexcup/fedexcup-fall. In the Fall table the first number after the name is the projected rank; the "official" column lags.
- Layout in `players.js`: column 1 = 6s, 5s, 4s (ranks 36-50); column 2 = 4s (51-60), 3s, 2s; column 3 = featured 1-pointers (Rahm, DeChambeau, Hatton, Reed, then FedEx ranks 101-121), then Korn Ferry top 20 (Blades Brown is a 4-pointer, so 19 names). `more` is a collapsed searchable list.

## Conventions

- Styling follows Tom's TAH design system (https://claude.ai/artifact/AayV39mvihjogAmAvqwfVY): dark only, Outfit font, pill buttons and chips, hairline cards, no shadows, green for selected golfers, orange only on primary buttons.
- Dashboard point-level colours (Tom's palette, `PT` in `site/dashboard.html`): 1 #adbcb6, 2 #96d0ff, 3 #57c8c6, 4 #ff57ff, 5 #fbb457, 6 #c55657. Use them anywhere golfers are coloured by point level (Weekly Results golfer bars now; How Many Times Picked, Past Finishes and Lineup Analysis later). These are Tom's exact base values; the page raises saturation by `SAT` = 1.35 (Tom asked for a bit more punch; set SAT to 1 for his exact hex).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Stage only the files changed for the task. Never commit the rules `.docx`/`.pdf`, `.bench/`, `.claude/`, `FGT Logo.png` (1.8 MB original), or any CSV/export of the Sheet (contains players' contact info).
- Entries (names, phones, emails, addresses) live only in the Google Sheet. Keep the rules `.docx` out of the repo.

## Standing facts

- **Where history lives:** append dated entries to the END of NOTES-LOG.md; grep it before re-fixing something.
- **Standing authorization:** Tom said to commit and push finished project changes without asking. If anything errors, tell him instead of pushing. This applies to this project only.
- **Git needs the sandbox off:** the sandbox blocks writes to `.git` and breaks GitHub TLS, so commit and push with `dangerouslyDisableSandbox: true`. Run any local tests in the sandboxed shell (the unsandboxed shell has a different `$TMPDIR`).
- **Deploys:** pushing two commits within seconds cancels the first deploy (workflow `concurrency`). A "No artifacts named github-pages" failure was transient; re-run it from the GitHub Actions page.
- **Current status:** point values are PROVISIONAL (`provisional: true`), last updated Nov 16, 2026 (commit a9372ab) from projected FedExCup Fall ranks after the Austin Championship. The RSM Classic (Nov 19-22, 2026) is the last Fall event; standings are official Mon Nov 23.
- **When Tom says "lock in the point values":** (1) re-pull pgatour.com Fall standings in Chrome, (2) confirm ranks 1-50 are unchanged, (3) rebuild 4/3/2/1 groups from final ranks 51-100 and the featured 1-pointers (FedEx 101-121), moving golfers between `columns` and `more` as needed, (4) set `provisional: false`, (5) check counts, run `node tools/build-golfers.js`, commit, push, (6) show Tom the diff, and remind him to paste the new `Golfers.gs` into Apps Script and run FGT > Refresh Golfers tab. Close any Chrome tab you open.
- **Weekly results routine:** (1) find the finished event's pgatour.com past-results URL (`/tournaments/<year>/<slug>/<R id>/past-results`; the Schedule page links it), (2) `node tools/pull-results.js <URL> --name "<Schedule tab name>" --out <file>` (needs network, so run unsandboxed; it refuses events that are not COMPLETED or whose past results are still last year's), (3) Tom sends it: `! FGT_RESULTS_TOKEN=<token> node tools/post-results.js <file>`, (4) check the reply and the dashboard. Same-weekend events are separate runs. Full fields (cuts, withdrawals, amateurs at $0) are sent so Team Performance and Past Finishes work. Money keeps cents as pgatour.com reports them.
- **Zurich Classic (team event, Apr 2027):** pgatour.com reports each team's winnings; each golfer is credited half of their team's earnings. Use `tools/pull-results.js --halve` after checking how the page lists team money.
- **Public dashboard (building; Tom chose to keep the Tableau look; dropped the "most teams from one owner" stat; lineups stay hidden until entries close, set by Settings B5 = Yes or the DEADLINE passing):, built as a page in this repo from Tom's Tableau Public dashboard as the template):** show team names only. No names, phones, emails, addresses or Entry IDs of people anywhere on the page or in its data feed. The Standings tab has a "Name" column, so the feed must not include it.
- **DataGolf:** Tom has a DataGolf subscription with API access; it is the source for strokes gained, DG Rank and OWGR on the Team Performance tab (credit "courtesy of DataGolf" on the page). The key lives only in `~/.config/fgt/datagolf.key` (chmod 600). Never print it, commit it, put it in the Sheet, the page, a URL in logs, or chat. Load 2026 season stats too (Tom: yes), so Recent Performance has history in January.
- **SG quadrant colours (Team Performance):** Elite (long + short game both positive, upper right) = blue; Longknockers who can't putt (long +, short -, upper left) = orange; Shortknockers who can putt (long -, short +, lower right) = grey; Bad (both -, lower left) = red. The Total Earnings golfer bars use the same colours.
- **Open:** the duplicate-lineup version of `Code.gs` (commit 67633b1) must be redeployed by Tom (Deploy > Manage deployments > edit > New version) or the live script keeps saving duplicates. Not confirmed whether he did.
- **Open:** `DEADLINE_TEXT` in `config.js` and `DEADLINE` in `Code.gs` are unset until Tom picks a date.
- **Open:** I suggested adding `*.pdf`, `*.docx` and `.bench/` to `.gitignore`; Tom has not answered.
- **Open:** no live test entry has been confirmed; I never submit entries from the live page.
- **Sandbox/security settings:** I don't change them. Tom can use `/sandbox` or edit `~/.claude/settings.json` himself.
