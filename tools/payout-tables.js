// Measures the PGA Tour's prize-money split from real results: each finishing position's share of the purse,
// per event type (regular, signature, players, major, playoff). The live projections use it to turn a
// leaderboard position into money. Writes data/payout-pct.json. Run once a season (unsandboxed):
//   node tools/payout-tables.js [season, default last year]
// How: for every completed event, purse = all official money paid; an untied position's share is its money / purse.
// Each position's share is the median across events of that type; gaps are filled from the neighbours.
const fs = require('fs');
const { ROOT, seasonTournaments } = require('./fgt-lib');
const UA = { 'User-Agent': 'Mozilla/5.0 (FGT results script)' };
const season = process.argv[2] || String(new Date().getFullYear());
const fold = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const money = s => Number(String(s || '0').replace(/[$,\s]/g, '')) || 0;

(async () => {
  const sched = JSON.parse(fs.readFileSync(ROOT + '/data/schedule-2027.json', 'utf8')).events;
  const typeOf = name => {
    const n = fold(name);
    const hit = sched.find(e => { const a = fold(e.pgaName || e.event), b = fold(e.event); return n === a || n === b || n.startsWith(b) || a.startsWith(n); });
    return hit ? hit.type : 'regular';
  };
  const ts = (await seasonTournaments(season)).filter(t => t.status === 'COMPLETED');
  const shares = {};   // type -> position -> [share, ...]
  const used = [];
  for (const t of ts) {
    if (/cup|zurich|team/i.test(t.name)) continue;   // team events and exhibitions don't follow the table
    let html;
    try { html = await (await fetch('https://www.pgatour.com/tournaments/' + season + '/event/' + t.id + '/past-results', { headers: UA })).text(); } catch (e) { continue; }
    const nd = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); if (!nd) continue;
    const q = JSON.parse(nd[1]).props.pageProps.dehydratedState.queries;
    const pr = ((q.find(x => x.queryKey && x.queryKey[0] === 'pastResults') || {}).state || {}).data;
    if (!pr || pr.id !== t.id) continue;
    const mi = (pr.additionalDataHeaders || []).findIndex(h => /money/i.test(h)); if (mi < 0) continue;
    const rows = pr.players.map(p => ({ pos: String(p.position || ''), m: money((p.additionalData || [])[mi]), am: !!p.player.amateur }));
    const purse = rows.reduce((s, r) => s + r.m, 0); if (purse < 1e6) continue;
    const type = typeOf(t.name);
    const count = {}; rows.forEach(r => { count[r.pos] = (count[r.pos] || 0) + 1; });
    // Pros only, numbered in order (amateurs take no money, so the pros below them move up a pay slot).
    let slot = 0;
    rows.filter(r => !r.am && /^T?\d+$/.test(r.pos)).forEach(r => {
      slot++;
      if (count[r.pos] === 1 && r.m > 0) (shares[type] = shares[type] || {}, shares[type][slot] = shares[type][slot] || []).push(r.m / purse);
    });
    used.push(type + ': ' + t.name);
  }
  const med = a => { const b = a.slice().sort((x, y) => x - y), k = b.length >> 1; return b.length % 2 ? b[k] : (b[k - 1] + b[k]) / 2; };
  const out = { season, note: 'Share of the purse by finishing slot (pros in order), median across ' + season + ' events of each type.', types: {} };
  for (const type of Object.keys(shares)) {
    const s = shares[type], maxPos = Math.max(...Object.keys(s).map(Number));
    const arr = [];
    for (let p = 1; p <= maxPos; p++) arr.push(s[p] && s[p].length ? med(s[p]) : null);
    for (let i = 0; i < arr.length; i++) if (arr[i] == null) {   // fill gaps: average of the nearest known neighbours
      let a = i - 1; while (a >= 0 && arr[a] == null) a--;
      let b = i + 1; while (b < arr.length && arr[b] == null) b++;
      arr[i] = a >= 0 && b < arr.length ? (arr[a] + arr[b]) / 2 : (a >= 0 ? arr[a] : arr[b]);
    }
    // Shares never rise further down the table.
    for (let i = 1; i < arr.length; i++) if (arr[i] > arr[i - 1]) arr[i] = arr[i - 1];
    out.types[type] = arr.map(v => Math.round(v * 1e6) / 1e6);
  }
  // The Players and the playoffs pay on the Tour's standard split, and one or two events a year (with ties) can't
  // measure it well, so they share the regular table.
  if (out.types.regular) { out.types.players = out.types.regular; out.types.playoff = out.types.regular; out.note += ' players and playoff use the regular table.'; }
  fs.writeFileSync(ROOT + '/data/payout-pct.json', JSON.stringify(out, null, 1));
  console.log('Events used: ' + used.length);
  for (const [k, v] of Object.entries(out.types)) console.log(k + ': ' + v.length + ' slots; 1st ' + (v[0] * 100).toFixed(2) + '%, 2nd ' + (v[1] * 100).toFixed(2) +
    '%, 10th ' + (v[9] * 100).toFixed(2) + '%, last ' + (v[v.length - 1] * 100).toFixed(3) + '%; table total ' + (v.reduce((a, b) => a + b, 0) * 100).toFixed(1) + '%');
})().catch(e => { console.log('Stopped: ' + e.message); process.exit(1); });
