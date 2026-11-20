// Saves the live dashboard feed as site/data/dashboard.json, so the dashboard shows it instantly
// (the live Google feed takes 2-4 seconds). Run after posting results:  node tools/snapshot-dashboard.js
// Then commit and push site/data/dashboard.json. Needs network, so run outside the sandbox.
// Refuses to write if the feed contains anything that looks like an email, phone number or Entry ID.
const { saveSnapshot } = require('./fgt-lib');
saveSnapshot().then(m => console.log(m)).catch(e => { console.error('Stopped: ' + e.message); process.exit(1); });
