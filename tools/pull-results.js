// Pulls one finished event's full field from pgatour.com and writes the results file for tools/post-results.js.
//
// Usage:
//   node tools/pull-results.js <past-results URL> [--name "Event name as on the Schedule tab"] [--out file.json] [--halve]
//
// <past-results URL> looks like https://www.pgatour.com/tournaments/2026/the-rsm-classic/R2026493/past-results
// (the middle part of the address can be anything; the R... id is what counts).
// --name   the tournament name to store (use the Schedule tab's name for 2027 events). Default: pgatour.com's name.
// --out    where to write the JSON. Default: ./results-<tournamentId>.json
// --halve  team events (Zurich Classic): each golfer is credited half of the money shown. Check the page first.
// It stops instead of writing a wrong file if the event is not official yet, or the page still shows last year's results.
// Every golfer in the field is written, including cuts, withdrawals and amateurs, with earnings 0 when they won nothing.
const fs = require('fs');
const { pullResults } = require('./fgt-lib');
const args = process.argv.slice(2);
const url = args.find(a => /^https?:\/\//.test(a));
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
if (!url) { console.error('Usage: node tools/pull-results.js <pgatour.com past-results URL> [--name "..."] [--out file] [--halve]'); process.exit(1); }
pullResults(url, { name: opt('--name'), halve: args.includes('--halve') }).then(r => {
  const file = opt('--out') || ('results-' + (url.match(/(R\d+)/) || [])[1] + '.json');
  fs.writeFileSync(file, JSON.stringify(r.out, null, 1));
  console.log(r.summary); console.log('Wrote ' + file);
}).catch(e => { console.error('Stopped: ' + e.message); process.exit(1); });
