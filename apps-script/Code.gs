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
  'Points Used', '# Golfers', 'Golfers', 'Lineup Key', 'Duplicate Of Row', 'Points Version', 'Entry ID', 'Paid',
  'Edit Code', 'Last Edited'
];

// Edit links: each entry gets a secret Edit Code (Entries column O). The confirmation email carries a private link,
// team-picker.html?edit=<code>, that reopens the picker with the team loaded; saving replaces that entry instead of
// adding one. Links stop working once entries close (Settings B5 = Yes, or the DEADLINE has passed).
var EDIT_URL = 'https://fgt-mt.com/team-picker.html?edit=';

// The script finds each Entries column by its header text, so Tom can move columns around, insert his own, or
// hide some. Headers must keep these exact names (any capitals). Set up tabs adds Edit Code / Last Edited if missing
// and stops with a message naming any other missing header.
var ENTRY_COLS = { time: 'Timestamp', name: 'Name', phone: 'Phone', email: 'Email', address: 'Address', team: 'Team Name',
  points: 'Points Used', count: '# Golfers', golfers: 'Golfers', key: 'Lineup Key', dup: 'Duplicate Of Row',
  version: 'Points Version', id: 'Entry ID', paid: 'Paid', code: 'Edit Code', edited: 'Last Edited' };

// Weekly prize money for the team that wins each event (rules sheet), by event type on the Schedule tab.
// FedExCup playoff events (FedEx St. Jude, BMW) pay $200 like Signature Events (Tom, Nov 20 2026).
// Majors also pay 2nd place. Teams tied on money split the prizes for the places they share.
var PRIZES = { regular: [150], signature: [200], players: [200], playoff: [200], major: [300, 100] };

// Confirmation email sent to each player after they enter (from the Google account that owns this script).
// 2026 year-end payouts (37 places, $14,950), used as the starting Payouts tab until the 2027 amounts are set.
var PAYOUTS_2026 = [1500, 1200, 1100, 900, 750, 700, 600, 550, 500, 450, 425, 410, 400, 390, 370, 350, 320, 310, 300,
  290, 280, 270, 260, 240, 225, 210, 200, 190, 180, 170, 160, 150, 140, 130, 120, 110, 100];

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
  Schedule:    ['Event', 'Finish Date', 'Purse', 'Reference Purse 2026', 'Counts for FGT', 'Notes', 'Type'],
  // Year-end payouts by final season place. Starts as the 2026 table; Tom edits it and types Yes in Settings B6 when final.
  Payouts:     ['Place', 'Amount']
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
  var closed = entriesClosed_();
  var paid = set.getRange(2, 2).getValue();
  var payoutsFinal = String(set.getRange(6, 2).getValue() || '').trim().toLowerCase() === 'yes';

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
    payouts: rows_('Payouts', 2).map(function (r) { return Number(r[1]) || 0; }).filter(function (a) { return a > 0; }),
    payoutsFinal: payoutsFinal,
    standings: standings, schedule: schedule, eventScores: eventScores,
    results: results, golfers: golfers, lineups: lineups
  };
}

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, error: 'Bad request.' }); }
  if (d.action === 'load') return loadEntry_(d); // read only: the team behind an edit link

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    if (d.action === 'results') return saveResults_(d); // weekly prize money from the PGA Tour page
    if (d.action === 'schedule') return saveSchedule_(d); // season schedule from the PGA Tour page

    if (d.website) return json_({ ok: true }); // honeypot tripped: pretend success, store nothing

    if (entriesClosed_()) return json_({ ok: false, closed: true, error: 'Entries are closed.' });
    if (d.action === 'links') return sendLinks_(d); // "lost your link?" form

    var E = entries_();
    var editRow = 0;
    if (d.action === 'edit') {
      editRow = findByCode_(E, d.code);
      if (!editRow) return json_({ ok: false, badCode: true, error: 'That edit link is not valid.' });
    }

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

    var key = golfers.map(function (g) { return fold_(g.name); }).sort().join('|');
    var teamKey = teamKey_(team);

    // One person may enter several teams, but no two teams may share a team name (ignoring case, spaces and
    // punctuation) or the exact same lineup (first one in keeps it). Runs inside the script lock, so two identical
    // teams sent at the same moment can't both get in. An edit is not compared with its own row.
    var rows = E.rows();
    for (var i = 0; i < rows.length; i++) {
      var o = E.obj(rows[i]);
      if (i + 2 === editRow || !o.team) continue;
      if (teamKey_(o.team) === teamKey) {
        return json_({ ok: false, teamTaken: true, error: 'Another team already has that name. Pick a different team name.' });
      }
      if (o.key === key) {
        return json_({
          ok: false,
          duplicate: true,
          error: 'Another team has this exact lineup. Change at least one golfer (up to 10 points\' worth).'
        });
      }
    }

    var list = golfers
      .sort(function (a, b) { return b.points - a.points || a.name.localeCompare(b.name); })
      .map(function (g) { return g.name + ' (' + g.points + ')'; }).join(', ');

    var vals = { name: name, phone: phone, email: email, address: address, team: team, points: total,
                 count: golfers.length, golfers: list, key: key, version: clean_(d.pointsVersion) };
    if (editRow) return saveEdit_(E, editRow, vals, golfers);

    var entryId = Utilities.getUuid().slice(0, 8), code = newCode_();
    vals.time = new Date(); vals.id = entryId; vals.paid = false; vals.code = code;
    E.sh.appendRow(E.toRow(vals));
    try { E.sh.getRange(E.sh.getLastRow(), E.c.paid).insertCheckboxes(); } catch (x) {}

    // The entry is already saved. A problem in the extra tabs must never lose it or fail the submit;
    // "FGT > Rebuild Lineups and Standings" repairs them from Entries.
    try {
      addLineup_(entryId, team, golfers);
      addStanding_(entryId, team, name, total, golfers.length);
    } catch (x) {}
    // Confirmation email. Never fails the entry (Gmail limits personal accounts to about 100 emails a day).
    try { sendConfirmation_(email, name, team, list, total, code, false); } catch (x) {}
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'Server error. Please try again.' });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// ---- Edit links -------------------------------------------------------------------------------

function entriesClosed_() {
  var flag = String(tab_('Settings').getRange(5, 2).getValue() || '').trim().toLowerCase();
  return flag === 'yes' || !!(DEADLINE && new Date() > DEADLINE);
}

function newCode_() { return Utilities.getUuid().replace(/-/g, ''); } // 32 hex characters, random

