// Shared DataGolf helpers for tools/datagolf.js (strokes gained) and tools/live-update.js (live projections).
// The key comes from $DATAGOLF_KEY or ~/.config/fgt/datagolf.key and is never printed: errors have it blanked out.
const fs = require('fs'), os = require('os');
const ROOT = __dirname + '/..';
function apiKey() {
  if (process.env.DATAGOLF_KEY) return process.env.DATAGOLF_KEY.trim();
  try { return fs.readFileSync(os.homedir() + '/.config/fgt/datagolf.key', 'utf8').trim(); } catch (e) { return ''; }
}
const KEY = apiKey();
const scrub = s => KEY ? String(s).split(KEY).join('<key>').split(encodeURIComponent(KEY)).join('<key>') : String(s);

async function get(path) {
  const url = 'https://feeds.datagolf.com' + path + (path.includes('?') ? '&' : '?') + 'file_format=json&key=' + encodeURIComponent(KEY);
  let res;
  try { res = await fetch(url); } catch (e) { throw new Error('DataGolf request failed: ' + scrub(e.message)); }
  const text = await res.text();
  if (res.status !== 200) throw new Error('DataGolf answered ' + res.status + ' for ' + path.split('?')[0] + ': ' + scrub(text.slice(0, 150)));
  try { return JSON.parse(text); } catch (e) { throw new Error('DataGolf sent something that is not JSON for ' + path.split('?')[0]); }
}

// Same name folding as Code.gs: case, accents and punctuation ignored ("Ludvig Åberg" == "ludvig aberg").
const fold = s => String(s).toLowerCase().replace(/ø/g, 'o').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
// DataGolf writes "Last, First" ("Kim, Si Woo"); turn it round.
const flip = s => { const i = String(s).indexOf(','); return i < 0 ? String(s) : (s.slice(i + 1).trim() + ' ' + s.slice(0, i).trim()); };

function ourGolfers() {
  global.window = {};
  require(ROOT + '/site/players.js');
  const D = window.FGT_DATA, names = new Map();
  D.columns.flat().concat(D.more ? [D.more] : []).forEach(s => s.players.forEach(n => names.set(fold(n), n)));
  try {   // write-ins and anyone with money, from the published snapshot (team names only, no personal details)
    const snap = JSON.parse(fs.readFileSync(ROOT + '/site/data/dashboard.json', 'utf8'));
    (snap.lineups || []).concat(snap.results || []).forEach(r => { if (r.golfer && !names.has(fold(r.golfer))) names.set(fold(r.golfer), r.golfer); });
  } catch (e) {}
  try {   // the made-up demo teams' golfers (real names), so the ?demo=1 preview has stats for its write-ins too
    global.window = {}; require(ROOT + '/site/dashboard-demo.js');
    (window.FGT_DEMO.lineups || []).forEach(r => { if (r.golfer && !names.has(fold(r.golfer))) names.set(fold(r.golfer), r.golfer); });
  } catch (e) {}
  return names;
}


module.exports = { ROOT, KEY, scrub, get, fold, flip, ourGolfers };
