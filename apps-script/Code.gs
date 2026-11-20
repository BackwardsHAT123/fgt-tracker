/**
 * FGT team entry receiver. Bound to a Google Sheet; deployed as a Web App.
 * Appends one row per submitted team to the "Entries" tab.
 * Setup steps are in the repo README.
 */

var SHEET_NAME = 'Entries';
var BUDGET = 25;
// Set to a date to reject entries after it, e.g. new Date('2027-01-14T23:59:59-07:00'). null = no deadline.
var DEADLINE = null;

var HEADERS = [
  'Timestamp', 'Name', 'Phone', 'Email', 'Address', 'Team Name',
  'Points Used', '# Golfers', 'Golfers', 'Lineup Key', 'Duplicate Of Row', 'Points Version', 'Entry ID', 'Paid'
];

// Weekly prize money for the team that wins each event (rules sheet), by event type on the Schedule tab.
// FedExCup playoff events (FedEx St. Jude, BMW) pay $200 like Signature Events (Tom, Nov 20 2026).
// Majors also pay 2nd place. Teams tied on money split the prizes for the places they share.
var PRIZES = { regular: [150], signature: [200], players: [200], playoff: [200], major: [300, 100] };

// Confirmation email sent to each player after they enter (from the Google account that owns this script).
var VENMO_HANDLE = 'Thomas-E-OToole', ENTRY_FEE = 100, CONTACT = 'FGT_MT@outlook.com',
    TRACKER_URL = 'https://fgt-mt.com/dashboard.html';

// Other tabs. Only "Entries" holds contact info; Standings and Lineups carry team and name only,
// so a dashboard can read them without seeing phones or emails.
var TABS = {
  Golfers:     ['Golfer', 'Points', 'Group', 'Version'],
  // One row per golfer per event. Type the golfer's prize money. Each event gets its own Tournament
  // name, even when two events run the same weekend (they are scored as separate events).
  Tournaments: ['Tournament', 'Date', 'Golfer', 'Finish', 'Earnings'],
  Lineups:     ['Entry ID', 'Team Name', 'Golfer', 'Points', 'Season Earnings'],
  // One row per event per team (made by "Update event scores"). Highest earnings wins the event.
  EventScores: ['Tournament', 'Entry ID', 'Team Name', 'Earnings', 'Event Rank', 'Pot Share', 'Prize'],
  Standings:   ['Rank', 'Entry ID', 'Team Name', 'Name', 'Points Used', '# Golfers', 'Season Earnings', 'Event Wins', 'Paid Spot', 'Weekly Winnings'],
  Settings:    ['Setting', 'Value'],
  // The season's events, loaded from pgatour.com by the schedule feed. "Purse" stays blank until the Tour posts it;
  // "Reference Purse 2026" is last year's purse for the same event. Same-weekend events are separate rows.
  Schedule:    ['Event', 'Finish Date', 'Purse', 'Reference Purse 2026', 'Counts for FGT', 'Notes', 'Type']
};

function doGet(e) {
  if (e && e.parameter && e.parameter.view === 'dashboard') return json_(dashboardData_());
  return json_({ ok: true, message: 'FGT entry endpoint is running.' });
}

