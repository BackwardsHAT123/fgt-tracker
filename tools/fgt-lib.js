// Shared helpers for the FGT tools: pull results from pgatour.com, send data to the Sheet, save the dashboard snapshot.
// Used by pull-results.js, post-results.js, snapshot-dashboard.js and weekly-update.js.
const fs = require('fs');
const ROOT = __dirname + '/..';
const UA = { 'User-Agent': 'Mozilla/5.0 (FGT results script)' };

function scriptUrl() {
  const cfg = fs.readFileSync(ROOT + '/site/config.js', 'utf8');
  const url = (cfg.match(/SCRIPT_URL:\s*"([^"]+)"/) || [])[1];
  if (!url) throw new Error('SCRIPT_URL not found in site/config.js');
  return url;
}

async function pageQueries(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error('pgatour.com answered ' + res.status + ' for ' + url);
  const html = await res.text();
  const nd = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!nd) throw new Error('No page data found at ' + url + '. pgatour.com may have changed its page.');
  return JSON.parse(nd[1]).props.pageProps.dehydratedState.queries;
}
const pick = (queries, name, test) =>
  (queries.find(x => Array.isArray(x.queryKey) && x.queryKey[0] === name && (!test || test(x.queryKey[1]))) || {}).state;

const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
function finishDate(display) {
  // "Nov 12 - 15, 2026" or "Jan 29 - Feb 1, 2026" -> the last day, as YYYY-MM-DD
  const d = String(display || '').match(/([A-Z][a-z]{2})\s+(\d+)\s*-\s*(?:([A-Z][a-z]{2})\s+)?(\d+),\s*(\d{4})/);
  if (!d) return '';
  return d[5] + '-' + String(MON[d[3] || d[1]]).padStart(2, '0') + '-' + String(+d[4]).padStart(2, '0');
}
const money = s => Number(String(s || '0').replace(/[$,\s]/g, '')) || 0;

// One finished event's full field. Throws (and writes nothing) if not official yet or the results are for another event/season.
async function pullResults(url, opts) {
  opts = opts || {};
  const m = url.match(/\/tournaments\/(\d{4})\/[^/]+\/(R\d+)/);
  if (!m) throw new Error('Not a pgatour.com tournament URL (expected .../tournaments/<year>/<slug>/<R id>/...).');
  const [, year, tid] = m;
  const queries = await pageQueries(url);
  const t = (pick(queries, 'tournament', k => k && k.id === tid) || {}).data;
  const pr = (pick(queries, 'pastResults', k => k && k.tournamentPastResultsId === tid) || {}).data;
  if (!t || !pr) throw new Error('Could not find the tournament or its results in the page data.');
  if (t.tournamentStatus !== 'COMPLETED') throw new Error('Not official yet: status is ' + t.tournamentStatus + '.');
  if (pr.id !== tid) throw new Error('Results on the page are for ' + pr.id + ', not ' + tid + ' (probably last year).');
  const seasons = (pr.availableSeasons || []).map(s => s.displaySeason);
  if (seasons.length && !seasons.includes(String(t.seasonYear || year))) throw new Error('Results season ' + seasons.join(',') + ' does not match ' + (t.seasonYear || year) + '.');
  const hdr = pr.additionalDataHeaders || [];
  const mi = hdr.findIndex(h => /money/i.test(h));
  if (mi < 0) throw new Error('No "Official Money" column in the results (headers: ' + hdr.join(', ') + ').');
  const rows = (pr.players || []).map(p => {
    let e = money((p.additionalData || [])[mi]);
    if (opts.halve) e = Math.round(e / 2 * 100) / 100;
    return { golfer: p.player.displayName, finish: p.position, earnings: e };
  });
  const out = { tournament: opts.name || t.tournamentName, date: finishDate(t.displayDate), rows };
  const paid = rows.filter(r => r.earnings > 0), total = paid.reduce((s, r) => s + r.earnings, 0);
  const by = f => rows.filter(r => r.finish === f).length;
  const summary = out.tournament + ' (' + out.date + '): ' + rows.length + ' golfers, ' + paid.length + ' with money ($' +
    total.toLocaleString('en-US') + '), ' + by('CUT') + ' cut, ' + by('W/D') + ' withdrew' + (opts.halve ? ', money halved (team event)' : '') +
    '. Winner: ' + (rows[0] ? rows[0].golfer + ' $' + rows[0].earnings.toLocaleString('en-US') : '-') +
    (pr.teams && !opts.halve ? '. NOTE: this event lists teams; if it is the Zurich Classic, use --halve.' : '');
  return { out, summary, tournamentName: t.tournamentName };
}

// The season's tournaments from pgatour.com: [{ id, name, status, displayDate }].
async function seasonTournaments(season) {
  const queries = await pageQueries('https://www.pgatour.com/schedule/' + season);
  const s = (pick(queries, 'schedule') || {}).data;
  if (!s || !Array.isArray(s.tournaments)) throw new Error('No schedule data for ' + season + ' on pgatour.com.');
  return s.tournaments.map(t => ({ id: t.tournamentId, name: t.name, status: t.status, displayDate: t.displayDate }));
}

// Sends results ({tournament,date,rows}) or a schedule ({events}) to the Sheet's Apps Script. Returns its reply.
async function postToSheet(data, token) {
  if (!token) throw new Error('No FGT_RESULTS_TOKEN.');
  const body = Object.assign({}, data, { action: data.events ? 'schedule' : 'results', token });
  const res = await fetch(scriptUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
  const text = await res.text();
  let j; try { j = JSON.parse(text); } catch (e) { throw new Error('Sheet replied with something that is not JSON: ' + text.slice(0, 120)); }
  if (!j.ok) throw new Error('Sheet refused: ' + (j.error || text.slice(0, 120)));
  return j;
}

// Saves the live dashboard feed as site/data/dashboard.json, refusing anything that looks like personal details.
async function saveSnapshot() {
  const text = await (await fetch(scriptUrl() + '?view=dashboard')).text();
  const d = JSON.parse(text);
  if (!d.ok || !Array.isArray(d.standings)) throw new Error('Feed did not return dashboard data: ' + text.slice(0, 120));
  const bad = [
    [/[\w.+-]+@[\w-]+\.[\w.]+/, 'an email address'],
    [/\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}/, 'a phone number'],
    [/"[0-9a-f]{8}"/, 'an Entry ID']
  ].filter(([re]) => re.test(text));
  if (bad.length) throw new Error('Not writing the snapshot: the feed seems to contain ' + bad.map(b => b[1]).join(', ') + '.');
  fs.mkdirSync(ROOT + '/site/data', { recursive: true });
  fs.writeFileSync(ROOT + '/site/data/dashboard.json', text);
  const events = new Set(d.results.map(r => r.event)).size;
  return 'Saved site/data/dashboard.json: ' + d.standings.length + ' teams, ' + events + ' events, lineups ' +
    (d.closed ? 'shown' : 'hidden') + ', ' + Math.round(text.length / 1024) + ' KB';
}

module.exports = { ROOT, pullResults, seasonTournaments, postToSheet, saveSnapshot, finishDate };
