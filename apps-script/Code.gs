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
  'Points Used', '# Golfers', 'Golfers', 'Lineup Key', 'Duplicate Of Row', 'Points Version'
];

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

    sheet.appendRow([
      new Date(), name, phone, email, address, team,
      total, golfers.length, list, key, '', clean_(d.pointsVersion)
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'Server error. Please try again.' });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
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
