// The weekly results run (used by the "Weekly results" GitHub job, and can be run by hand):
//   1. finds FGT events from data/schedule-2027.json that finished in the last few days,
//   2. checks pgatour.com's schedule for their status, and for each one that is official (COMPLETED)
//      pulls the full field and sends it to the Sheet (re-sending replaces that event's rows, so repeats are safe),
//   3. saves the dashboard snapshot (site/data/dashboard.json) if anything was sent,
//   4. catch-up and alarm: any FGT event that finished 2+ days ago but has no results in the Sheet is retried, and if it
//      is still missing the run fails, so GitHub emails Tom (a run that quietly posts nothing would otherwise look fine).
// Usage: FGT_RESULTS_TOKEN=... node tools/weekly-update.js [--days 3] [--event "Exact Schedule name"] [--dry-run] [--check]
// --check only tests the token by resending data/schedule-2027.json (no results change).
const fs = require('fs');
const { ROOT, pullResults, seasonTournaments, postToSheet, saveSnapshot, liveFeed } = require('./fgt-lib');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const days = Number(opt('--days') || 3), only = opt('--event'), dry = args.includes('--dry-run');
const log = [];
const say = s => { console.log(s); log.push(s); };
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const iso = d => d.toISOString().slice(0, 10);

(async () => {
  if (!process.env.FGT_RESULTS_TOKEN && !dry) { say('Stopped: the FGT_RESULTS_TOKEN secret is missing or empty.'); return finish(1); }
  if (args.includes('--check')) {
    // Token check: resend the schedule file (same data, so nothing changes) and report whether the Sheet accepted it.
    const r = await postToSheet(JSON.parse(fs.readFileSync(ROOT + '/data/schedule-2027.json', 'utf8')), process.env.FGT_RESULTS_TOKEN);
    say('Token check passed: the Sheet accepted the schedule (' + r.stored + ' events).');
    return finish(0);
  }
  const sched = JSON.parse(fs.readFileSync(opt('--schedule') || (ROOT + '/data/schedule-2027.json'), 'utf8')).events;   // --schedule: another file, for testing
  const now = new Date(), from = iso(new Date(now.getTime() - days * 86400000)), to = iso(now);
  const overdue = iso(new Date(now.getTime() - 2 * 86400000));   // finished 2+ days ago: results should be in by now
  let problems = 0, have = null;
  if (!only) {
    try { have = new Set((await liveFeed()).data.results.map(r => r.event)); }
    catch (err) { say('- Could not read the Sheet to check for missing events: ' + err.message); problems++; }
  }
  const missing = e => have && e.counts === 'Yes' && e.finish <= overdue && !have.has(e.event);
  const due = sched.filter(e => only ? e.event === only : (e.counts === 'Yes' && e.finish >= from && e.finish <= to) || missing(e));
  if (!due.length) { say(only ? 'No Schedule event named "' + only + '".' : 'No FGT events finished between ' + from + ' and ' + to + (have ? ', and none are missing from the Sheet. Nothing to do.' : '.')); return finish(problems ? 1 : 0); }
  const bySeason = {}, done = new Set();
  let sent = 0;
  for (const e of due) {
    if (!only && e.finish < from) say('- ' + e.event + ' (finished ' + e.finish + ') has no results in the Sheet yet. Catching up.');
    const season = e.finish.slice(0, 4);
    bySeason[season] = bySeason[season] || await seasonTournaments(season);
    // Match on pgatour.com's full name (pgaName) when the Schedule uses a shorter one; results are stored under the short name.
    const t = bySeason[season].find(x => norm(x.name) === norm(e.pgaName || e.event));
    if (!t) { say('- ' + e.event + ': not found on pgatour.com\'s ' + season + ' schedule. Check the name.'); problems++; continue; }
    if (t.status !== 'COMPLETED') { say('- ' + e.event + ': not official yet (' + t.status + '). Will try again on the next run.'); continue; }   // the MISSING check below catches it if this lasts
    try {
      const url = 'https://www.pgatour.com/tournaments/' + season + '/event/' + t.id + '/past-results';
      const r = await pullResults(url, { name: e.event, halve: /team event/i.test(e.notes || ''), purse: e.purse || e.refPurse });
      if (dry) { say('- (dry run) ' + r.summary + (r.out.story ? '\n  Story: ' + r.out.story : '')); continue; }
      const reply = await postToSheet(r.out, process.env.FGT_RESULTS_TOKEN);
      sent++; done.add(e.event);
      say('- Sent ' + r.summary + ' Sheet stored ' + reply.stored + ' rows' +
        (reply.notOnGolfersTabWithMoney && reply.notOnGolfersTabWithMoney.length ? '; golfers with money not on the points list: ' + reply.notOnGolfersTabWithMoney.join(', ') : '') + '.' + (r.out.story ? '\n  Story: ' + r.out.story : ''));
    } catch (err) {
      // pgatour.com's money page lagging is normal on Sunday: wait for the next run. The MISSING check below still
      // fails the run if the event is 2+ days old and nothing has reached the Sheet.
      if (err.notReady) say('- ' + e.event + ': results not ready yet. ' + err.message + ' Will try again on the next run.');
      else { say('- ' + e.event + ': ' + err.message); problems++; }
    }
  }
  if (sent) say(await saveSnapshot());
  // Alarm: anything still missing makes the run fail, so GitHub emails Tom.
  for (const e of sched.filter(e => missing(e) && !done.has(e.event))) {
    say('- MISSING: ' + e.event + ' finished ' + e.finish + ' but its results are not in the Sheet. Check the run log above, or load it by hand (Actions > Weekly results > Run workflow, event "' + e.event + '").');
    problems++;
  }
  finish(problems ? 1 : 0);
})().catch(e => { say('Stopped: ' + e.message); finish(1); });

function finish(code) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### FGT weekly results\n\n' + log.join('\n') + '\n');
  process.exit(code);
}
