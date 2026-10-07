/* ❄ Rimfrost was renamed Frostseeker (2026-10-07, the Steam store name). The old spellings may live on only as
   migration and compatibility aliases: migrate()'s RENAMED rows (local saves), isFKLegend (peer look packets and other
   accounts' leaderboard rows, which we cannot rewrite) and RENAMED_ITEMS (leaderboard names). isFK takes every spelling
   and syncFrostseeker stamps the new one, so a blade that slipped past migrate() heals on its next sync. Everything a
   player can read says Frostseeker, and the art files carry the new name. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const lineOf = start => { const l = src.split('\n').find(x => x.startsWith(start)); assert.ok(l, start + ' not found'); return l; };
const fnSrc = name => { const i = src.indexOf('function ' + name + '('); assert.ok(i >= 0, name + ' not found'); return src.slice(i, src.indexOf('\n}\n', i) + 2); };

test('isFKLegend and isFK take the new key and every name the blade has ever had', () => {
  const c = {}; vm.runInNewContext(lineOf('const isFKLegend=') + ';' + lineOf('const isFK=') + ';this.isFKLegend=isFKLegend;this.isFK=isFK;', c);
  for (const k of ['frostseeker', 'rimfrost', 'frostkeen', 'frostmourne']) {
    assert.equal(c.isFKLegend(k), true, k);
    assert.ok(c.isFK({ legend: k }), 'isFK ' + k);
  }
  for (const k of ['felglaives', 'thering', '', undefined]) assert.equal(c.isFKLegend(k), false, String(k));
  assert.ok(!c.isFK(null) && !c.isFK({ legend: 'felglaives' }));
});

test('syncFrostseeker stamps the new key and name on a blade that slipped past migrate()', () => {
  const c = { S: {}, LEGEND_MAX_UP: 6, fkBaseAtk: () => 100, calcPower() {} };
  vm.runInNewContext(lineOf('const isFKLegend=') + ';' + lineOf('const isFK=') + ';' + fnSrc('syncFrostseeker') + ';this.sync=syncFrostseeker;', c);
  const it = c.sync({ legend: 'rimfrost', name: 'Rimfrost', up: 9 });
  assert.equal(it.legend, 'frostseeker'); assert.equal(it.name, 'Frostseeker');
  assert.equal(it.up, 6, 'the legendary cap still applies'); assert.equal(it.atk, Math.round(100 * Math.pow(1.12, 6)));
  const sword = { legend: 'sword', name: 'Fine Sword' }; c.sync(sword);
  assert.deepEqual({ ...sword }, { legend: 'sword', name: 'Fine Sword' }, 'other weapons are left alone');
});

test("migrate()'s real rename block rewrites every old key and name in the worn slots, the bag and the forge order", () => {
  const start = src.indexOf('\n {\n  const RENAMED=[');
  const end = src.indexOf('\n }\n', start);
  assert.ok(start > 0 && end > start, 'the RENAMED block in migrate() moved - update this test');
  const block = src.slice(start, end + 3);
  const s = { gear: { weapon: { legend: 'rimfrost', name: 'Rimfrost', star: 2 }, armor: null },
    bag: [{ legend: 'frostkeen', name: 'Frostkeen' }, { legend: 'frostmourne', name: 'Frostmourne' }, { legend: 'warglaives', name: 'Warglaives' }],
    smithJob: { kind: 'fm' } };
  vm.runInNewContext(block, { s });
  assert.deepEqual({ ...s.gear.weapon }, { legend: 'frostseeker', name: 'Frostseeker', star: 2 });
  assert.deepEqual(Array.from(s.bag, b => b.legend + '/' + b.name), ['frostseeker/Frostseeker', 'frostseeker/Frostseeker', 'felglaives/Fel Glaives']);
  assert.equal(s.smithJob.kind, 'fk');
});

test('leaderboard rows still saying Rimfrost are shown as Frostseeker', () => {
  const c = {}; vm.runInNewContext(lineOf('const RENAMED_ITEMS=') + ';' + lineOf('const displayItemName=') + ';this.d=displayItemName;', c);
  for (const n of ['Rimfrost', 'Frostkeen', 'Frostmourne']) assert.equal(c.d(n), 'Frostseeker', n);
  assert.equal(c.d('Frostseeker'), 'Frostseeker');
});

test('nothing that ships still says Rimfrost, except the aliases in game.js', () => {
  /* the same ignore list as the dist script: whatever it keeps goes into the exe */
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const ignore = new RegExp(pkg.scripts.dist.match(/--ignore="([^"]+)"/)[1]);
  const TEXT = /\.(js|cjs|mjs|json|css|html|md|txt|webmanifest|svg)$/i;
  const stray = [];
  const walk = rel => {
    for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const r = rel + '/' + e.name;
      if (ignore.test(r) || /^\/(node_modules|dist|\.git)\b/.test(r)) continue;
      if (e.isDirectory()) { walk(r); continue; }
      if (/rimfrost/i.test(e.name)) stray.push(r + ' (file name)');
      if (!TEXT.test(e.name)) continue;
      const lines = fs.readFileSync(path.join(root, r), 'utf8').split('\n');
      lines.forEach((l, i) => { if (/rimfrost/i.test(l)) stray.push(r + ':' + (i + 1)); });
    }
  };
  walk('');
  const allowed = ["['rimfrost','frostseeker','Rimfrost','Frostseeker']", 'const isFKLegend=', 'const RENAMED_ITEMS=', 'the blade was called Frostmourne, then Frostkeen, then Rimfrost'];
  const gameLines = src.split('\n');
  const left = stray.filter(s => { const m = s.match(/^\/game\.js:(\d+)$/); return !(m && allowed.some(a => gameLines[m[1] - 1].includes(a))); });
  assert.deepEqual(left, []);
  for (const n of ['frostseeker', 'frostseeker_bow', 'frostseeker_mace', 'frostseeker_staff']) {
    assert.ok(fs.existsSync(path.join(root, 'assets/models', n + '.png')), n + '.png missing');
    assert.ok(src.includes("'assets/models/" + n + ".png'") || src.includes("'" + n + "'"), n + ' not referenced');
  }
});