// Read-only data for the public dashboard (site/dashboard.html). PRIVACY: team names only. It never reads the
// Entries tab, and it leaves out the Standings "Name" column and Entry IDs. Lineups (which golfers each team
// picked) are withheld until entries are closed: Settings B5 = Yes, or the DEADLINE has passed.
function dashboardData_() {
  var set = tab_('Settings');
  var flag = String(set.getRange(5, 2).getValue() || '').trim().toLowerCase();
  var closed = flag === 'yes' || !!(DEADLINE && new Date() > DEADLINE);
  var paid = set.getRange(2, 2).getValue();

  function rows_(name, cols) {
    var sh = tab_(name), last = sh.getLastRow();
    if (last < 2) return [];
    return sh.getRange(2, 1, last - 1, cols).getValues();
  }
  function day_(v) {
    return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(v || '');
  }

  var standings = rows_('Standings', 10).filter(function (r) { return r[2]; }).map(function (r) {
    return { rank: r[0], team: String(r[2]), earnings: Number(r[6]) || 0, wins: Number(r[7]) || 0, paid: r[8] === 'Yes',
             winnings: Number(r[9]) || 0 };
  });
  var schedule = rows_('Schedule', 7).filter(function (r) { return r[0]; }).map(function (r) {
    return { event: String(r[0]), finish: day_(r[1]), purse: Number(r[2]) || 0, counts: String(r[4]), type: String(r[6] || 'regular') };
  });
  var eventScores = rows_('EventScores', 7).filter(function (r) { return r[0]; }).map(function (r) {
    return { event: String(r[0]), team: String(r[2]), earnings: Number(r[3]) || 0, rank: Number(r[4]) || 0, share: Number(r[5]) || 0,
             prize: Number(r[6]) || 0 };
  });
  var results = rows_('Tournaments', 5).filter(function (r) { return r[0]; }).map(function (r) {
    return { event: String(r[0]), date: day_(r[1]), golfer: String(r[2]), finish: String(r[3]), earnings: Number(r[4]) || 0 };
  });
  var golfers = rows_('Golfers', 2).map(function (r) { return { golfer: String(r[0]), points: Number(r[1]) || 0 }; });
  var lineups = !closed ? [] : rows_('Lineups', 4).filter(function (r) { return r[1]; }).map(function (r) {
    return { team: String(r[1]), golfer: String(r[2]), points: Number(r[3]) || 0 };
  });

  return {
    ok: true, generated: new Date().toISOString(), closed: closed,
    paidSpots: typeof paid === 'number' ? paid : 0, prizes: PRIZES,
    standings: standings, schedule: schedule, eventScores: eventScores,
    results: results, golfers: golfers, lineups: lineups
  };
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var d = JSON.parse(e.postData.contents);

    if (d.action === 'results') return saveResults_(d); // weekly prize money from the PGA Tour page
    if (d.action === 'schedule') return saveSchedule_(d); // season schedule from the PGA Tour page

    if (d.website) return json_({ ok: true }); // honeypot tripped: pretend success, store nothing

    if (DEADLINE && new Date() > DEADLINE) return json_({ ok: false, error: 'Entries are closed.' });

    var name = clean_(d.name), phone = clean_(d.phone), email = clean_(d.email);
    var team = clean_(d.teamName), address = clean_(d.address);
    if (!name || !phone || !email || !team) return json_({ ok: false, error: 'Missing required fields.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json_({ ok: false, error: 'Invalid email.' });
    var digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) return json_({ ok: false, error: 'Invalid phone number.' });

    var golfers = (d.golfers || []).map(function (g) {
      return { name: clean_(g.name), points: Number(g.points) };
    }).filter(function (g) { return g.name && g.points >= 1 && g.points <= 6; });
    if (!golfers.length) return json_({ ok: false, error: 'No golfers selected.' });
    if (golfers.length > 25) return json_({ ok: false, error: 'Too many golfers.' });

    // Recompute the total here; never trust the client's number. (Per-golfer values still come from the page.)
    var total = golfers.reduce(function (s, g) { return s + g.points; }, 0);
    if (total > BUDGET) return json_({ ok: false, error: 'Team is over ' + BUDGET + ' points.' });

    var sheet = sheet_();
    var key = golfers.map(function (g) { return fold_(g.name); }).sort().join('|');

    // Identical-lineup check (rule: first one in keeps the team). Runs inside the script lock, so two
    // identical teams submitted at the same moment can't both get in. The duplicate is NOT saved.
    var last = sheet.getLastRow();
    if (last > 1) {
      var keys = sheet.getRange(2, 10, last - 1, 1).getValues();
      for (var i = 0; i < keys.length; i++) {
        if (keys[i][0] === key) {
          return json_({
            ok: false,
            duplicate: true,
            error: 'Another team has this exact lineup. Change at least one golfer (up to 10 points\' worth).'
          });
        }
      }
    }

    var list = golfers
      .sort(function (a, b) { return b.points - a.points || a.name.localeCompare(b.name); })
      .map(function (g) { return g.name + ' (' + g.points + ')'; }).join(', ');

    var entryId = Utilities.getUuid().slice(0, 8);
    sheet.appendRow([
      new Date(), name, phone, email, address, team,
      total, golfers.length, list, key, '', clean_(d.pointsVersion), entryId, false
    ]);
    try { sheet.getRange(sheet.getLastRow(), 14).insertCheckboxes(); } catch (x) {}

    // The entry is already saved. A problem in the extra tabs must never lose it or fail the submit;
    // "FGT > Rebuild Lineups and Standings" repairs them from Entries.
    try {
      addLineup_(entryId, team, golfers);
      addStanding_(entryId, team, name, total, golfers.length);
    } catch (x) {}
    // Confirmation email. Never fails the entry (Gmail limits personal accounts to about 100 emails a day).
    try { sendConfirmation_(email, name, team, list, total); } catch (x) {}
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'Server error. Please try again.' });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// ---- Extra tabs -------------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('FGT')
    .addItem('Set up tabs', 'setupSheets')
    .addItem('Refresh Golfers tab', 'refreshGolfers')
    .addItem('Update event scores', 'refreshEventScores')
    .addItem('Rebuild Lineups and Standings', 'rebuildLineupsAndStandings')
    .addItem('Send me a test confirmation email', 'sendTestConfirmation')
    .addToUi();
}

