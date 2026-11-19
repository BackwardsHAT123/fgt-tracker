// Pulls one finished event's full field from pgatour.com and writes the results file for tools/post-results.js.
//
// Usage:
//   node tools/pull-results.js <past-results URL> [--name "Event name as on the Schedule tab"] [--out file.json] [--halve]
//
// <past-results URL> looks like https://www.pgatour.com/tournaments/2026/the-rsm-classic/R2026493/past-results
// --name   the tournament name to store (use the Schedule tab's name for 2027 events). Default: pgatour.com's name.
// --out    where to write the JSON. Default: ./results-<tournamentId>.json
// --halve  team events (Zurich Classic): each golfer is credited half of the money shown. Check the page first.
//
// Safety checks (the script stops instead of writing a wrong file):
//   - the event must be COMPLETED (official), and
//   - the past-results data must be for this exact tournament and season (pgatour.com shows last year's results
//     on the page until the new event is official).
// Every golfer in the field is written, including cuts, withdrawals and amateurs, with earnings 0 when they won nothing.
const fs = require('fs');

const args = process.argv.slice(2);
const url = args.find(a => /^https?:\/\//.test(a));
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const halve = args.includes('--halve');
if (!url) { console.error('Usage: node tools/pull-results.js <pgatour.com past-results URL> [--name "..."] [--out file] [--halve]'); process.exit(1); }
const m = url.match(/\/tournaments\/(\d{4})\/[^/]+\/(R\d+)/);
if (!m) { console.error('That does not look like a pgatour.com tournament URL (expected .../tournaments/<year>/<slug>/<R id>/...).'); process.exit(1); }
const [, year, tid] = m;

const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
function finishDate(display) {
  // "Nov 12 - 15, 2026" or "Jan 29 - Feb 1, 2026" -> the last day, as YYYY-MM-DD
  const d = String(display || '').match(/([A-Z][a-z]{2})\s+(\d+)\s*-\s*(?:([A-Z][a-z]{2})\s+)?(\d+),\s*(\d{4})/);
  if (!d) return '';
  const mon = MON[d[3] || d[1]], day = +d[4], yr = +d[5];
  return yr + '-' + String(mon).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}
const money = s => Number(String(s || '0').replace(/[$,\s]/g, '')) || 0;

(async () => {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (FGT results script)' } });
  if (!res.ok) throw new Error('pgatour.com answered ' + res.status);
  const html = await res.text();
  const nd = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!nd) throw new Error('No page data found. pgatour.com may have changed its page; fall back to reading the page in Chrome.');
  const queries = JSON.parse(nd[1]).props.pageProps.dehydratedState.queries;
  const q = (name, test) => (queries.find(x => Array.isArray(x.queryKey) && x.queryKey[0] === name && (!test || test(x.queryKey[1]))) || {}).state;

  const t = (q('tournament', k => k && k.id === tid) || {}).data;
  const pr = (q('pastResults', k => k && k.tournamentPastResultsId === tid) || {}).data;
  if (!t || !pr) throw new Error('Could not find the tournament or its results in the page data.');
  if (t.tournamentStatus !== 'COMPLETED') throw new Error('Not official yet: status is ' + t.tournamentStatus + '. Try again later.');
  if (pr.id !== tid) throw new Error('Results on the page are for ' + pr.id + ', not ' + tid + ' (probably last year). Not writing a file.');
  const seasons = (pr.availableSeasons || []).map(s => s.displaySeason);
  if (seasons.length && !seasons.includes(String(t.seasonYear || year))) {
    throw new Error('Results season ' + seasons.join(',') + ' does not match ' + (t.seasonYear || year) + '. Not writing a file.');
  }

  const hdr = pr.additionalDataHeaders || [];
  const mi = hdr.findIndex(h => /money/i.test(h));
  if (mi < 0) throw new Error('No "Official Money" column in the results (headers: ' + hdr.join(', ') + ').');
  if (pr.teams && !halve) console.warn('Note: this event lists teams. If it is the Zurich Classic, rerun with --halve.');

  const rows = (pr.players || []).map(p => {
    let e = money((p.additionalData || [])[mi]);
    if (halve) e = Math.round(e / 2);
    return { golfer: p.player.displayName, finish: p.position, earnings: e };
  });
  const out = { tournament: opt('--name') || t.tournamentName, date: finishDate(t.displayDate), rows };
  const file = opt('--out') || ('results-' + tid + '.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 1));

  const paid = rows.filter(r => r.earnings > 0), total = paid.reduce((s, r) => s + r.earnings, 0);
  const by = f => rows.filter(r => r.finish === f).length;
  console.log(out.tournament + ' | finished ' + out.date + ' | ' + t.tournamentStatus);
  console.log(rows.length + ' golfers: ' + paid.length + ' with money ($' + total.toLocaleString('en-US') + ' total), ' +
    by('CUT') + ' cut, ' + by('W/D') + ' withdrew, ' + by('DQ') + ' DQ' + (halve ? ' | money halved (team event)' : ''));
  console.log('Winner: ' + (rows[0] ? rows[0].golfer + ' ' + rows[0].finish + ' $' + rows[0].earnings.toLocaleString('en-US') : '-'));
  console.log('Wrote ' + file);
})().catch(e => { console.error('Stopped: ' + e.message); process.exit(1); });
