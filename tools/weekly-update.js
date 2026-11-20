// The weekly results run (used by the "Weekly results" GitHub job, and can be run by hand):
//   1. finds FGT events from data/schedule-2027.json that finished in the last few days,
//   2. checks pgatour.com's schedule for their status, and for each one that is official (COMPLETED)
//      pulls the full field and sends it to the Sheet (re-sending replaces that event's rows, so repeats are safe),
//   3. saves the dashboard snapshot (site/data/dashboard.json) if anything was sent.
// Usage: FGT_RESULTS_TOKEN=... node tools/weekly-update.js [--days 3] [--event "Exact Schedule name"] [--dry-run] [--check]
// --check only tests the token by resending data/schedule-2027.json (no results change).
const fs = require('fs');
const { ROOT, pullResults, seasonTournaments, postToSheet, saveSnapshot } = require('./fgt-lib');
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
  const due = sched.filter(e => only ? e.event === only : (e.counts === 'Yes' && e.finish >= from && e.finish <= to));
  if (!due.length) { say(only ? 'No Schedule event named "' + only + '".' : 'No FGT events finished between ' + from + ' and ' + to + '. Nothing to do.'); return finish(0); }
  const bySeason = {};
  let sent = 0, problems = 0;
  for (const e of due) {
    const season = e.finish.slice(0, 4);
    bySeason[season] = bySeason[season] || await seasonTournaments(season);
    const t = bySeason[season].find(x => norm(x.name) === norm(e.event));
    if (!t) { say('- ' + e.event + ': not found on pgatour.com\'s ' + season + ' schedule. Check the name.'); problems++; continue; }
    if (t.status !== 'COMPLETED') { say('- ' + e.event + ': not official yet (' + t.status + '). Will try again on the next run.'); continue; }
    try {
      const url = 'https://www.pgatour.com/tournaments/' + season + '/event/' + t.id + '/past-results';
      const r = await pullResults(url, { name: e.event, halve: /team event/i.test(e.notes || '') });
      if (dry) { say('- (dry run) ' + r.summary); continue; }
      const reply = await postToSheet(r.out, process.env.FGT_RESULTS_TOKEN);
      sent++;
      say('- Sent ' + r.summary + ' Sheet stored ' + reply.stored + ' rows' +
        (reply.notOnGolfersTabWithMoney && reply.notOnGolfersTabWithMoney.length ? '; golfers with money not on the points list: ' + reply.notOnGolfersTabWithMoney.join(', ') : '') + '.');
    } catch (err) { say('- ' + e.event + ': ' + err.message); problems++; }
  }
  if (sent) say(await saveSnapshot());
  finish(problems ? 1 : 0);
})().catch(e => { say('Stopped: ' + e.message); finish(1); });

function finish(code) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### FGT weekly results\n\n' + log.join('\n') + '\n');
  process.exit(code);
}