function tab_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    var h = TABS[name];
    sh = ss.insertSheet(name);
    sh.appendRow(h);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, h.length).setFontWeight('bold');
  }
  return sh;
}

// Safe to run any time: creates missing tabs, adds the Entry ID header, fills the Golfers tab.
function sendConfirmation_(email, name, team, list, total) {
  var first = String(name).split(' ')[0];
  var body = [
    'Hi ' + first + ',',
    '',
    'Your Fantasy Golf Tour team is in. Here is what we received:',
    '',
    'Team name: ' + team,
    'Golfers: ' + list,
    'Points used: ' + total + ' of ' + BUDGET,
    '',
    'Entry fee: $' + ENTRY_FEE + ' by Venmo to @' + VENMO_HANDLE + ' (please put your team name in the note).',
    'Your team is final once the first tournament begins.',
    '',
    'Follow the season at ' + TRACKER_URL,
    'Questions or a mistake in your team? Reply to this email or write to ' + CONTACT + '.',
    '',
    'Good luck!',
    'Fantasy Golf Tour'
  ].join('\n');
  MailApp.sendEmail({ to: email, subject: 'FGT entry received: ' + team, body: body, name: 'Fantasy Golf Tour', replyTo: CONTACT });
}

// Sends one test confirmation to the script owner's own address, so Tom can see the email and approve Gmail access.
function sendTestConfirmation() {
  var me = Session.getEffectiveUser().getEmail();
  sendConfirmation_(me, 'Test Player', 'Test Team (not a real entry)', 'Scottie Scheffler (6), Chad Ramey (3)', 9);
  SpreadsheetApp.getUi().alert('Test email sent to ' + me + '.');
}

function setupSheets() {
  var entries = sheet_();
  if (entries.getRange(1, 13).getValue() !== 'Entry ID') {
    entries.getRange(1, 13).setValue('Entry ID').setFontWeight('bold');
  }
  // Paid: a checkbox per entry for tracking Venmo payments. Private: the dashboard never reads the Entries tab.
  if (entries.getRange(1, 14).getValue() !== 'Paid') entries.getRange(1, 14).setValue('Paid').setFontWeight('bold');
  if (entries.getLastRow() > 1) {
    var pc = entries.getRange(2, 14, entries.getLastRow() - 1, 1);
    if (!pc.getDataValidation()) pc.insertCheckboxes();
  }
  Object.keys(TABS).forEach(tab_);
  fixHeaders_();
  var t = tab_('Tournaments');
  t.getRange('B:B').setNumberFormat('yyyy-mm-dd');
  t.getRange('E:E').setNumberFormat('$#,##0');
  var set = tab_('Settings');
  var label = 'Season paid spots (set after entries close)';
  if (set.getRange(2, 1).getValue() !== label) {
    set.getRange(2, 1, 3, 2).clearContent();
    set.getRange(2, 1, 3, 1).setValues([[label], ['Teams entered'], ['Reference: 17.5% of teams entered']]);
    set.getRange(3, 2).setFormula('=COUNTA(Standings!$B$2:$B$1000)');
    set.getRange(4, 2).setFormula('=ROUND(B3*0.175,0)');
    set.getRange(2, 2).setNumberFormat('0'); // leave blank until the number of paid teams is decided
  }
  if (!set.getRange(5, 1).getValue()) {
    set.getRange(5, 1).setValue('Entries closed (type Yes to show lineups on the dashboard)');
  }
  refreshGolfers();
  rebuildLineupsAndStandings();
}

