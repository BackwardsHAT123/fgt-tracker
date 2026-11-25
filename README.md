# FGT Tracker

Tools for running the PGA Fantasy Golf Tour (FGT) league.

- `site/` is the team entry page. Players enter contact info and a team name, then pick golfers until they have used their 25 points. Static HTML, no build step.
- `apps-script/Code.gs` is the Google Apps Script that receives each entry and appends it to a Google Sheet.

## How the page behaves

- Name, phone, email and team name are required. Address is optional.
- A live counter shows points used (`0/25` up to `25/25`). Going over 25 shows an alert and disables Submit.
- Submitting with fewer than 25 points opens a warning with "Modify selections" or "Submit anyway".
- Any golfer not on the point sheet is a 1-pointer; use the write-in box.
- Point values live in `site/players.js`. While `provisional: true`, the page shows a banner.

## Updating point values

Edit `site/players.js` and set `provisional: false` once the FedExCup Fall finishes (RSM Classic, Nov 22, 2026). Tiers: ranks 1-10 = 6, 11-35 = 5, 36-60 = 4, 61-80 = 3, 81-100 = 2, everyone else = 1.

## Setup

1. **Create the Sheet.** Make a new Google Sheet (name it e.g. "FGT 2027 Entries").
2. **Add the script.** In the Sheet, Extensions > Apps Script. Replace the contents with `apps-script/Code.gs` and save.
3. **Deploy.** Deploy > New deployment > type "Web app". Execute as: **Me**. Who has access: **Anyone**. Authorize when asked, then copy the Web App URL (ends in `/exec`).
4. **Point the page at it.** Paste that URL into `SCRIPT_URL` in `site/config.js`, commit, push.
5. **Turn on GitHub Pages.** Repo Settings > Pages > Source: **GitHub Actions**. The workflow in `.github/workflows/pages.yml` then publishes `site/` on every push to `main`. The site uses the custom domain fgt-mt.com (set in Settings > Pages; DNS at Cloudflare): the landing page is `https://fgt-mt.com/`, the team picker `https://fgt-mt.com/team-picker.html` and the dashboard `https://fgt-mt.com/dashboard.html`. Without a custom domain it would live at `https://<account>.github.io/fgt-tracker/`.
6. **Test.** Submit a fake team and confirm a row appears in the `Entries` tab. Delete the test row.

After editing `Code.gs` later, use Deploy > Manage deployments > edit > New version so the live URL picks up the change.

## What lands in the Sheet

One row per team: timestamp, name, phone, email, address, team name, points used, golfer count, golfers with points, a lineup key, "Duplicate Of Row", and whether points were provisional or final. The "Duplicate Of Row" column is no longer filled in. Duplicates are now rejected at submit time instead: if a lineup exactly matches an earlier entry (ignoring case, accents and punctuation in names), the script saves nothing and the page tells the player the lineup is taken and sends them back to the picker. The check runs under a lock, so two identical teams submitted at the same moment can't both get in. The rule is that the later entry changes at least one golfer (up to 10 points' worth).

Team names must be unique too (ignoring case, spaces and punctuation); one person may enter several teams. Columns O-P are "Edit Code" (the secret part of each team's private edit link, `team-picker.html?edit=<code>`, sent in the confirmation email) and "Last Edited". The link reopens the picker with the team loaded; saving replaces that row in place (keeping its first-entered time, Entry ID, Paid box and code) and updates Lineups and Standings. The page also has "Already entered? Change your team", which emails the links for every team entered with an address (at most once per 10 minutes, same answer whether or not the address entered). FGT > "Show the edit link for the selected team" shows a row's link so you can send it by hand. Edits and new entries stop when entries close (Settings B5 = Yes or `DEADLINE`). If an edit changes the email address, the old address gets a notice.

After changing `Code.gs`, redeploy it (Deploy > Manage deployments > edit > New version) or the live script keeps the old behavior.

## Privacy notes

- The page is public, and anyone with the Apps Script URL can post to it. The script validates fields, recomputes the point total, stops formula injection, and has a honeypot field, but it can't verify a person is who they say. The per-golfer point values come from the page, so someone determined could post a fake value; check lineups against the point sheet before payouts.
- Entries (names, phones, emails, addresses) live only in the Sheet. Keep the Sheet's sharing private. Don't commit exports of it to this repo.
- Set `DEADLINE` in `Code.gs` to stop accepting entries automatically.

## Safety nets (Sheet menu FGT)

- **Email me the unpaid list**: emails only the script owner every entry whose Paid box is not ticked (team, name, phone, email, date entered) and the amount outstanding.
- **Back up the Sheet now** / **Turn on weekly backups**: saves a dated copy of the whole Sheet in the Drive folder "FGT Sheet backups" (newest 12 kept). Weekly backups run Tuesdays about 3am. The copies include contact info; keep the folder private.
- The weekly results job retries any FGT event that finished 2+ days ago but has no results in the Sheet, and fails (GitHub emails you) if it is still missing.

## beehiiv newsletter (free Launch plan: no posting by API)

- **Weekly recap:** the first time an event's results reach the Sheet, the script emails you a recap draft: a short "how it was won" story (from round scores: wire to wire, comeback from X back, fading 54-hole leader, playoff, margin, low round of the day), the FGT winner and prize, a season-leader line (new leader, or how many weeks the leader has held on), top golfers with how many teams picked each, top 5 teams that week, season top 10 with moves, biggest climber, next event. Team names only. Paste it into a new beehiiv post and check it before sending. **FGT > Email me the latest weekly recap (beehiiv)** sends it again (for example after Monday corrections).
- **FGT > Email me new entrants for beehiiv (CSV)**: emails you a CSV (email, first_name, last_name, team) of entrants since the last export, or everyone. Import it in beehiiv (Subscribers > Add subscribers > Import CSV), then delete the email. Nothing is sent to beehiiv automatically.
