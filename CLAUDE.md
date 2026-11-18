# FGT Tracker

Entry page and tooling for the PGA Fantasy Golf Tour (FGT), a private fantasy golf league. Owner: Tom (the commissioner). Explain things in plain terms; he is not a web developer.

Keep this file under ~15 KB. Dated entries, review results and feature write-ups go at the END of NOTES-LOG.md, never here.

## What it is

- Public entry page: https://backwardshat123.github.io/fgt-tracker/ (GitHub Pages, repo https://github.com/BackwardsHAT123/fgt-tracker, public, branch `main`).
- Players enter name, phone, email, team name (address optional) and pick golfers within a 25-point budget. Entry fee $100, paid by Venmo (handle in `site/config.js`).
- Submissions go to a Google Sheet through a Google Apps Script web app.

## Map

- `site/index.html`: the whole page (HTML, CSS, JS, no build step).
- `site/players.js`: golfer point tiers and page layout (`window.FGT_DATA`). The file you edit most.
- `site/config.js`: `SCRIPT_URL`, `VENMO_HANDLE`, `ENTRY_FEE`, `DEADLINE_TEXT`.
- `apps-script/Code.gs`: server side. Validates, recomputes points, rejects duplicate lineups, appends to the "Entries" tab.
- `apps-script/Golfers.gs`: GENERATED from `site/players.js` by `node tools/build-golfers.js`. Never hand-edit. Tom pastes it into the Apps Script project as a second file.
- Sheet "2027 FGT" (id in the Drive URL Tom gave; the Drive connector could not find it by id) has tabs: Entries (contact info, private), Golfers, Tournaments (golfer prize money per event, typed by hand), Lineups (one row per golfer per entry), EventScores (one row per event per team), Standings (team and name only, no contact info; feeds the future dashboard), Settings (season payout share). Menu "FGT" in the Sheet runs setup/refresh. Scoring is money: highest team earnings wins each event outright; two events on one weekend are separate events; a season money list pays the top ~17.5% of teams.
- `.github/workflows/pages.yml`: deploys `site/` on every push to `main` (Pages source is "GitHub Actions").
- `README.md`: setup and behavior notes.

## Verify a change

- No build step. Data checks: `node -e 'global.window={};require("./site/players.js");console.log(window.FGT_DATA.columns.length)'`. Expect 267 golfers total, no duplicates, sections sized 10/25/15 (column 1), 10/20/20 (column 2), 25/19 (column 3), 123 in `more`.
- The old jsdom page tests were lost with a cleared scratchpad. To bring them back: `npm install jsdom` in a temp folder and write a script that loads `site/index.html` with a stubbed `fetch` and clicks chips. Not in the repo.
- I have not tested the page in a real browser. Ask Tom to check on his phone after visual changes.

## Point values (rules that stand)

- Tiers by final FedExCup rank: 1-10 = 6, 11-35 = 5, 36-60 = 4, 61-80 = 3, 81-100 = 2, everyone else = 1. Any golfer not listed is a 1-pointer via the write-in box.
- No LIV rules, no LIV bump, no special rules for LIV players. Tom: LIV is dead.
- Ranks 1-50: pgatour.com/fedexcup/fedexcup (final season standings; ranks 1-30 follow Tour Championship finish, not season points). Ranks 51+: pgatour.com/fedexcup/fedexcup-fall. In the Fall table the first number after the name is the projected rank; the "official" column lags.
- Layout in `players.js`: column 1 = 6s, 5s, 4s (ranks 36-50); column 2 = 4s (51-60), 3s, 2s; column 3 = featured 1-pointers (Rahm, DeChambeau, Hatton, Reed, then FedEx ranks 101-121), then Korn Ferry top 20 (Blades Brown is a 4-pointer, so 19 names). `more` is a collapsed searchable list.

## Conventions

- Styling follows Tom's TAH design system (https://claude.ai/artifact/AayV39mvihjogAmAvqwfVY): dark only, Outfit font, pill buttons and chips, hairline cards, no shadows, green for selected golfers, orange only on primary buttons.
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
- **Open:** the duplicate-lineup version of `Code.gs` (commit 67633b1) must be redeployed by Tom (Deploy > Manage deployments > edit > New version) or the live script keeps saving duplicates. Not confirmed whether he did.
- **Open:** `DEADLINE_TEXT` in `config.js` and `DEADLINE` in `Code.gs` are unset until Tom picks a date.
- **Open:** I suggested adding `*.pdf`, `*.docx` and `.bench/` to `.gitignore`; Tom has not answered.
- **Open:** no live test entry has been confirmed; I never submit entries from the live page.
- **Sandbox/security settings:** I don't change them. Tom can use `/sandbox` or edit `~/.claude/settings.json` himself.
