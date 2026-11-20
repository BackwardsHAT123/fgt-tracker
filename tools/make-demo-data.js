// Makes site/dashboard-demo.js: FAKE teams plus the real Austin Championship money, for previewing the dashboard.
// Usage: node tools/make-demo-data.js /path/to/austin-full.json   (full field from tools/pull-results.js)
// Demo events 2 and 3 are the Austin money reshuffled among golfers. All numbers except event 1 are invented.
const fs = require('fs');
const austin = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Use the full field (cuts and withdrawals too) so the made-the-cut chart has something to show.
const names = austin.rows.map(r => r.golfer);
const slots = austin.rows.map(r => [r.finish, r.earnings]);   // finish + money pairs, reshuffled for the invented events
const events = [
  { event: 'Austin Championship', date: '2026-11-15', pay: austin.rows.map(r => [r.golfer, r.finish, r.earnings]) },
  { event: 'Demo Event 2', date: '2026-11-22', pay: shuffle(names).map((n, i) => [n, slots[i][0], slots[i][1]]) },
  { event: 'Demo Major', date: '2026-11-29', pay: shuffle(names).map((n, i) => [n, slots[i][0], slots[i][1]]) }
];
const results = [];
events.forEach(e => e.pay.forEach(([g, f, m]) => results.push({ event: e.event, date: e.date, golfer: g, finish: f, earnings: m })));

const teamNames = ['Birdies', 'Eagles', 'Bogeys', 'Mulligans', 'Sandbaggers', 'Fairway Finders', 'Green Jackets', 'Slice Girls',
  'Chip Shots', 'Long Drivers', 'Back Nine', 'Hole In Won', 'Grip It And Rip It', 'Shanks A Lot', 'Tee Time Titans', 'Putt Pirates',
  'Wedge Wizards', 'Bunker Busters', 'Dogleg Dynasty', 'Albatross Alley', 'Divot Diggers', 'Lip Outs', 'Pin Seekers', 'Iron Maidens',
  'Gimme Gang', 'Clubhouse Heroes', 'Rough Riders', 'Ace Ventura', 'Par Tee Animals', 'Driving Miss Daisy', 'Fore Play',
  'Course Correction', 'Hook Line Sinker', 'Ball Hawks', 'Range Rats', 'Frog Hair', 'Stimp Meters', 'Flagstick Five', 'Yips Club',
  'Sunday Red'].map(n => 'Demo ' + n);
const lineups = [];
teamNames.forEach(t => shuffle(names).slice(0, 8).forEach(g => lineups.push({ team: t, golfer: g, points: 1 + Math.floor(rnd() * 6) })));

const book = {}; // event -> team -> money
const earn = (ev, g) => (events.find(e => e.event === ev).pay.find(p => p[0] === g) || [0, 0, 0])[2];
const eventScores = [];
events.forEach(e => teamNames.forEach(t => {
  const m = lineups.filter(l => l.team === t).reduce((s, l) => s + earn(e.event, l.golfer), 0);
  eventScores.push({ event: e.event, team: t, earnings: m });
}));
// Weekly prizes (rules sheet). 'Demo Major' is scored as a Major so the 2nd-place prize shows.
const PRIZES = { regular: [150], signature: [200], players: [200], major: [300, 100] };
function prizesFor(earned, prizes) {
  const out = earned.map(() => 0);
  const order = earned.map((v, i) => i).filter(i => earned[i] > 0).sort((a, b) => earned[b] - earned[a]);
  let pos = 0;
  while (pos < order.length && pos < prizes.length) {
    let end = pos; while (end + 1 < order.length && earned[order[end + 1]] === earned[order[pos]]) end++;
    let pot = 0; for (let p = pos; p <= end; p++) pot += prizes[p] || 0;
    for (let q = pos; q <= end; q++) out[order[q]] = Math.round(pot / (end - pos + 1) * 100) / 100;
    pos = end + 1;
  }
  return out;
}
events.forEach(e => {
  const rows = eventScores.filter(x => x.event === e.event);
  const pz = prizesFor(rows.map(x => x.earnings), PRIZES[e.event === 'Demo Major' ? 'major' : 'regular']);
  rows.forEach((x, i) => { x.prize = pz[i]; });
  rows.forEach(x => { x.rank = 1 + rows.filter(y => y.earnings > x.earnings).length; });
  const top = rows.filter(x => x.rank === 1 && x.earnings > 0);
  rows.forEach(x => { x.share = x.rank === 1 && x.earnings > 0 ? 1 / top.length : 0; });
});
const standings = teamNames.map(t => ({
  team: t, earnings: eventScores.filter(x => x.team === t).reduce((s, x) => s + x.earnings, 0),
  wins: eventScores.filter(x => x.team === t).reduce((s, x) => s + x.share, 0),
  winnings: eventScores.filter(x => x.team === t).reduce((s, x) => s + x.prize, 0)
})).sort((a, b) => b.earnings - a.earnings).map((x, i) => Object.assign(x, { rank: i + 1, paid: false }));

// The real points list, so Past Finishes and points-based views have golfers to show.
const G = new Function(fs.readFileSync(__dirname + '/../apps-script/Golfers.gs', 'utf8') + ';return GOLFERS;')();
const golfers = G.map(g => ({ golfer: g[0], points: g[1] }));
// The real 2027 schedule, plus the invented 'Demo Major' so the Schedule tab shows a scored Major.
const schedule = JSON.parse(fs.readFileSync(__dirname + '/../data/schedule-2027.json', 'utf8')).events
  .map(e => ({ event: e.event, finish: e.finish, purse: e.purse || 0, counts: e.counts, type: e.type }))
  .concat([{ event: 'Demo Major', finish: '2026-11-29', purse: 0, counts: 'Yes', type: 'major' }]);
const data = {
  ok: true, demo: true, generated: new Date().toISOString(), closed: true, paidSpots: 0,
  standings, schedule, eventScores, results, golfers, lineups, prizes: PRIZES
};
fs.writeFileSync(__dirname + '/../site/dashboard-demo.js',
  '// FAKE demo data for previewing site/dashboard.html (open it with ?demo=1). Generated by tools/make-demo-data.js.\n' +
  'window.FGT_DEMO = ' + JSON.stringify(data) + ';\n');
console.log(teamNames.length + ' fake teams, ' + results.length + ' result rows');