// "The Birdies", "the birdies!" and " THE  BIRDIES " count as the same team name.
function teamKey_(t) {
  var s = String(t).replace(/^'/, '');
  return fold_(s) || s.trim().toLowerCase();
}

// Entries row (2+) whose Edit Code matches, or 0.
function findByCode_(E, code) {
  code = String(code || '').trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(code)) return 0;
  var last = E.sh.getLastRow();
  if (last < 2) return 0;
  var codes = E.sh.getRange(2, E.c.code, last - 1, 1).getValues();
  for (var i = 0; i < codes.length; i++) if (String(codes[i][0]) === code) return i + 2;
  return 0;
}

// "Scottie Scheffler (6), Chad Ramey (3)" -> [{name, points}]
function golfersFromList_(list) {
  return String(list).split(/, (?=[^,]*\(\d\)(?:,|$))/).map(function (item) {
    var m = item.match(/^(.*) \((\d)\)$/);
    return m ? { name: m[1], points: Number(m[2]) } : null;
  }).filter(Boolean);
}

function editLink_(code) { return EDIT_URL + code; }

// The team behind an edit link, so the page can load it. Only someone holding the link gets the data.
function loadEntry_(d) {
  var E = entries_(), row = findByCode_(E, d.code);
  if (!row) return json_({ ok: false, badCode: true, error: 'That edit link is not valid.' });
  var o = E.obj(E.sh.getRange(row, 1, 1, E.c.width).getValues()[0]);
  var plain = function (v) { return String(v == null ? '' : v).replace(/^'/, ''); };
  return json_({
    ok: true, closed: entriesClosed_(), paid: o.paid === true,
    entry: { name: plain(o.name), phone: plain(o.phone), email: plain(o.email), address: plain(o.address), teamName: plain(o.team),
             golfers: golfersFromList_(o.golfers) }
  });
}

// Replaces an entry in place. Keeps its first-entered time, Entry ID, Paid box, Edit Code and
// anything Tom typed in "Duplicate Of Row".
function saveEdit_(E, row, vals, golfers) {
  var old = E.obj(E.sh.getRange(row, 1, 1, E.c.width).getValues()[0]);
  vals.edited = new Date();
  Object.keys(vals).forEach(function (k) { if (E.c[k]) E.sh.getRange(row, E.c[k]).setValue(vals[k]); });
  var entryId = old.id, code = String(old.code);
  try {
    replaceLineup_(entryId, vals.team, golfers);
    updateStanding_(entryId, vals.team, vals.name, vals.points, golfers.length);
  } catch (x) {}
  try { sendConfirmation_(vals.email, vals.name, vals.team, vals.golfers, vals.points, code, true); } catch (x) {}
  // If the email address changed, tell the old address too, so a forwarded link can't quietly take a team.
  var oldEmail = String(old.email).trim();
  if (oldEmail && oldEmail.toLowerCase() !== String(vals.email).toLowerCase()) {
    try {
      MailApp.sendEmail({ to: oldEmail, name: 'Fantasy Golf Tour', replyTo: CONTACT,
        subject: 'FGT team changed: ' + vals.team,
        body: 'The FGT team "' + old.team + '" was just changed and its email address is now ' + vals.email + '.\n\n' +
          'If that was not you, write to ' + CONTACT + ' right away.\n\nFantasy Golf Tour' });
    } catch (x) {}
  }
  return json_({ ok: true, edited: true, paid: old.paid === true });
}

function replaceLineup_(entryId, team, golfers) {
  var sh = tab_('Lineups'), last = sh.getLastRow(), id = String(entryId);
  if (last > 1) {
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) !== id) continue;
      var end = i;
      while (i > 0 && String(ids[i - 1][0]) === id) i--;
      var n = end - i + 1;
      // A sheet can't lose all its non-frozen rows, so keep a spare one at the bottom.
      if (sh.getMaxRows() - n < 2) sh.insertRowsAfter(sh.getMaxRows(), 1);
      sh.deleteRows(i + 2, n);
    }
  }
  addLineup_(entryId, team, golfers);
}

function updateStanding_(entryId, team, name, total, count) {
  var sh = tab_('Standings'), last = sh.getLastRow();
  if (last > 1) {
    var ids = sh.getRange(2, 2, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(entryId)) {
        sh.getRange(i + 2, 3, 1, 4).setValues([[team, name, total, count]]);
        return;
      }
    }
  }
  addStanding_(entryId, team, name, total, count);
}

