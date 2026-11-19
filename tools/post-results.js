// Sends one event's prize money, or the season schedule, to the Sheet's Apps Script.
// Usage:  FGT_RESULTS_TOKEN=... node tools/post-results.js results.json
// results.json: { "tournament": "RSM Classic", "date": "2026-11-22", "rows": [ { "golfer": "...", "finish": "T5", "earnings": 123456 } ] }
// The token must match the RESULTS_TOKEN Script Property in Apps Script. Never commit the token.
const fs = require('fs');
const token = process.env.FGT_RESULTS_TOKEN;
if (!token) { console.error('Set FGT_RESULTS_TOKEN first.'); process.exit(1); }
const file = process.argv[2];
if (!file) { console.error('Usage: node tools/post-results.js results.json'); process.exit(1); }
const cfg = fs.readFileSync(__dirname + '/../site/config.js', 'utf8');
const url = (cfg.match(/SCRIPT_URL:\s*"([^"]+)"/) || [])[1];
if (!url) { console.error('SCRIPT_URL not found in site/config.js'); process.exit(1); }
// A file with an "events" list is the season schedule; anything else is one event's results.
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const body = Object.assign(data, { action: data.events ? 'schedule' : 'results', token });
fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) })
  .then(r => r.text()).then(t => console.log(t))
  .catch(e => { console.error(String(e)); process.exit(1); });
