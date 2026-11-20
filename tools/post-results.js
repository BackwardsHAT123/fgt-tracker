// Sends one event's prize money, or the season schedule, to the Sheet's Apps Script.
// Usage:  FGT_RESULTS_TOKEN=... node tools/post-results.js results.json
// A file with an "events" list is the season schedule; anything else is one event's results.
// The token must match the RESULTS_TOKEN Script Property in Apps Script. Never commit the token.
const fs = require('fs');
const { postToSheet } = require('./fgt-lib');
const file = process.argv[2];
if (!file) { console.error('Usage: node tools/post-results.js results.json'); process.exit(1); }
postToSheet(JSON.parse(fs.readFileSync(file, 'utf8')), process.env.FGT_RESULTS_TOKEN)
  .then(j => console.log(JSON.stringify(j)))
  .catch(e => { console.error(String(e.message || e)); process.exit(1); });