// "Lost your link?": emails the edit links for every team entered with this address. The page always gets the same
// answer, so it can't be used to find out who entered. At most one email per address every 10 minutes.
function sendLinks_(d) {
  var email = clean_(d.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json_({ ok: false, error: 'Enter a valid email address.' });
  var answer = json_({ ok: true, message: 'If a team was entered with that email, its link is on the way. Check spam too.' });
  var cache = CacheService.getScriptCache(), ck = 'links:' + email.slice(0, 200);
  if (cache.get(ck)) return answer;
  cache.put(ck, '1', 600);
  var E = entries_(), mine = [];
  E.rows().forEach(function (r, i) {
    var o = E.obj(r);
    if (!o.team || String(o.email).trim().toLowerCase() !== email) return;
    var code = String(o.code || '');
    if (!code) { code = newCode_(); E.sh.getRange(i + 2, E.c.code).setValue(code); }
    mine.push({ team: String(o.team).replace(/^'/, ''), name: String(o.name), code: code });
  });
  if (!mine.length) return answer;
  var first = mine[0].name.split(' ')[0];
  var body = ['Hi ' + first + ',', '', 'Here ' + (mine.length === 1 ? 'is the private link' : 'are the private links') +
      ' to change your Fantasy Golf Tour ' + (mine.length === 1 ? 'team' : 'teams') + ' until entries close:', '']
    .concat(mine.map(function (m) { return m.team + ': ' + editLink_(m.code); }))
    .concat(['', 'Keep these to yourself: anyone with a link can change that team.',
      'Didn\'t ask for this? You can ignore it. Questions: ' + CONTACT + '.', '', 'Fantasy Golf Tour']).join('\n');
  try {
    MailApp.sendEmail({ to: email, subject: 'Your FGT edit ' + (mine.length === 1 ? 'link' : 'links'),
      body: body, name: 'Fantasy Golf Tour', replyTo: CONTACT });
  } catch (x) {}
  return answer;
}

// Menu: shows the edit link for the row selected in the Entries tab (to send to a player by hand).
function showEditLink() {
  var ui = SpreadsheetApp.getUi(), sh = SpreadsheetApp.getActiveSheet();
  var row = sh.getActiveRange() ? sh.getActiveRange().getRow() : 0;
  var E = sh.getName() === SHEET_NAME ? entries_() : null;
  if (!E || row < 2 || !sh.getRange(row, E.c.team).getValue()) {
    ui.alert('Click a cell in a team\'s row on the Entries tab first.'); return;
  }
  var code = String(sh.getRange(row, E.c.code).getValue() || '');
  if (!code) { code = newCode_(); sh.getRange(row, E.c.code).setValue(code); }
  ui.alert('Edit link for ' + sh.getRange(row, E.c.team).getValue(),
    editLink_(code) + '\n\nSend it only to that team\'s owner: anyone with the link can change the team until entries close.',
    ui.ButtonSet.OK);
}

// ---- Extra tabs -------------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('FGT')
    .addItem('Set up tabs', 'setupSheets')
    .addItem('Refresh Golfers tab', 'refreshGolfers')
    .addItem('Update event scores', 'refreshEventScores')
    .addItem('Rebuild Lineups and Standings', 'rebuildLineupsAndStandings')
    .addItem('Send me a test confirmation email', 'sendTestConfirmation')
    .addItem('Show the edit link for the selected team', 'showEditLink')
    .addSeparator()
    .addItem('Email me the unpaid list', 'emailUnpaidList')
    .addItem('Turn on weekly unpaid list (Mondays)', 'turnOnWeeklyUnpaidList')
    .addItem('Back up the Sheet now', 'backupNow')
    .addItem('Turn on weekly backups', 'turnOnWeeklyBackups')
    .addSeparator()
    .addItem('Test the GitHub timer token', 'testGithubTimer')
    .addItem('Turn on the live and results timer', 'turnOnTimer')
    .addSeparator()
    .addItem('Email me the latest weekly recap (beehiiv)', 'emailLatestRecap')
    .addItem('Email me new entrants for beehiiv (CSV)', 'emailNewEntrantsCsv')
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
function sendConfirmation_(email, name, team, list, total, code, edited) {
  var first = String(name).split(' ')[0];
  var body = [
    'Hi ' + first + ',',
    '',
    edited ? 'Your Fantasy Golf Tour team has been changed. Here is your team now:'
           : 'Your Fantasy Golf Tour team is in. Here is what we received:',
    '',
    'Team name: ' + team,
    'Golfers: ' + list,
    'Points used: ' + total + ' of ' + BUDGET,
    '',
    'Entry fee: $' + ENTRY_FEE + ' by Venmo to @' + VENMO_HANDLE + ' (please put your team name in the note).',
    '',
    code ? 'Want to change it? Use your private link until entries close (then the team is final):\n' + editLink_(code) +
      '\nKeep this link to yourself: anyone with it can change your team.'
         : 'Your team is final once entries close.',
    '',
    'Follow the season at ' + TRACKER_URL,
    'Questions or a mistake in your team? Reply to this email or write to ' + CONTACT + '.',
    '',
    'Good luck!',
    'Fantasy Golf Tour'
  ].join('\n');
  MailApp.sendEmail({ to: email, subject: (edited ? 'FGT team changed: ' : 'FGT entry received: ') + team, body: body, name: 'Fantasy Golf Tour', replyTo: CONTACT });
}

// Sends one test confirmation to the script owner's own address, so Tom can see the email and approve Gmail access.
function sendTestConfirmation() {
  var me = Session.getEffectiveUser().getEmail();
  sendConfirmation_(me, 'Test Player', 'Test Team (not a real entry)', 'Scottie Scheffler (6), Chad Ramey (3)', 9,
    '00000000000000000000000000000000', false);
  SpreadsheetApp.getUi().alert('Test email sent to ' + me + '.');
}

// ---- Unpaid list (private: emailed only to the script owner) --------------------------------------

// Weekly unpaid list (Tom's #9): a Monday 9am trigger that emails the owner only once entries have closed
// (Settings B5 = Yes or the DEADLINE has passed) and only if someone still hasn't paid. Menu item installs it.
function weeklyUnpaidList() {
  if (!entriesClosed_()) return;
  emailUnpaidList({ skipIfNone: true });
}
function turnOnWeeklyUnpaidList() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'weeklyUnpaidList') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('weeklyUnpaidList').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
  SpreadsheetApp.getUi().alert('Weekly unpaid list is on: Mondays about 9am, once entries are closed (Settings B5 = Yes or the deadline has passed), and only when someone still owes.');
}

// Emails the script owner every entry whose Paid box (Entries "Paid" column) is not ticked, oldest first.
function emailUnpaidList(opts) {
  opts = opts && typeof opts === 'object' && !opts.authMode ? opts : {};   // menu and trigger runs pass an event object
  var E = entries_();
  var tz = Session.getScriptTimeZone();
  var entered = E.rows().map(E.obj).filter(function (o) { return o.team; });
  var unpaid = entered.filter(function (o) { return o.paid !== true; });
  var lines = unpaid.map(function (o, i) {
    var when = o.time instanceof Date ? Utilities.formatDate(o.time, tz, 'MMM d') : '';
    return (i + 1) + '. ' + o.team + ' - ' + o.name + ' - ' + o.phone + ' - ' + o.email + (when ? ' (entered ' + when + ')' : '') +
      (o.dup ? ' [marked duplicate of row ' + o.dup + ']' : '');
  });
  if (opts.skipIfNone && !unpaid.length) return;
  var me = Session.getEffectiveUser().getEmail();
  var subject = 'FGT unpaid entries: ' + unpaid.length + ' of ' + entered.length;
  var body = unpaid.length
    ? ['Teams whose Paid box is not ticked (' + unpaid.length + ' of ' + entered.length + ' entries, $' +
        (unpaid.length * ENTRY_FEE).toLocaleString() + ' outstanding):', '', lines.join('\n'), '',
       'Team - name - phone - email. Tick the Paid box in the Entries tab as Venmo payments come in.'].join('\n')
    : 'Everyone has paid: all ' + entered.length + ' entries have the Paid box ticked.';
  MailApp.sendEmail({ to: me, subject: subject, body: body, name: 'Fantasy Golf Tour' });
  try { SpreadsheetApp.getUi().alert('Sent to ' + me + ': ' + unpaid.length + ' unpaid of ' + entered.length + ' entries.'); } catch (x) {}
}

// ---- Backups (copies of the whole Sheet in a private Drive folder) --------------------------------

var BACKUP_FOLDER = 'FGT Sheet backups', BACKUPS_KEPT = 12;

// Saves a dated copy of the whole Sheet in the "FGT Sheet backups" folder in the owner's Drive and keeps the newest 12.
// The copies include the Entries tab (contact info), so they stay private like the Sheet. To restore, open a copy and
// copy the tab or rows you need back into the real Sheet (the website keeps writing to the real one only).
function backupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties(), folder = null, id = props.getProperty('BACKUP_FOLDER_ID');
  try { if (id) { folder = DriveApp.getFolderById(id); if (folder.isTrashed()) folder = null; } } catch (x) { folder = null; }
  if (!folder) {
    var found = DriveApp.getFoldersByName(BACKUP_FOLDER);
    folder = found.hasNext() ? found.next() : DriveApp.createFolder(BACKUP_FOLDER);
    props.setProperty('BACKUP_FOLDER_ID', folder.getId());
  }
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');
  var name = ss.getName() + ' backup ' + stamp;
  DriveApp.getFileById(ss.getId()).makeCopy(name, folder);
  var copies = [], it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); if (f.getName().indexOf(ss.getName() + ' backup ') === 0) copies.push(f); }
  copies.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  copies.slice(BACKUPS_KEPT).forEach(function (f) { f.setTrashed(true); });
  return name;
}

