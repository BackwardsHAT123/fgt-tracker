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
  'Points Used', '# Golfers', 'Golfers', 'Lineup Key', 'Duplicate Of Row', 'Points Version', 'Entry ID'
];

// Other tabs. Only "Entries" holds contact info; Standings and Lineups carry team and name only,
// so a dashboard can read them without seeing phones or emails.
var TABS = {
  Golfers:     ['Golfer', 'Points', 'Group', 'Version'],
  Tournaments: ['Tournament', 'Date', 'Golfer', 'Finish', 'Position', 'Score To Par', 'Earnings', 'Fantasy Points'],
  Lineups:     ['Entry ID', 'Team Name', 'Golfer', 'Points', 'Fantasy Points'],
  Standings:   ['Rank', 'Entry ID', 'Team Name', 'Name', 'Points Used', '# Golfers', 'Fantasy Points']
};

function doGet() {
  return json_({ ok: true, message: 'FGT entry endpoint is running.' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var d = JSON.parse(e.postData.contents);

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
      total, golfers.length, list, key, '', clean_(d.pointsVersion), entryId
    ]);

    // The entry is already saved. A problem in the extra tabs must never lose it or fail the submit;
    // "FGT > Rebuild Lineups and Standings" repairs them from Entries.
    try {
      addLineup_(entryId, team, golfers);
      addStanding_(entryId, team, name, total, golfers.length);
    } catch (x) {}
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
    .addItem('Rebuild Lineups and Standings', 'rebuildLineupsAndStandings')
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
function setupSheets() {
  var entries = sheet_();
  if (entries.getRange(1, 13).getValue() !== 'Entry ID') {
    entries.getRange(1, 13).setValue('Entry ID').setFontWeight('bold');
  }
  Object.keys(TABS).forEach(tab_);
  var t = tab_('Tournaments');
  t.getRange('B:B').setNumberFormat('yyyy-mm-dd');
  refreshGolfers();
  rebuildLineupsAndStandings();
}

// Replaces the Golfers tab contents with the list in Golfers.gs (generated from site/players.js).
function refreshGolfers() {
  var sh = tab_('Golfers');
  sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), TABS.Golfers.length).clearContent();
  var rows = GOLFERS.map(function (g) { return [g[0], g[1], g[2], GOLFERS_VERSION]; });
  sh.getRange(2, 1, rows.length, 4).setValues(rows);
}

function lineupFormula_(row) {
  return '=SUMIF(Tournaments!$C:$C,C' + row + ',Tournaments!$H:$H)';
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
  sh.getRange(row, 1, 1, 7).setValues([['', entryId, team, name, total, count, '']]);
  sh.getRange(row, 7).setFormula('=SUMIF(Lineups!$A:$A,B' + row + ',Lineups!$E:$E)');
  sh.getRange(row, 1).setFormula('=IF(B' + row + '="","",RANK(G' + row + ',$G$2:$G$1000))');
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
