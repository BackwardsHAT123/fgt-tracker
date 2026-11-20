// Live tournament data for the dashboard's Live tab (Tom's #5 and #6). Writes live/live.json:
//   - preview (event week, before it starts): the field and tee times, so teams can see who is playing;
//   - live (Thursday to the finish): each golfer's position, score, today, thru, round scores, DataGolf's odds, and
//     two money figures: "now" (paid as if the event ended right now) and "proj" (expected money from DataGolf's
//     finish odds). The page adds them up per team from the lineups it already has.
// Money uses data/payout-pct.json (each position's share of the purse, measured from real results) and the
// Schedule's purse (or last year's, refPurse, until the Tour posts it).
//
// Usage: node tools/live-update.js [--out live/live.json] [--any]
//   --any  use whatever event DataGolf is covering even if it isn't on the FGT schedule (for testing).
// Two DataGolf requests per run (field-updates, in-play), well under the 45/minute limit.
const fs = require('fs');
const { ROOT, KEY, scrub, get, fold, flip, ourGolfers } = require('./dg-lib');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const OUT = opt('--out') || (ROOT + '/live/live.json');
const ANY = args.includes('--any');
const day = d => d.toISOString().slice(0, 10);
const addDays = (iso, n) => day(new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 86400000));

function write(data) {
  const text = JSON.stringify(data);
  if (KEY && text.includes(KEY)) throw new Error('Refusing to write: output contains the key.');
  fs.mkdirSync(require('path').dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text);
}