// Brings the header row of each extra tab up to date (tabs made by an older version have old headers).
// A Tournaments tab that already has results is left alone, so typed data can't end up under wrong headers.
function fixHeaders_() {
  Object.keys(TABS).forEach(function (name) {
    var sh = tab_(name), h = TABS[name];
    if (name === 'Tournaments' && sh.getLastRow() > 1) return;
    var width = Math.max(sh.getMaxColumns(), h.length);
    sh.getRange(1, 1, 1, width).clearContent();
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
  });
}

// Replaces the Golfers tab contents with the list in Golfers.gs (generated from site/players.js).
function refreshGolfers() {
  var sh = tab_('Golfers');
  sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), TABS.Golfers.length).clearContent();
  var rows = GOLFERS.map(function (g) { return [g[0], g[1], g[2], GOLFERS_VERSION]; });
  sh.getRange(2, 1, rows.length, 4).setValues(rows);
}

function lineupFormula_(row) {
  return '=SUMIF(Tournaments!$C:$C,C' + row + ',Tournaments!$E:$E)';
}

function addLineup_(entryId, team, golfers) {
  var sh = tab_('Lineups');
  var start = sh.getLastRow() + 1;
  var vals = golfers.map(function (g) { return [entryId, team, g.name, g.points]; });
  sh.getRange(start, 1, vals.length, 4).setValues(vals);
  var f = golfers.map(function (g, i) { return [lineupFormula_(start + i)]; });
  sh.getRange(start, 5, f.length, 1).setFormulas(f);
}

function addStanding_(entryId, team, name, total, count) {
  var sh = tab_('Standings');
  var row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, 10).setValues([['', entryId, team, name, total, count, '', '', '', '']]);
  var r = String(row);
  sh.getRange(row, 7).setFormula('=SUMIF(Lineups!$A:$A,B' + r + ',Lineups!$E:$E)').setNumberFormat('$#,##0');
  sh.getRange(row, 1).setFormula('=IF(B' + r + '="","",RANK(G' + r + ',$G$2:$G$1000))');
  sh.getRange(row, 8).setFormula('=SUMIF(EventScores!$B:$B,B' + r + ',EventScores!$F:$F)').setNumberFormat('0.0#');
  // Paid Spot: blank until Tom types the number of paid teams on the Settings tab (B2).
  sh.getRange(row, 9).setFormula('=IF(AND(ISNUMBER(Settings!$B$2),G' + r + '>0,A' + r + '<=Settings!$B$2),"Yes","")');
  sh.getRange(row, 10).setFormula('=SUMIF(EventScores!$B:$B,B' + r + ',EventScores!$G:$G)').setNumberFormat('$#,##0');
}

// Receives one event's results: {action:'results', token, tournament, date:'YYYY-MM-DD', rows:[{golfer, finish, earnings}]}.
// Needs a Script Property named RESULTS_TOKEN (Project Settings > Script properties) and the same token in the request,
// so only Tom's tools can write results. Sending the same tournament again replaces its rows, so re-runs are safe.
// Keeps only golfers that matter (on the Golfers tab, in some lineup, or with earnings > 0). Names are matched to the
// spelling already used in Golfers/Lineups, ignoring case, accents and punctuation.
function saveResults_(d) {
  var want = PropertiesService.getScriptProperties().getProperty('RESULTS_TOKEN');
  if (!want || String(d.token) !== want) return json_({ ok: false, error: 'Not authorized.' });
  var name = String(d.tournament || '').trim().slice(0, 200);
  if (!name || !d.rows || !d.rows.length) return json_({ ok: false, error: 'Missing tournament or rows.' });

  var known = {};
  GOLFERS.forEach(function (g) { known[fold_(g[0])] = g[0]; });
  var lin = tab_('Lineups');
  if (lin.getLastRow() > 1) {
    lin.getRange(2, 3, lin.getLastRow() - 1, 1).getValues().forEach(function (r) {
      if (r[0]) known[fold_(r[0])] = String(r[0]);
    });
  }

  var date = d.date ? new Date(String(d.date) + 'T12:00:00') : '';
  var fresh = [], unmatched = [];
  d.rows.forEach(function (r) {
    var raw = String(r.golfer || '').trim();
    if (!raw) return;
    var money = Number(String(r.earnings == null ? 0 : r.earnings).replace(/[$,\s]/g, ''));
    if (isNaN(money)) money = 0;
    var canon = known[fold_(raw)];
    if (!canon && money <= 0) return;
    if (!canon) unmatched.push(raw);
    fresh.push([name, date, canon || clean_(raw), clean_(r.finish), money]);
  });

  var t = tab_('Tournaments');
  var kept = [];
  if (t.getLastRow() > 1) {
    kept = t.getRange(2, 1, t.getLastRow() - 1, 5).getValues().filter(function (r) {
      return String(r[0]).trim() !== name;
    });
    t.getRange(2, 1, t.getLastRow() - 1, 5).clearContent();
  }
  var all = kept.concat(fresh);
  if (all.length) t.getRange(2, 1, all.length, 5).setValues(all);
  t.getRange('B:B').setNumberFormat('yyyy-mm-dd');
  t.getRange('E:E').setNumberFormat('$#,##0');
  refreshEventScores();
  return json_({ ok: true, stored: fresh.length, notOnGolfersTabWithMoney: unmatched });
}

