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

// "Not ready yet" errors: the event is not official, or pgatour.com's past-results page (the one with the money) has not
// caught up. It often lags the event going official by hours. Callers can wait and retry instead of treating it as broken.
const notReady = msg => Object.assign(new Error(msg), { notReady: true });

// One finished event's full field. Throws (and writes nothing) if not official yet, the results are for another
// event/season, or the money looks incomplete. opts.purse (the event's purse, or last year's) enables the money check.
async function pullResults(url, opts) {
  opts = opts || {};
  const m = url.match(/\/tournaments\/(\d{4})\/[^/]+\/(R\d+)/);
  if (!m) throw new Error('Not a pgatour.com tournament URL (expected .../tournaments/<year>/<slug>/<R id>/...).');
  const [, year, tid] = m;
  const queries = await pageQueries(url);
  const t = (pick(queries, 'tournament', k => k && k.id === tid) || {}).data;
  const pr = (pick(queries, 'pastResults', k => k && k.tournamentPastResultsId === tid) || {}).data;
  if (!t || !pr) throw new Error('Could not find the tournament or its results in the page data.');
  if (t.tournamentStatus !== 'COMPLETED') throw notReady('Not official yet: status is ' + t.tournamentStatus + '.');
  if (pr.id !== tid) throw notReady('The past-results page still shows ' + pr.id + ', not ' + tid + ' (last year\'s results; pgatour.com has not updated it yet).');
  const seasons = (pr.availableSeasons || []).map(s => s.displaySeason);
  if (seasons.length && !seasons.includes(String(t.seasonYear || year))) throw notReady('Results season ' + seasons.join(',') + ' does not match ' + (t.seasonYear || year) + '.');
  const hdr = pr.additionalDataHeaders || [];
  const mi = hdr.findIndex(h => /money/i.test(h));
  if (mi < 0) throw notReady('No "Official Money" column on the past-results page yet (headers: ' + (hdr.join(', ') || 'none') + ').');
  const rows = (pr.players || []).map(p => {
    let e = money((p.additionalData || [])[mi]);
    if (opts.halve) e = Math.round(e / 2 * 100) / 100;
    return { golfer: p.player.displayName, finish: p.position, earnings: e };
  });
  // Amateurs play but can't take prize money (pgatour.com shows them at $0 and pays their share to the pros), so the
  // checks below look at the best-placed professional, not position 1. An amateur can win (Dunlap, 2024 AmEx).
  const isAm = (pr.players || []).map(p => !!(p.player && p.player.amateur));
  const topPro = rows.find((r, i) => !isAm[i]);
  const ams = rows.filter((r, i) => isAm[i]);
  const out = { tournament: opts.name || t.tournamentName, date: finishDate(t.displayDate), rows,
    story: opts.halve || (pr.teams && pr.teams.length) ? '' : storyFromRounds(pr.players, opts.name || t.tournamentName),
    lowRounds: opts.halve ? [] : lowRounds(pr.players) };
  const paid = rows.filter(r => r.earnings > 0), total = paid.reduce((s, r) => s + r.earnings, 0);
  // Money not (fully) posted yet: too few golfers paid, the winner shows $0, or far less than the purse paid out.
  const fmt = n => '$' + Math.round(n).toLocaleString('en-US');
  // (Small fields such as the TOUR Championship's 30: most of the field paid is enough.)
  const pros = rows.length - ams.length;
  if ((paid.length < 30 && paid.length < 0.8 * pros) || !(topPro && topPro.earnings > 0))
    throw notReady('The past-results page lists ' + rows.length + ' golfers but only ' + paid.length + ' with money' +
      (topPro && !topPro.earnings ? ' and the top professional (' + topPro.golfer + ') at $0' : '') + '; the money is probably not posted yet.');
  const purse = Number(opts.purse) || 0;   // team events: halved golfer shares still add up to the team purse
  if (purse && total < 0.7 * purse)
    throw notReady('Money on the past-results page adds up to ' + fmt(total) + ', under 70% of the ' + fmt(purse) + ' purse; probably not fully posted yet.');
  const by = f => rows.filter(r => r.finish === f).length;
  const summary = out.tournament + ' (' + out.date + '): ' + rows.length + ' golfers, ' + paid.length + ' with money ($' +
    total.toLocaleString('en-US') + '), ' + by('CUT') + ' cut, ' + by('W/D') + ' withdrew' + (opts.halve ? ', money halved (team event)' : '') +
    '. Winner: ' + (rows[0] ? rows[0].golfer + (isAm[0] ? ' (amateur, no prize money)' : '') + ' $' + rows[0].earnings.toLocaleString('en-US') : '-') +
    (isAm[0] && topPro ? '. Top professional: ' + topPro.golfer + ' (' + topPro.finish + ') $' + topPro.earnings.toLocaleString('en-US') : '') +
    (ams.length ? '. Amateurs at $0: ' + ams.length : '') +
    (pr.teams && !opts.halve ? '. NOTE: this event lists teams; if it is the Zurich Classic, use --halve.' : '');
  return { out, summary, tournamentName: t.tournamentName };
}

