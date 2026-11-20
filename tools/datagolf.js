// Pulls strokes gained, DG Rank and OWGR from the DataGolf API and writes site/data/sg.json for the dashboard's
// Team Performance stats panels. Only golfers the FGT can use are kept (the points list, plus anyone in the
// published results or lineups), and only the derived numbers are written: per-round averages, never raw feeds.
//
// Usage: node tools/datagolf.js        (key from $DATAGOLF_KEY, else ~/.config/fgt/datagolf.key)
// The key is never printed or written anywhere; error messages have it blanked out.
// DataGolf allows 45 requests a minute; this makes 3-4 per run (rankings + one rounds request per calendar year).
const fs = require('fs'), os = require('os');
const ROOT = __dirname + '/..';
const KEEP_EVENTS = 15;          // per golfer, for the trend line and the Recent Performance table
const WINDOW_DAYS = 365;         // the Long vs Short Game averages use the last 12 months of rounds

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
const shortEvent = s => String(s).replace(/\s+presented by .*$/i, '').trim();
const r2 = v => v == null || isNaN(v) ? null : Math.round(v * 100) / 100;
const CATS = ['sg_ott', 'sg_app', 'sg_arg', 'sg_putt', 'sg_total'];

function ourGolfers() {
  global.window = {};
  require(ROOT + '/site/players.js');
  const D = window.FGT_DATA, names = new Map();
  D.columns.flat().concat(D.more ? [D.more] : []).forEach(s => s.players.forEach(n => names.set(fold(n), n)));
  try {   // write-ins and anyone with money, from the published snapshot (team names only, no personal details)
    const snap = JSON.parse(fs.readFileSync(ROOT + '/site/data/dashboard.json', 'utf8'));
    (snap.lineups || []).concat(snap.results || []).forEach(r => { if (r.golfer && !names.has(fold(r.golfer))) names.set(fold(r.golfer), r.golfer); });
  } catch (e) {}
  return names;
}

(async () => {
  if (!KEY) { console.log('Skipped: no DataGolf key (set DATAGOLF_KEY or ~/.config/fgt/datagolf.key).'); return; }
  const names = ourGolfers();
  const now = new Date(), years = [now.getFullYear() - 1, now.getFullYear()];
  const ranks = await get('/preds/get-dg-rankings');
  const rounds = {};
  for (const y of years) {
    try { Object.assign(rounds, await get('/historical-raw-data/rounds?tour=pga&event_id=all&year=' + y)); }
    catch (e) { if (y !== now.getFullYear()) throw e; console.log('No ' + y + ' rounds yet (' + e.message + ').'); }
  }

  // Events, oldest first.
  const events = Object.values(rounds).filter(e => e && Array.isArray(e.scores) && e.event_completed)
    .sort((a, b) => a.event_completed < b.event_completed ? -1 : 1);
  const evIndex = new Map(), evList = [];
  events.forEach(e => { evIndex.set(e, evList.length); evList.push([shortEvent(e.event_name), e.event_completed]); });

  const cutoff = new Date(now.getTime() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const out = {}, seenDg = new Set();
  const slot = n => out[n] || (out[n] = { ev: [], sum: [0, 0, 0, 0, 0], cnt: [0, 0, 0, 0, 0] });
  for (const e of events) {
    for (const s of e.scores) {
      const name = names.get(fold(flip(s.player_name)));
      if (!name) continue;
      seenDg.add(name);
      const rs = Object.keys(s).filter(k => /^round_\d+$/.test(k)).map(k => s[k]).filter(r => r && typeof r === 'object');
      if (!rs.length) continue;
      const g = slot(name), evSum = [0, 0, 0, 0, 0], evCnt = [0, 0, 0, 0, 0];
      rs.forEach(r => CATS.forEach((c, i) => {
        if (typeof r[c] !== 'number') return;
        evSum[i] += r[c]; evCnt[i]++;
        if (e.event_completed >= cutoff) { g.sum[i] += r[c]; g.cnt[i]++; }
      }));
      if (!evCnt[4]) continue;   // no strokes gained recorded for this event
      g.ev.push([evIndex.get(e), String(s.fin_text || ''), rs.length].concat(evSum.map((v, i) => evCnt[i] ? r2(v / evCnt[i]) : null)));
    }
  }
  const rankBy = new Map();
  (ranks.rankings || []).forEach(r => rankBy.set(fold(flip(r.player_name)), r));
  const golfers = {};
  const usedEv = new Set();
  for (const [k, name] of names) {
    const g = out[name], rk = rankBy.get(k);
    if (!g && !rk) continue;
    const rec = { dg: rk ? rk.datagolf_rank : null, owgr: rk ? rk.owgr_rank : null };
    if (g) {
      rec.n = g.cnt[4];                                             // rounds in the last 12 months
      rec.avg = g.sum.map((v, i) => g.cnt[i] ? r2(v / g.cnt[i]) : null);   // per round: OTT, APP, ARG, PUTT, Total
      rec.ev = g.ev.slice(-KEEP_EVENTS);
      rec.ev.forEach(x => usedEv.add(x[0]));
    }
    golfers[name] = rec;
  }
  // Keep only the events someone uses, and renumber.
  const keep = evList.map((_, i) => i).filter(i => usedEv.has(i)), remap = new Map(keep.map((i, j) => [i, j]));
  Object.values(golfers).forEach(g => (g.ev || []).forEach(x => { x[0] = remap.get(x[0]); }));
  const missing = [...names.values()].filter(n => !golfers[n] || !golfers[n].avg);

  const data = {
    generated: now.toISOString(), credit: 'Strokes gained, DG Rank and OWGR courtesy of DataGolf (datagolf.com)',
    note: 'SG figures are per round. avg = last 12 months [OTT, APP, ARG, PUTT, Total]; ev = [event, finish, rounds, OTT, APP, ARG, PUTT, Total].',
    events: keep.map(i => evList[i]), golfers
  };
  const text = JSON.stringify(data);
  if (text.includes(KEY)) throw new Error('Refusing to write: output contains the key.');
  fs.mkdirSync(ROOT + '/site/data', { recursive: true });
  // Unchanged data (apart from the time) leaves the file alone, so the weekly job doesn't commit for nothing.
  let old = null; try { old = JSON.parse(fs.readFileSync(ROOT + '/site/data/sg.json', 'utf8')); } catch (e) {}
  const same = old && JSON.stringify(Object.assign({}, old, { generated: '' })) === JSON.stringify(Object.assign({}, data, { generated: '' }));
  if (!same) fs.writeFileSync(ROOT + '/site/data/sg.json', text);
  console.log((same ? 'sg.json unchanged: ' : 'Saved site/data/sg.json: ') + Object.keys(golfers).length + ' golfers (' +
    Object.values(golfers).filter(g => g.avg).length + ' with strokes gained), ' + keep.length + ' events, ' + Math.round(text.length / 1024) + ' KB. ' +
    'No DataGolf strokes gained for ' + missing.length + ' of ' + names.size + ' listed golfers' + (missing.length ? ' (e.g. ' + missing.slice(0, 8).join(', ') + ')' : '') + '.');
})().catch(e => { console.log('Stopped: ' + scrub(e.message)); process.exit(1); });