(async () => {
  if (!KEY) { console.log('Skipped: no DataGolf key.'); return; }
  const now = new Date(), today = day(now);
  const sched = JSON.parse(fs.readFileSync(ROOT + '/data/schedule-2027.json', 'utf8')).events.filter(e => e.counts === 'Yes');
  const pct = JSON.parse(fs.readFileSync(ROOT + '/data/payout-pct.json', 'utf8')).types;

  const field = await get('/field-updates?tour=pga');
  // Which FGT event is this? DataGolf's current event, matched to the schedule by name; event week runs from
  // Monday (finish - 6 days) to the day after the finish (Monday finishes).
  const dgName = fold(field.event_name || '');
  let ev = sched.find(e => { const a = fold(e.pgaName || e.event), b = fold(e.event); return a === dgName || b === dgName || dgName.includes(b) || a.includes(dgName); });
  if (ev && !(today >= addDays(ev.finish, -6) && today <= addDays(ev.finish, 1))) ev = null;
  if (!ev && ANY) ev = { event: field.event_name, finish: field.date_end, type: 'regular', refPurse: 8000000, notes: 'test: not on the FGT schedule' };
  if (!ev) {
    const next = sched.find(e => e.finish >= today);
    write({ ok: true, generated: now.toISOString(), status: 'none', next: next ? { event: next.event, finish: next.finish } : null });
    console.log('No FGT event this week' + (next ? ' (next: ' + next.event + ', finishing ' + next.finish + ')' : '') + '.');
    return;
  }
  const purse = Number(ev.purse) || Number(ev.refPurse) || 0;
  const table = pct[ev.type] || pct.regular;
  const names = ourGolfers();
  const canon = dg => names.get(fold(flip(dg))) || flip(dg);
  const am = {}, tee = {};
  (field.field || []).forEach(p => {
    am[p.dg_id] = !!p.am;
    tee[p.dg_id] = (p.teetimes || []).map(t => ({ r: t.round_num, t: t.teetime, hole: t.start_hole }));
  });
  const base = { ok: true, generated: now.toISOString(), event: ev.event, type: ev.type, finish: ev.finish, dgEvent: field.event_name,
    start: field.date_start, tzOffset: field.tz_offset, purse, purseIsEstimate: !Number(ev.purse) };

  // Before the first tee time: preview (field and tee times only).
  if (today < (field.date_start || addDays(ev.finish, -3))) {
    write(Object.assign(base, { status: 'preview', round: 0,
      players: (field.field || []).map(p => ({ name: canon(p.player_name), am: !!p.am, tee: tee[p.dg_id] })) }));
    console.log('Preview: ' + ev.event + ', ' + (field.field || []).length + ' in the field.');
    return;
  }

  const ip = await get('/preds/in-play?tour=pga&dead_heat=no&odds_format=percent');
  const rows = (ip.data || []).filter(p => p && p.player_name);
  const info = ip.info || {};
  const out = rows.map(p => ({
    dg: p.dg_id, name: canon(p.player_name), am: !!am[p.dg_id], pos: String(p.current_pos || ''), score: p.current_score, today: p.today,
    thru: p.thru, round: p.round, r: [p.R1, p.R2, p.R3, p.R4].map(v => v == null ? null : v),
    win: p.win, top5: p.top_5, top10: p.top_10, top20: p.top_20, mc: p.make_cut
  }));
  const gone = p => /^(CUT|MC|WD|W\/D|DQ|MDF)$/i.test(p.pos);
  const round = Number(info.current_round) || Math.max(0, ...out.map(p => p.round || 0));
  const allThrough = out.filter(p => !gone(p)).every(p => p.thru === 18 || String(p.thru).toUpperCase() === 'F');
  const lastRound = round >= 4 && allThrough;
  // A cut is coming if the event has one (DataGolf gives some players under 100% to make it) and rounds 1-2 are on.
  const cutPending = round <= 2 && out.some(p => p.mc != null && p.mc < 0.999);

  // "If it ended now": professionals in order of score; ties share the average of the places they cover.
  // Before the cut, only the top 65 and ties are paid (the usual cut line).
  const pros = out.filter(p => !p.am && !gone(p) && typeof p.score === 'number').sort((a, b) => a.score - b.score);
  const share = (from, k) => { let s = 0; for (let i = 0; i < k; i++) s += table[Math.min(from + i, table.length - 1)] || 0; return s / k; };
  let i = 0;
  while (i < pros.length) {
    let j = i; while (j + 1 < pros.length && pros[j + 1].score === pros[i].score) j++;
    const paid = !cutPending || i < 65;
    const m = paid ? Math.round(share(i, j - i + 1) * purse) : 0;
    for (let k = i; k <= j; k++) pros[k].now = m;
    i = j + 1;
  }
  // Expected money from DataGolf's finish odds, using the average payout of each band of places.
  const avg = (a, b) => share(a - 1, b - a + 1);
  const cutters = Math.min(table.length, Math.max(20, Math.round(out.reduce((s, p) => s + (p.am ? 0 : (p.mc == null ? 1 : p.mc)), 0))));
  out.forEach(p => {
    if (p.now == null) p.now = 0;
    if (p.am || gone(p)) { p.proj = 0; return; }
    const w = p.win || 0, t5 = Math.max(w, p.top5 || 0), t10 = Math.max(t5, p.top10 || 0), t20 = Math.max(t10, p.top20 || 0), mc = Math.max(t20, p.mc == null ? 1 : p.mc);
    p.proj = Math.round(purse * (w * avg(1, 1) + (t5 - w) * avg(2, 5) + (t10 - t5) * avg(6, 10) + (t20 - t10) * avg(11, 20) + (mc - t20) * avg(21, Math.max(21, cutters))));
    if (lastRound) p.proj = p.now;   // everyone's done: projection = final
  });
  // Scale the projections so they add up to what the table actually pays out (the band averages overshoot a little).
  if (!lastRound) {
    const want = purse * table.slice(0, cutters).reduce((t, v) => t + v, 0), got = out.reduce((t, p) => t + p.proj, 0);
    if (got > 0) out.forEach(p => { p.proj = Math.round(p.proj * want / got); });
  }
  out.forEach(p => { p.tee = tee[p.dg] || []; delete p.dg; });
  write(Object.assign(base, { status: lastRound ? 'final' : 'live', round, cutPending, dgUpdated: info.last_update || '', players: out }));
  const top = out.slice().sort((a, b) => b.now - a.now)[0];
  console.log((lastRound ? 'Final' : 'Live') + ': ' + ev.event + ', round ' + round + (cutPending ? ' (cut to come)' : '') + ', ' + out.length + ' players; leader ' +
    (top ? top.name + ' ' + top.pos + ' ' + top.score + ', $' + top.now.toLocaleString('en-US') + ' now' : '-') + '. Purse used $' + purse.toLocaleString('en-US') + (base.purseIsEstimate ? ' (last year\'s)' : '') + '.');
})().catch(e => { console.log('Stopped: ' + scrub(e.message)); process.exit(1); });
