// Saves the live dashboard feed as site/data/dashboard.json, so the dashboard can show it instantly
// (the live Google feed takes 2-4 seconds). Run after posting results, or any time:  node tools/snapshot-dashboard.js
// Then commit and push site/data/dashboard.json. Needs network, so run outside the sandbox.
// Safety: refuses to write if the feed contains anything that looks like an email, phone number or Entry ID.
const fs = require('fs');
const cfg = fs.readFileSync(__dirname + '/../site/config.js', 'utf8');
const url = (cfg.match(/SCRIPT_URL:\s*"([^"]+)"/) || [])[1];
if (!url) { console.error('SCRIPT_URL not found in site/config.js'); process.exit(1); }
(async () => {
  const text = await (await fetch(url + '?view=dashboard')).text();
  const d = JSON.parse(text);
  if (!d.ok || !Array.isArray(d.standings)) throw new Error('Feed did not return dashboard data: ' + text.slice(0, 120));
  const bad = [
    [/[\w.+-]+@[\w-]+\.[\w.]+/, 'an email address'],
    [/\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}/, 'a phone number'],
    [/"[0-9a-f]{8}"/, 'an Entry ID']
  ].filter(([re]) => re.test(text));
  if (bad.length) throw new Error('Not writing: the feed seems to contain ' + bad.map(b => b[1]).join(', ') + '.');
  fs.mkdirSync(__dirname + '/../site/data', { recursive: true });
  fs.writeFileSync(__dirname + '/../site/data/dashboard.json', text);
  const events = new Set(d.results.map(r => r.event)).size;
  console.log('Saved site/data/dashboard.json: ' + d.standings.length + ' teams, ' + events + ' events, lineups ' +
    (d.closed ? 'shown' : 'hidden') + ', ' + Math.round(text.length / 1024) + ' KB');
})().catch(e => { console.error('Stopped: ' + e.message); process.exit(1); });