function backupNow() {
  var name = backupSheet();
  SpreadsheetApp.getUi().alert('Saved "' + name + '" in the Drive folder "' + BACKUP_FOLDER + '" (the newest ' + BACKUPS_KEPT + ' are kept).');
}

// Installs one weekly trigger: Tuesday about 3am, after the Sunday/Monday results runs. Safe to run again.
function turnOnWeeklyBackups() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backupSheet') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('backupSheet').timeBased().onWeekDay(ScriptApp.WeekDay.TUESDAY).atHour(3).create();
  var name = backupSheet();
  SpreadsheetApp.getUi().alert('Weekly backups are on (Tuesdays about 3am). First copy saved now: "' + name + '" in "' + BACKUP_FOLDER + '".');
}

// ---- Weekly recap for the beehiiv newsletter ---------------------------------------------------
// beehiiv's free plan can't take posts from a script, so the recap is emailed to the owner to paste into a new post.
// Built only from dashboardData_() (the public feed): team names, no names, emails or phones of people.

function money_(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('en-US'); }
function esc_(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// Returns { subject, text, html } for one event, or null if it has no scores yet.
function buildRecap_(event) {
  SpreadsheetApp.flush();   // make sure the EventScores formulas just written are calculated
  var d = dashboardData_();
  var key = String(event).trim().toLowerCase();
  var sched = d.schedule.filter(function (e) { return e.counts === 'Yes'; })
    .sort(function (a, b) { return a.finish < b.finish ? -1 : a.finish > b.finish ? 1 : 0; });
  var me = sched.filter(function (e) { return e.event.toLowerCase() === key; })[0];
  var rows = d.eventScores.filter(function (r) { return r.event.toLowerCase() === key; });
  var hasResults = d.results.some(function (r) { return r.event.toLowerCase() === key; });
  if (!rows.length && !hasResults) return null;   // no teams yet still gets a recap (story and golfers), e.g. for a test
  var finish = me ? me.finish : '', type = me ? me.type : 'regular';
  var week = me ? sched.indexOf(me) + 1 : 0;

  // This event, best first. Ranks are recomputed from money so ties share a place.
  rows.sort(function (a, b) { return b.earnings - a.earnings; });
  var place = function (list, v) { return 1 + list.filter(function (x) { return x > v; }).length; };
  var evMoney = rows.map(function (r) { return r.earnings; });
  var winners = rows.filter(function (r) { return r.earnings > 0 && r.earnings === rows[0].earnings; });   // [] when no teams
  var second = type === 'major' ? rows.filter(function (r) { return r.prize > 0 && winners.indexOf(r) < 0; }) : [];

  // Season totals through this event and through the event before, for standings and movers.
  var order = {}; sched.forEach(function (e, i) { order[e.event.toLowerCase()] = i; });
  var myIdx = key in order ? order[key] : 1e9;
  var now = {}, before = {}, wins = {}, winnings = {};
  d.eventScores.forEach(function (r) {
    var i = r.event.toLowerCase() in order ? order[r.event.toLowerCase()] : -1;
    if (i > myIdx || (i < 0 && myIdx < 1e9)) return;   // only scheduled FGT events count (skips old test events like Austin)
    now[r.team] = (now[r.team] || 0) + r.earnings;
    if (i < myIdx) before[r.team] = (before[r.team] || 0) + r.earnings;
    winnings[r.team] = (winnings[r.team] || 0) + (r.prize || 0);
    if (r.share > 0) wins[r.team] = (wins[r.team] || 0) + 1;
  });
  var teams = Object.keys(now);
  var nowVals = teams.map(function (t) { return now[t]; }), befVals = teams.map(function (t) { return before[t] || 0; });
  var hadBefore = Object.keys(before).length > 0;
  var table = teams.map(function (t) {
    var r = place(nowVals, now[t]), b = place(befVals, before[t] || 0);
    return { team: t, total: now[t], rank: r, move: hadBefore ? b - r : 0, wins: wins[t] || 0, winnings: winnings[t] || 0 };
  }).sort(function (a, b) { return a.rank - b.rank || a.team.localeCompare(b.team); });
  var climber = hadBefore ? table.slice().sort(function (a, b) { return b.move - a.move; })[0] : null;

  // Season leader after each scheduled event up to this one, to call out a change at the top (or how long it has held).
  var run = {}, leadersBy = [];
  sched.forEach(function (e, i) {
    if (i > myIdx) return;
    var evRows = d.eventScores.filter(function (r) { return r.event.toLowerCase() === e.event.toLowerCase(); });
    if (!evRows.length) return;
    evRows.forEach(function (r) { run[r.team] = (run[r.team] || 0) + r.earnings; });
    var top = Math.max.apply(null, Object.keys(run).map(function (t) { return run[t]; }));
    leadersBy.push(Object.keys(run).filter(function (t) { return run[t] === top && top > 0; }).sort());
  });
  var leadNow = leadersBy.length ? leadersBy[leadersBy.length - 1] : [], leadPrev = leadersBy.length > 1 ? leadersBy[leadersBy.length - 2] : null;
  var streak = 0;
  for (var li = leadersBy.length - 1; li >= 0 && leadersBy[li].join('|') === leadNow.join('|'); li--) streak++;
  var both = function (l) { return l.join(' and '); };
  var leadLine = !leadNow.length ? '' : !leadPrev ? both(leadNow) + (leadNow.length > 1 ? ' share' : ' has') + ' the early season lead.'
    : leadNow.join('|') !== leadPrev.join('|')
      ? 'New season leader: ' + both(leadNow) + (leadNow.length > 1 ? ' now share the top spot' : ' takes over the top spot') + (leadPrev.length ? ' from ' + both(leadPrev.filter(function (t) { return leadNow.indexOf(t) < 0; })) : '') + '.'
      : both(leadNow) + (leadNow.length > 1 ? ' stay level' : ' stays') + ' on top of the season standings (' + streak + ' weeks running).';
  leadLine = leadLine.replace(' from .', '.');

  // How many teams picked each golfer, counted straight from the Lineups tab (counts only, no team names), so the
  // recap always has them even while the public feed still hides lineups.
  var picks = {}, ptsOf = {}, lin = tab_('Lineups');
  if (lin.getLastRow() > 1) lin.getRange(2, 3, lin.getLastRow() - 1, 2).getValues().forEach(function (r) {
    if (r[0]) { var g = fold_(r[0]); picks[g] = (picks[g] || 0) + 1; if (Number(r[1])) ptsOf[g] = Number(r[1]); }
  });
  var lowRds = []; try { lowRds = JSON.parse(PropertiesService.getScriptProperties().getProperty('LOWROUNDS:' + key.slice(0, 200)) || '[]'); } catch (x) {}
  var story = PropertiesService.getScriptProperties().getProperty('STORY:' + key.slice(0, 200)) || '';

  // Top golfers this week, with how many teams picked them.
  var golfers = d.results.filter(function (r) { return r.event.toLowerCase() === key && r.earnings > 0; })
    .sort(function (a, b) { return b.earnings - a.earnings; }).slice(0, 5);

  var next = sched.filter(function (e) { return e.finish > finish; })[0];
  var nextPrize = next ? (d.prizes[next.type] || d.prizes.regular || [0])[0] : 0;
  var label = { major: 'Major', signature: 'Signature Event', players: 'The Players', playoff: 'FedExCup Playoffs', regular: '' };
  var prizeNow = (d.prizes[type] || d.prizes.regular || [0]);

  // Plain lines (text) and the same as simple HTML (pastes cleanly into the beehiiv editor).
  var H = [], T = [];
  var h2 = function (s) { H.push('<h2 style="margin:22px 0 6px">' + esc_(s) + '</h2>'); T.push('', s.toUpperCase()); };
  var p = function (s) { H.push('<p style="margin:6px 0">' + esc_(s) + '</p>'); T.push(s); };
  // Ranked lines with their real place (ties show T2, T2, 4 ...), written out rather than as a numbered list.
  var ranked = function (items) { H.push('<p style="margin:6px 0">' + items.map(esc_).join('<br>') + '</p>'); items.forEach(function (i) { T.push(i); }); };
  var ol = function (items) { H.push('<ol style="margin:6px 0 6px 20px;padding:0">' + items.map(function (i) { return '<li>' + esc_(i) + '</li>'; }).join('') + '</ol>');
    items.forEach(function (i, k) { T.push((k + 1) + '. ' + i); }); };

  var title = (week ? 'Week ' + week + ': ' : '') + event;
  // A little snark (Tom): each line picks one of a few phrasings, chosen by the event name so a resend reads the same.
  var seed = 0; for (var si = 0; si < event.length; si++) seed = (seed * 31 + event.charCodeAt(si)) % 100003;
  var say = function (opts) { seed = (seed * 7 + 13) % 100003; return opts[seed % opts.length]; };
  var w0 = winners[0];
  var winLine = !rows.length ? 'No FGT teams have scores yet. Riveting stuff.' : !winners.length ? 'No team earned a cent this week. Impressive, in its own way.'
    : winners.length === 1 ? say([
        w0.team + ' takes the ' + event + ' with ' + money_(w0.earnings) + ' and pockets ' + money_(w0.prize) + '. Drinks are presumably on them.',
        w0.team + ' wins the week with ' + money_(w0.earnings) + '. That\'s ' + money_(w0.prize) + ' richer and insufferable until next Sunday.',
        'Take a bow, ' + w0.team + ': ' + money_(w0.earnings) + ' at the ' + event + ' and ' + money_(w0.prize) + ' in prize money. Everyone else, there\'s always next week.'])
    : winners.map(function (w) { return w.team; }).join(' and ') + ' tie for the win at ' + money_(w0.earnings) + ' and split the prize (' + money_(w0.prize) + ' each). Nobody likes a tie, but here we are.';
  if (leadLine) {
    if (/^New season leader/.test(leadLine)) leadLine = leadLine.replace(/\.$/, '') + '. ' + say(['Enjoy the view while it lasts.', 'The crown is heavy. Don\'t drop it.', 'Somebody check on the old leader.']);
    else if (/stays? on top|stay level/.test(leadLine)) leadLine = leadLine.replace(/\.$/, '') + '. ' + say(['The rest of you might want to try harder.', 'Anyone planning to do something about this?', 'At this point it\'s a pattern.']);
  }
  h2(title + (label[type] ? ' (' + label[type] + ')' : ''));
  if (story) p(story);
  p(winLine);
  if (second.length) p('Second place: ' + second.map(function (r) { return r.team + ' (' + money_(r.earnings) + ', ' + money_(r.prize) + ')'; }).join(', ') + '. So close.');
  if (leadLine) p(leadLine);

  if (golfers.length) {
    h2('Golfers who paid off');
    ol(golfers.map(function (g) {
      var n = picks[fold_(g.golfer)] || 0;
      return g.golfer + ' (' + g.finish + '): ' + money_(g.earnings) + ', picked by ' + (n ? n + ' team' + (n === 1 ? '' : 's') : 'no one');
    }));
  }

  // Extras (Tom's #8): best value, low round by a picked golfer, the winner nobody picked, the most-picked bust.
  var extra = [];
  var allRes = d.results.filter(function (r) { return r.event.toLowerCase() === key; });
  var value = allRes.filter(function (r) { var k = fold_(r.golfer); return r.earnings > 0 && picks[k] && ptsOf[k]; })
    .map(function (r) { var k = fold_(r.golfer); return { g: r.golfer, m: r.earnings, pts: ptsOf[k], n: picks[k], per: r.earnings / ptsOf[k] }; })
    .sort(function (a, b) { return b.per - a.per; })[0];
  if (value) extra.push('Best value: ' + value.g + ' made ' + money_(value.m) + ' as a ' + value.pts + '-pointer (' + money_(value.per) + ' per point) for ' +
    value.n + ' team' + (value.n === 1 ? '' : 's') + '. ' + say(['The economists among you are nodding.', 'Smart money.', 'Bargain bin, top shelf.']));
  var lowPicked = lowRds.filter(function (r) { return picks[fold_(r[0])]; })[0];
  if (lowPicked) { var ln = picks[fold_(lowPicked[0])];
    extra.push('Low round by a picked golfer: ' + lowPicked[0] + ' shot ' + lowPicked[2] + ' (' + (lowPicked[3] > 0 ? '+' + lowPicked[3] : lowPicked[3] || 'E') +
      ') in round ' + lowPicked[1] + '. ' + ln + ' team' + (ln === 1 ? '' : 's') + ' enjoyed that one.'); }
  var champ = allRes.filter(function (r) { return String(r.finish) === '1'; })[0];
  if (champ && rows.length && !picks[fold_(champ.golfer)]) extra.push(say(['Nobody picked ' + champ.golfer + '. Not one of you.', champ.golfer + ' won it, and was on exactly zero FGT teams. Bold strategy, everyone.']));
  var bust = allRes.filter(function (r) { var f = String(r.finish).toUpperCase(); return (f === 'CUT' || f === 'MC' || f === 'W/D' || f === 'WD') && picks[fold_(r.golfer)]; })
    .sort(function (a, b) { return picks[fold_(b.golfer)] - picks[fold_(a.golfer)]; })[0];
  if (bust && picks[fold_(bust.golfer)] >= 2) {
    var bn = picks[fold_(bust.golfer)], wd = /W/.test(String(bust.finish).toUpperCase());
    extra.push('Biggest bust: ' + bust.golfer + ' was on ' + bn + ' teams and ' + (wd ? 'withdrew' : 'missed the cut') + '. ' + say(['Thoughts and prayers.', 'Weekend plans, ruined.', 'We don\'t talk about it.']));
  }
  if (extra.length) { h2('Odds and ends'); extra.forEach(function (x) { p(x); }); }

  var tie = function (list, v) { return list.filter(function (x) { return x === v; }).length > 1 ? 'T' : ''; };
  if (rows.length) {
  h2('Top teams this week');
  ranked(rows.slice(0, 5).map(function (r) {
    return tie(evMoney, r.earnings) + place(evMoney, r.earnings) + '. ' + r.team + ': ' + money_(r.earnings);
  }));

  }
  if (table.length) {
  h2('Season standings');
  var totals = table.map(function (t) { return t.total; });
  ranked(table.slice(0, 10).map(function (t) {
    var mv = t.move > 0 ? ' (up ' + t.move + ')' : t.move < 0 ? ' (down ' + (-t.move) + ')' : '';
    return tie(totals, t.total) + t.rank + '. ' + t.team + ': ' + money_(t.total) + (t.wins ? ', ' + t.wins + ' win' + (t.wins === 1 ? '' : 's') : '') + mv;
  }));
  }
  if (climber && climber.move > 0) p('Biggest climb: ' + climber.team + ', up ' + climber.move + ' to #' + climber.rank + '. ' + say(['Look who showed up.', 'Momentum is a thing.', 'Rocket fuel.']));

  if (next) { h2('Next up'); p(next.event + ' (finishes ' + next.finish + ')' + (label[next.type] ? ', a ' + label[next.type] : '') + '. Weekly prize: ' + money_(nextPrize) + (next.type === 'major' ? ' plus ' + money_(d.prizes.major[1] || 0) + ' for 2nd' : '') + '.'); }
  H.push('<p style="margin:18px 0 6px"><a href="' + TRACKER_URL + '">Full standings, lineups and stats on the 2027 Tracker</a></p>');
  T.push('', 'Full standings, lineups and stats: ' + TRACKER_URL);

  return { subject: 'FGT recap draft: ' + title, title: title, html: H.join('\n'), text: T.join('\n').trim() };
}

function sendRecap_(event) {
  var r = buildRecap_(event);
  if (!r) return null;
  var me = Session.getEffectiveUser().getEmail();
  var note = 'Draft for beehiiv: start a new post titled "FGT ' + r.title + '", then copy everything below the line into it and check it before sending.';
  MailApp.sendEmail({ to: me, subject: r.subject, name: 'Fantasy Golf Tour', body: note + '\n\n----------\n\n' + r.text,
    htmlBody: '<p style="color:#666;font-size:13px">' + esc_(note) + '</p><hr>' + r.html });
  return me;
}

// Once per event: the first results delivery sends it; later re-sends of the same event do not.
function maybeSendRecap_(event) {
  var props = PropertiesService.getScriptProperties(), k = 'RECAP_SENT:' + String(event).trim().toLowerCase().slice(0, 200);
  if (props.getProperty(k)) return;
  if (sendRecap_(event)) props.setProperty(k, new Date().toISOString());
}

// Menu: resend the recap for the most recent event with results (for example after Monday's corrections).
function emailLatestRecap() {
  var d = dashboardData_(), have = {};
  d.eventScores.concat(d.results).forEach(function (r) { have[r.event.toLowerCase()] = r.event; });
  var done = d.schedule.filter(function (e) { return have[e.event.toLowerCase()]; })
    .sort(function (a, b) { return a.finish < b.finish ? 1 : -1; });
  var ev = done.length ? done[0].event : Object.keys(have).map(function (k) { return have[k]; }).pop();
  var ui = SpreadsheetApp.getUi();
  if (!ev) { ui.alert('No event has results yet.'); return; }
  var me = sendRecap_(ev);
  ui.alert(me ? 'Recap for ' + ev + ' sent to ' + me + '.' : 'No team scores for ' + ev + ' yet.');
}

// Menu: a CSV of entrants since the last export (email, first name, last name, team) to import in beehiiv
// (Subscribers > Add subscribers > Import CSV). Emailed to the owner only; nothing is sent to beehiiv.
function emailNewEntrantsCsv() {
  var ui = SpreadsheetApp.getUi(), props = PropertiesService.getScriptProperties();
  var since = props.getProperty('BEEHIIV_EXPORTED_AT');
  var all = !since || ui.alert('beehiiv export', 'Only entrants since the last export (' + since.slice(0, 10) +
    ')?\n\nYes = only new ones. No = everyone.', ui.ButtonSet.YES_NO) === ui.Button.NO;
  var E = entries_();
  var rows = E.rows().map(function (r) { var o = E.obj(r); return [o.time, o.name, o.phone, o.email, o.address, o.team]; });
  var cut = since && !all ? new Date(since) : null, seen = {};
  var out = rows.filter(function (r) {
    var e = String(r[3]).trim().toLowerCase();
    if (!e || !r[5] || seen[e] || (cut && !(r[0] instanceof Date && r[0] > cut))) return false;
    return (seen[e] = true);
  });
  if (!out.length) { ui.alert('No new entrants since the last export.'); return; }
  var q = function (v) { return '"' + String(v).replace(/^'/, '').replace(/"/g, '""') + '"'; };
  var csv = ['email,first_name,last_name,team'].concat(out.map(function (r) {
    var parts = String(r[1]).trim().split(/\s+/), first = parts.shift() || '';
    return [r[3], first, parts.join(' '), r[5]].map(q).join(',');
  })).join('\n');
  var me = Session.getEffectiveUser().getEmail(), stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  MailApp.sendEmail({ to: me, subject: 'FGT entrants for beehiiv: ' + out.length + (all ? ' (everyone)' : ' new'), name: 'Fantasy Golf Tour',
    body: out.length + ' entrant' + (out.length === 1 ? '' : 's') + ' attached as a CSV (email, first_name, last_name, team; one row per email).\n\n' +
      'In beehiiv: Subscribers (Audience) > Add subscribers > Import CSV, and map the columns. Delete this email afterwards; it has players\' contact info.',
    attachments: [Utilities.newBlob(csv, 'text/csv', 'fgt-entrants-' + stamp + '.csv')] });
  props.setProperty('BEEHIIV_EXPORTED_AT', new Date().toISOString());
  ui.alert('Sent ' + out.length + ' entrant' + (out.length === 1 ? '' : 's') + ' to ' + me + '.');
}

// ---- Timer for the GitHub jobs ----------------------------------------------------------------
// GitHub's own scheduler runs hours late on busy weekends, so this script's 10-minute timer (Apps Script timers run
// on time) asks GitHub to start the jobs instead:
//   - Live scores (live.yml): every 10 minutes from 5am to 10pm Mountain on play days (finish - 3 to finish + 1),
//     and every 4 hours earlier in event week (field and tee times).
//   - Weekly results (weekly-results.yml): Sunday 4pm, 6pm and 9pm, Monday 4:44am and 6pm Mountain, when an FGT event
//     finished in the last 2 days.
// Needs Script Property GITHUB_DISPATCH_TOKEN: a GitHub fine-grained token for this repo only, with
// "Actions: Read and write" (it can start workflows; it can't read or change code). GitHub's schedules stay as backup.
var GH_REPO = 'BackwardsHAT123/fgt-tracker', TZ_MT = 'America/Denver';

function dispatch_(workflow, inputs) {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_DISPATCH_TOKEN');
  if (!token) return { ok: false, code: 0, msg: 'No GITHUB_DISPATCH_TOKEN in Script Properties.' };
  var res = UrlFetchApp.fetch('https://api.github.com/repos/' + GH_REPO + '/actions/workflows/' + workflow + '/dispatches', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    payload: JSON.stringify({ ref: 'main', inputs: inputs || {} })
  });
  var code = res.getResponseCode();
  return { ok: code === 204, code: code, msg: code === 204 ? 'started' : String(res.getContentText()).slice(0, 200) };
}

// What the timer should start at time `now` (a Date). Pure logic, so it can be tested: returns a list of workflow files.
function timerPlan_(now, schedule) {
  var f = function (pat) { return Utilities.formatDate(now, TZ_MT, pat); };
  var today = f('yyyy-MM-dd'), dow = Number(f('u')), hr = Number(f('H')), mn = Number(f('m'));   // u: 1 = Monday ... 7 = Sunday
  var dayDiff = function (iso) {   // days from today to iso (both Mountain dates)
    return Math.round((Date.parse(iso + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86400000);
  };
  var out = [], live = false, preview = false, finishedRecently = false;
  schedule.forEach(function (e) {
    if (!e.finish || e.counts !== 'Yes') return;
    var d = dayDiff(e.finish);              // finish - today
    if (d >= -1 && d <= 3) live = true;      // play days: Thursday (finish - 3) to the day after the finish
    else if (d >= 4 && d <= 6) preview = true;
    if (d <= 0 && d >= -2) finishedRecently = true;
  });
  if (live && hr >= 5 && hr <= 22) out.push('live.yml');
  else if (preview && hr % 4 === 0 && mn < 10) out.push('live.yml');
  var at = function (h, m0, m1) { return hr === h && mn >= m0 && mn < m1; };
  if (finishedRecently && ((dow === 7 && (at(16, 0, 10) || at(18, 0, 10) || at(21, 0, 10))) || (dow === 1 && (at(4, 40, 50) || at(18, 0, 10)))))
    out.push('weekly-results.yml');
  return out;
}

function timerTick() {
  var sch = tab_('Schedule'), rows = sch.getLastRow() < 2 ? [] : sch.getRange(2, 1, sch.getLastRow() - 1, 7).getValues();
  var schedule = rows.filter(function (r) { return r[0]; }).map(function (r) {
    return { event: String(r[0]), finish: r[1] instanceof Date ? Utilities.formatDate(r[1], TZ_MT, 'yyyy-MM-dd') : String(r[1] || ''), counts: String(r[4]) };
  });
  timerPlan_(new Date(), schedule).forEach(function (wf) {
    var r = dispatch_(wf);
    if (!r.ok && (r.code === 401 || r.code === 403 || r.code === 404 || r.code === 0)) {
      // Tell Tom once a day if the token has expired or lost access.
      var props = PropertiesService.getScriptProperties(), k = 'TIMER_WARNED', day = Utilities.formatDate(new Date(), TZ_MT, 'yyyy-MM-dd');
      if (props.getProperty(k) !== day) {
        props.setProperty(k, day);
        MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'FGT timer: GitHub token problem',
          'The FGT timer could not start ' + wf + ' on GitHub (' + r.code + ': ' + r.msg + ').\n\nThe token in Apps Script > Project Settings > Script Properties > GITHUB_DISPATCH_TOKEN has probably expired. ' +
          'Make a new one (fine-grained, this repo only, Actions: Read and write), paste it there, and run FGT > Test the GitHub timer token. GitHub\'s own (slower) schedules keep running meanwhile.');
      }
    }
  });
}

function testGithubTimer() {
  var r = dispatch_('live.yml');
  SpreadsheetApp.getUi().alert(r.ok ? 'Token works: GitHub started the Live scores job (it takes a minute; it writes "no event" outside event weeks).'
    : 'GitHub said ' + r.code + ': ' + r.msg);
}

function turnOnTimer() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'timerTick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('timerTick').timeBased().everyMinutes(10).create();
  SpreadsheetApp.getUi().alert('Timer is on: every 10 minutes it checks the Schedule and starts the Live scores and Weekly results jobs on GitHub when they are due.');
}

function setupSheets() {
  // Finds the Entries columns by header (adding any that are missing at the right end). Headers are never
  // rewritten by position, so Tom's own column order is kept.
  var E = entries_(['code', 'edited']), n = E.sh.getLastRow() - 1;
  if (E.missing.length) {
    var m = 'Stopped: the Entries tab has no column headed ' + E.missing.map(function (h) { return '"' + h + '"'; }).join(', ') +
      '. Type that header above the right column (exact name), then run Set up tabs again. Nothing was changed.';
    try { SpreadsheetApp.getUi().alert(m); } catch (x) {}
    throw new Error(m);
  }
  if (n > 0) {
    // Edit Code: the secret part of each team's edit link. Older entries get one here.
    var cr = E.sh.getRange(2, E.c.code, n, 1), cv = cr.getValues(), teams = E.sh.getRange(2, E.c.team, n, 1).getValues();
    if (cv.some(function (c, i) { return !c[0] && teams[i][0]; })) {
      cr.setValues(cv.map(function (c, i) { return [c[0] || !teams[i][0] ? c[0] : newCode_()]; }));
    }
    // Paid: a checkbox per entry for tracking Venmo payments. Only added to cells that are empty, so it can
    // never wipe out data. Private: the dashboard never reads the Entries tab.
    var pr = E.sh.getRange(2, E.c.paid, n, 1);
    if (!pr.getDataValidation() && pr.getValues().every(function (v) { return v[0] === '' || v[0] === false; })) pr.insertCheckboxes();
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
  if (!set.getRange(6, 1).getValue()) {
    set.getRange(6, 1).setValue('Payouts final (type Yes once the Payouts tab has the 2027 amounts)');
  }
  var pay = tab_('Payouts');
  if (pay.getLastRow() < 2) {
    pay.getRange(2, 1, PAYOUTS_2026.length, 2).setValues(PAYOUTS_2026.map(function (a, i) { return [i + 1, a]; }));
    pay.getRange('B:B').setNumberFormat('$#,##0');
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
  if (!golfers.length) return;
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
  // "How it was won" blurb for the recap, written by the weekly job from round scores (tools/fgt-lib.js storyFromRounds).
  if (d.story) PropertiesService.getScriptProperties().setProperty('STORY:' + name.toLowerCase().slice(0, 200), String(d.story).slice(0, 2000));
  if (d.lowRounds && d.lowRounds.length) PropertiesService.getScriptProperties().setProperty('LOWROUNDS:' + name.toLowerCase().slice(0, 200),
    JSON.stringify(d.lowRounds.slice(0, 15).map(function (r) { return [clean_(r.golfer), Number(r.round) || 0, Number(r.score) || 0, Number(r.par) || 0]; })).slice(0, 4000));
  refreshEventScores();
  // Weekly recap for beehiiv: emailed to the owner the first time an event's results arrive (repeat runs don't resend).
  try { maybeSendRecap_(name); } catch (x) {}
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
  var E = entries_();
  if (E.missing.length) {
    var m = 'Stopped: the Entries tab has no column headed ' + E.missing.map(function (h) { return '"' + h + '"'; }).join(', ') +
      '. Fix the header, then try again. Nothing was changed.';
    try { SpreadsheetApp.getUi().alert(m); } catch (x) {}
    throw new Error(m);
  }
  var data = E.rows().map(E.obj);
  // Read everything first and stop before clearing anything if the Golfers column doesn't look right
  // (for example a header that no longer matches its column), so a bad layout can't empty the tabs.
  var teams = data.filter(function (o) { return o.team; });
  var bad = teams.filter(function (o) { return !golfersFromList_(o.golfers).length; });
  var seenId = {}, dupId = teams.filter(function (o) {
    var id = String(o.id === true || o.id === false ? '' : o.id).trim();
    if (!id) return false;
    if (seenId[id]) return true;
    seenId[id] = 1; return false;
  });
  if (bad.length || dupId.length) {
    var msg = 'Stopped: ' + (bad.length
      ? bad.length + ' team(s) have no readable golfers in the "Golfers" column (first: "' + bad[0].team + '").'
      : 'two teams share the Entry ID "' + dupId[0].id + '".') +
      ' Check that each Entries header sits above the right data. Nothing was changed.';
    try { SpreadsheetApp.getUi().alert(msg); } catch (x) {}
    throw new Error(msg);
  }
  var lin = tab_('Lineups'), st = tab_('Standings');
  [lin, st].forEach(function (sh) {
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  });
  data.forEach(function (o, i) {
    if (!o.team) return;
    var id = o.id;
    if (!id || id === true) {
      id = Utilities.getUuid().slice(0, 8);
      E.sh.getRange(i + 2, E.c.id).clearDataValidations().setValue(id); // drops a stray checkbox, if any
    }
    addLineup_(id, o.team, golfersFromList_(o.golfers));
    addStanding_(id, o.team, o.name, o.points, o.count);
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

// The Entries tab and where each of its columns is (see ENTRY_COLS). E.c.team is the Team Name column number,
// E.rows() the data rows, E.obj(row) a row as {team, email, ...}, E.toRow(obj) a row array for appendRow.
// E.missing lists headers not found (their column number is 0). addKeys: keys that may be added at the right end.
function entries_(addKeys) {
  var sh = sheet_();
  var width = Math.max(sh.getLastColumn(), 1);
  var head = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var c = {}, missing = [];
  Object.keys(ENTRY_COLS).forEach(function (k) {
    var i = head.indexOf(ENTRY_COLS[k].toLowerCase());
    if (i < 0 && !(addKeys && addKeys.indexOf(k) >= 0)) { c[k] = 0; missing.push(ENTRY_COLS[k]); return; }
    if (i < 0) {
      width++; head.push(ENTRY_COLS[k].toLowerCase());
      sh.getRange(1, width).setValue(ENTRY_COLS[k]).setFontWeight('bold');
      i = width - 1;
    }
    c[k] = i + 1;
  });
  c.width = width;
  var E = { sh: sh, c: c, missing: missing };
  E.rows = function () { var last = sh.getLastRow(); return last < 2 ? [] : sh.getRange(2, 1, last - 1, width).getValues(); };
  E.obj = function (r) { var o = {}; Object.keys(ENTRY_COLS).forEach(function (k) { o[k] = c[k] ? r[c[k] - 1] : ''; }); return o; };
  E.toRow = function (o) {
    var row = []; for (var i = 0; i < width; i++) row.push('');
    Object.keys(o).forEach(function (k) { if (c[k]) row[c[k] - 1] = o[k]; });
    return row;
  };
  return E;
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
