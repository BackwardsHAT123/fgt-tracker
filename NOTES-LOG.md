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