// Receives the season schedule: {action:'schedule', token, events:[{event, finish:'YYYY-MM-DD', purse, refPurse, counts, notes, type}]}.
// type is regular, signature, players, playoff or major (sets the weekly prize; see PRIZES).
// Same token as the results feed. Replaces the whole Schedule tab, so re-sending an updated list (for example once
// purses are posted) is safe.
function saveSchedule_(d) {
  var want = PropertiesService.getScriptProperties().getProperty('RESULTS_TOKEN');
  if (!want || String(d.token) !== want) return json_({ ok: false, error: 'Not authorized.' });
  if (!d.events || !d.events.length) return json_({ ok: false, error: 'No events.' });
  var sh = tab_('Schedule');
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, TABS.Schedule.length).clearContent();
  var rows = d.events.map(function (e) {
    return [
      clean_(e.event),
      e.finish ? new Date(String(e.finish) + 'T12:00:00') : '',
      e.purse ? Number(e.purse) : '',
      e.refPurse ? Number(e.refPurse) : '',
      clean_(e.counts),
      clean_(e.notes),
      PRIZES[e.type] ? e.type : 'regular'
    ];
  });
  sh.getRange(2, 1, rows.length, 7).setValues(rows);
  sh.getRange('B:B').setNumberFormat('yyyy-mm-dd');
  sh.getRange('C:D').setNumberFormat('$#,##0');
  return json_({ ok: true, stored: rows.length });
}

// One row per event per team, with that team's earnings and event rank. Highest earnings wins the event.
// Pot Share is 1 for an outright winner; teams tied for the top split the weekly pot (two tied = 0.5 each).
// Run after adding results to Tournaments (FGT > Update event scores). Safe to run any time.
function refreshEventScores() {
  var t = tab_('Tournaments'), st = tab_('Standings'), es = tab_('EventScores');
  if (es.getLastRow() > 1) es.getRange(2, 1, es.getLastRow() - 1, es.getLastColumn()).clearContent();
  var events = [];
  if (t.getLastRow() > 1) {
    t.getRange(2, 1, t.getLastRow() - 1, 1).getValues().forEach(function (r) {
      var n = String(r[0]).trim();
      if (n && events.indexOf(n) < 0) events.push(n);
    });
  }
  if (!events.length || st.getLastRow() < 2) return;
  var teams = st.getRange(2, 2, st.getLastRow() - 1, 2).getValues();

  // Each team's earnings per event are worked out here and written as numbers. (A single big formula
  // for this did not calculate in Sheets and showed $0.) Rank and Pot Share below stay live formulas.
  var money = {}; // event -> folded golfer name -> prize money
  t.getRange(2, 1, t.getLastRow() - 1, 5).getValues().forEach(function (r) {
    var ev = String(r[0]).trim(), g = fold_(r[2]);
    if (!ev || !g) return;
    money[ev] = money[ev] || {};
    money[ev][g] = (money[ev][g] || 0) + (Number(r[4]) || 0);
  });
  var lineup = {}; // entry id -> folded golfer names
  var lin = tab_('Lineups');
  if (lin.getLastRow() > 1) {
    lin.getRange(2, 1, lin.getLastRow() - 1, 3).getValues().forEach(function (r) {
      if (!r[0] || !r[2]) return;
      (lineup[r[0]] = lineup[r[0]] || []).push(fold_(r[2]));
    });
  }

  // Event type from the Schedule tab (matched by name, ignoring case); unknown events count as regular.
  var types = {}, sch = tab_('Schedule');
  if (sch.getLastRow() > 1) sch.getRange(2, 1, sch.getLastRow() - 1, 7).getValues().forEach(function (r) {
    if (r[0]) types[String(r[0]).trim().toLowerCase()] = PRIZES[r[6]] ? r[6] : 'regular';
  });

  var vals = [], f = [], prizeCol = [], row = 2;
  events.forEach(function (ev) {
    var earnedBy = teams.map(function (tm) {
      return (lineup[tm[0]] || []).reduce(function (sum, g) { return sum + (money[ev][g] || 0); }, 0);
    });
    var prize = prizesFor_(earnedBy, PRIZES[types[ev.toLowerCase()] || 'regular']);
    teams.forEach(function (tm, k) {
      var r = String(row++);
      var earned = earnedBy[k];
      vals.push([ev, tm[0], tm[1], earned]);
      prizeCol.push([prize[k]]);
      f.push([
        '=1+COUNTIFS($A$2:$A$5000,A' + r + ',$D$2:$D$5000,">"&D' + r + ')',
        '=IF(AND(E' + r + '=1,D' + r + '>0),1/COUNTIFS($A$2:$A$5000,A' + r + ',$E$2:$E$5000,1),0)'
      ]);
    });
  });
  es.getRange(2, 1, vals.length, 4).setValues(vals);
  es.getRange(2, 5, f.length, 2).setFormulas(f);
  es.getRange(2, 4, vals.length, 1).setNumberFormat('$#,##0');
  es.getRange(2, 7, prizeCol.length, 1).setValues(prizeCol).setNumberFormat('$#,##0');
}