// Last name from the full name: the last word, plus a lowercase particle ("van Rooyen") or a suffix ("Love III").
// (pgatour.com's own short name is unreliable: "S. Woo Kim".)
function lastName(pl) {
  const d = String(pl.displayName || '').trim().split(/\s+/);
  if (d.length < 2) return d[0] || '';
  let k = d.length - 1;
  if (/^(Jr\.?|Sr\.?|I{2,3}|IV)$/i.test(d[k]) && k > 1) k--;
  while (k > 1 && /^[a-z]/.test(d[k - 1])) k--;
  return d.slice(k).join(' ');
}

// A short "how the tournament was won" blurb from round-by-round scores (the past-results page has no hole-by-hole
// data). Cases: playoff, wire-to-wire, comeback from behind after the second-to-last round, a fading leader, held on.
// Uses last names only and no pronouns. Returns '' when the data is too thin (or for team events).
function storyFromRounds(players, eventName) {
  const num = v => { const t = String(v == null ? '' : v).trim(); if (t === 'E') return 0; const n = Number(t.replace('+', '')); return t === '' || t === '-' || isNaN(n) ? null : n; };
  const ps = (players || []).map(p => ({ name: p.player.displayName, last: lastName(p.player), am: !!p.player.amateur,
    pos: String(p.position || ''), rounds: (p.rounds || []).map(r => ({ score: Number(r.score) || null, par: num(r.parRelativeScore) })), total: num(p.parRelativeScore) }))
    .filter(p => p.name && p.rounds.length && p.rounds[0].par != null);
  const w = ps.find(p => p.pos === '1') || ps[0];
  if (!w || w.total == null) return '';
  const N = w.rounds.filter(r => r.par != null).length;
  if (N < 2) return '';
  const cum = (p, k) => { let s = 0; for (let i = 0; i < k; i++) { if (!p.rounds[i] || p.rounds[i].par == null) return null; s += p.rounds[i].par; } return s; };
  const standing = k => {   // after round k: best score, and each player's shots back and place
    const field = ps.map(p => ({ p, c: cum(p, k) })).filter(x => x.c != null);
    const best = Math.min(...field.map(x => x.c));
    return { best, field, back: p => cum(p, k) - best, place: p => 1 + field.filter(x => x.c < cum(p, k)).length,
      leaders: field.filter(x => x.c === best).map(x => x.p) };
  };
  const par = n => n === 0 ? 'even par' : (n > 0 ? '+' : '') + n;
  const shots = n => n === 1 ? 'one shot' : n + ' shots';
  const ord = n => { const t = n % 100; return n + (t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'); };
  const placeText = (n, tied) => tied ? 'T' + n : ord(n);   // golf style: T7, 3rd
  const others = ps.filter(p => p !== w && p.total != null);
  const runnerUp = Math.min(...others.map(p => p.total));
  const margin = runnerUp - w.total, chasers = others.filter(p => p.total === runnerUp);
  const last = w.rounds[N - 1], lastRound = ps.map(p => p.rounds[N - 1]).filter(r => r && r.score).map(r => r.score);
  const lowOfDay = last.score && last.score === Math.min(...lastRound);
  const pen = standing(N - 1), backPen = pen.back(w), placePen = pen.place(w);
  const ledAll = Array.from({ length: N - 1 }, (_, i) => standing(i + 1).back(w) === 0).every(Boolean);
  const soloAll = ledAll && Array.from({ length: N - 1 }, (_, i) => standing(i + 1).leaders.length === 1).every(Boolean);
  const finalRd = 'a final-round ' + (last.score || '') + ' (' + par(last.par) + ')' + (lowOfDay ? ', the low round of the day' : '');
  const names = list => list.map(p => p.last).join(list.length > 2 ? ', ' : ' and ');
  const theEv = /^the\s/i.test(eventName) ? eventName : 'the ' + eventName;   // "won the 3M Open", "won The American Express"
  const out = [];
  const winBy = margin === 0 ? 'in a playoff over ' + names(chasers) + ' after they finished tied at ' + par(w.total)
    : 'at ' + par(w.total) + ', ' + shots(margin) + ' clear of ' + names(chasers.slice(0, 3)) + (chasers.length > 3 ? ' and others' : '');
  if (ledAll && margin > 0) {
    out.push(w.name + ' went wire to wire at ' + theEv + ', ' + (soloAll ? 'leading alone' : 'leading or sharing the lead') + ' after every round, and won ' + winBy + '.');
  } else if (backPen > 0) {
    out.push(w.name + ' came from ' + shots(backPen) + ' back (' + placeText(placePen, pen.field.filter(x => x.c === cum(w, N - 1)).length > 1) +
      ') going into the final round and won ' + theEv + ' ' + winBy + ', with ' + finalRd + '.');
  } else {
    const lead = Math.min(...pen.field.filter(x => x.p !== w).map(x => x.c)) - cum(w, N - 1);
    out.push(w.name + (lead > 0 ? ' took a ' + shots(lead).replace(' shots', '-shot').replace('one shot', 'one-shot') + ' lead into the final round' : ' started the final round tied for the lead') +
      ' and ' + (margin === 0 ? 'won ' + theEv + ' ' + winBy : (margin <= 1 ? 'held on to win ' : 'won ') + theEv + ' ' + winBy) + ', closing with ' + (last.score || '') + ' (' + par(last.par) + ').');
  }
  // The leader(s) going into the final round who didn't win, and how they finished.
  if (backPen > 0) {
    const fin = p => { const m = p.pos.match(/^(T?)(\d+)$/); return m ? placeText(Number(m[2]), !!m[1]) : p.pos; };
    const faded = pen.leaders.map(p => {
      const r = p.rounds[N - 1];
      if (!r || r.par == null) return null;
      const sc = r.score + ' (' + par(r.par) + ')';
      if (margin === 0 && chasers.indexOf(p) >= 0) return p.last + ' shot ' + sc + ' and lost the playoff';
      const melt = r.par >= 3 || (r.par >= 1 && p.total - w.total >= 4);
      return p.last + (melt ? ' fell apart with ' : ' could only manage ') + sc + ' to finish ' + fin(p);
    }).filter(Boolean);
    const who = N - 1 === 3 ? '54-hole leader' : 'overnight leader';
    if (faded.length === 1) out.push(who.charAt(0).toUpperCase() + who.slice(1) + ' ' + faded[0] + '.');
    else if (faded.length) out.push('Of the ' + who.replace('leader', 'co-leaders') + ', ' + faded.join('; ') + '.');
  }
  if (w.am) {
    out[0] = 'Amateur ' + out[0];
    const pro = ps.filter(p => !p.am && p.total != null).sort((a, b) => a.total - b.total)[0];
    if (pro) { const m = String(pro.pos).match(/^(T?)(\d+)$/); out.push('Amateurs can\'t take prize money, so the pros were paid as if ' + w.last + ' weren\'t in the field: ' + pro.last + ' (' + (m ? placeText(Number(m[2]), !!m[1]) : pro.pos) + ') got the winner\'s share.'); }
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

// The 15 lowest single rounds of the week (for the recap's "low round by someone you picked" line).
function lowRounds(players) {
  const out = [];
  (players || []).forEach(p => (p.rounds || []).forEach((r, i) => {
    const sc = Number(r.score), par = String(r.parRelativeScore || '').trim();
    if (sc > 0) out.push({ golfer: p.player.displayName, round: i + 1, score: sc, par: par === 'E' ? 0 : Number(par.replace('+', '')) || 0 });
  }));
  return out.sort((a, b) => a.par - b.par || a.score - b.score).slice(0, 15);
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
// The live dashboard feed from the Apps Script: { text, data }.
async function liveFeed() {
  const text = await (await fetch(scriptUrl() + '?view=dashboard')).text();
  let d; try { d = JSON.parse(text); } catch (e) { throw new Error('Feed replied with something that is not JSON: ' + text.slice(0, 120)); }
  if (!d.ok || !Array.isArray(d.standings)) throw new Error('Feed did not return dashboard data: ' + text.slice(0, 120));
  return { text, data: d };
}

async function saveSnapshot() {
  const { text, data: d } = await liveFeed();
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

module.exports = { ROOT, pullResults, seasonTournaments, postToSheet, saveSnapshot, liveFeed, finishDate, storyFromRounds };