// Prize money per team for one event. earned: each team's money, same order as the result. prizes: [1st, 2nd, ...].
// Teams tied on money share the prizes for all the places they occupy (two tied for 1st at a major split $300 + $100).
// Teams that earned nothing win nothing.
function prizesFor_(earned, prizes) {
  var out = earned.map(function () { return 0; });
  var order = earned.map(function (v, i) { return i; }).filter(function (i) { return earned[i] > 0; })
    .sort(function (a, b) { return earned[b] - earned[a]; });
  var pos = 0;
  while (pos < order.length && pos < prizes.length) {
    var end = pos;
    while (end + 1 < order.length && earned[order[end + 1]] === earned[order[pos]]) end++;
    var pot = 0;
    for (var p = pos; p <= end; p++) pot += prizes[p] || 0;
    for (var q = pos; q <= end; q++) out[order[q]] = Math.round(pot / (end - pos + 1) * 100) / 100;
    pos = end + 1;
  }
  return out;
}

// Rebuilds Lineups and Standings from the Entries tab. Gives Entry IDs to older entries that lack one.
// Does not touch Entries data other than filling blank Entry IDs, and never touches Tournaments.
function rebuildLineupsAndStandings() {
  var entries = sheet_();
  var last = entries.getLastRow();
  var lin = tab_('Lineups'), st = tab_('Standings');
  [lin, st].forEach(function (sh) {
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  });
  if (last < 2) return;
  var data = entries.getRange(2, 1, last - 1, 13).getValues();
  data.forEach(function (r, i) {
    var id = r[12];
    if (!id) { id = Utilities.getUuid().slice(0, 8); entries.getRange(i + 2, 13).setValue(id); }
    var golfers = String(r[8]).split(/, (?=[^,]*\(\d\)(?:,|$))/).map(function (item) {
      var m = item.match(/^(.*) \((\d)\)$/);
      return m ? { name: m[1], points: Number(m[2]) } : null;
    }).filter(Boolean);
    addLineup_(id, r[5], golfers);
    addStanding_(id, r[5], r[1], r[6], r[7]);
  });
  refreshEventScores();
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.getRange('C:C').setNumberFormat('@'); // keep phone numbers as text
  }
  return sh;
}

// Case-, accent- and punctuation-insensitive form of a golfer name, used only for the lineup key.
// "Ludvig Åberg" == "ludvig aberg", "J.T. Poston" == "JT Poston".
function fold_(s) {
  return String(s).toLowerCase().replace(/ø/g, 'o').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

// Strip leading characters that make Sheets treat a value as a formula, and trim length.
function clean_(v) {
  var s = String(v == null ? '' : v).trim().slice(0, 300);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
