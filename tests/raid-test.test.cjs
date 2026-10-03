/* Run with: node --test tests/raid-test.test.cjs
 * 🧪 The raid test (asked for 2026-10-03): `--riptide-test=raid` starts a throwaway hero - a man of a random race and class - who
 * is a crowned head at war with Silverfjord and sails there with every guard the realm has. It must never touch the player's
 * heroes: the shell gives it a profile of its own, it never signs in, and the hero is kept out of every save.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const game = read('game.js'), main = read('main.js'), preload = read('preload.js');
const section = (a, b) => { const i = game.indexOf(a), j = game.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, 'cannot find ' + a); return game.slice(i, j); };

test('the shell runs a test in a profile of its own, chosen before anything reads or locks the real one', () => {
  const set = main.indexOf("app.setPath('userData'");
  assert.ok(set > 0 && main.includes("--riptide-test="), 'the switch moves userData');
  assert.ok(main.includes("app.setPath('sessionData'"), 'and the storage with it');
  for (const later of ["const LOG = path.join(app.getPath('userData')", "const CFG = path.join(app.getPath('userData')", 'app.requestSingleInstanceLock()'])
    assert.ok(main.indexOf(later) > set, later + ' comes after the switch');
  assert.ok(main.includes("ipcMain.handle('test:scenario', () => TEST)") && preload.includes("testScenario: () => ipcRenderer.invoke('test:scenario')"));
});

test('a test hero is never written anywhere: the device, the cloud, the leaderboard or the spot he stood on', () => {
  for (const head of ['async function save(){', 'async function saveNow(){', 'function flushCloud(){', 'async function publishLB(ch,force){', 'function spotStamp(force){']) {
    const i = game.indexOf(head); assert.ok(i >= 0, head);
    const first = game.slice(i + head.length, game.indexOf('\n', game.indexOf('\n', i) + 1));
    assert.ok(/\b(S|ch)\.test\b/.test(first) && /return/.test(first), head + ' bails on a test hero first: ' + first);
  }
  const boot = game.slice(game.indexOf('(async()=>{\n /* 🧪'), game.indexOf('if(FB.user)await enterAfterAuth();'));
  assert.ok(boot.indexOf("testScenario") < boot.indexOf('await initFirebase()'), 'the test starts before the cloud is even loaded');
  assert.ok(boot.includes("if(test&&test.split(':')[0]==='raid'){") && /raidTest\(test\.split\(':'\)\[1\]\|\|undefined\);return;\}/.test(boot), 'and never reaches the sign-in - raid, or raid:<port>');
});

test('raidTest makes a crowned head at war with Silverfjord who sails with his whole guard once the loading screen is gone', () => {
  const E = require('../assets/city/economy.js');
  const timers = [], sailed = [], logs = [];
  const box = vm.createContext({
    Math, Date, CityEconomy: E, logs, sailed, timers,
    RACES: [{ id: 'human', name: 'Human' }, { id: 'orc', name: 'Orc' }], CLASSES: [{ id: 'warrior', name: 'Warrior' }, { id: 'mage', name: 'Mage' }],
    HARBOR_ZONE: 35, HOME_PORT: { x: 1180, y: 3050 },
    townZone: id => id === 'silverfjord' ? 36 : -1,
    raidAlly: id => E.ALLIES.find(a => a.id === id),
    freshState: (name, race, cls) => ({ name, race, cls, city: E.create() }), migrate: s => s,
    esc: s => s, renderHUD() {}, log: (t) => logs.push(t),
    $: id => ({ classList: { remove() {}, contains: c => c === 'gone' } }),
    setTimeout: f => timers.push(f),
  });
  vm.runInContext('let S=null,gameOn=false,expeditionSpawn=null,voyage=null;function beginGame(){gameOn=true;}function setSail(t){sailed.push(t);}'
    + section('const TEST_NAMES=', 'const fmtNum=') + ';this.raidTest=raidTest;this.S=()=>S;this.spawn=()=>expeditionSpawn;', box);
  assert.match(box.raidTest(), /^raid test: \w+ the (Human|Orc) (Warrior|Mage) sails for Silverfjord$/);
  const S = box.S(), c = S.city;
  assert.equal(S.test, true); assert.equal(S.gender, 'm'); assert.equal(S.outfit, 'royal'); assert.equal(S.zone, 35);
  assert.deepEqual({ ...box.spawn() }, { zone: 35, x: 1180, y: 3050 }, 'on the pier beside Blackbeard');   /* spread: the vm's objects are of another realm */
  assert.ok(c.chartered && c.crowned && c.allies.silverfjord.war, 'a crowned head, at war');
  assert.equal(c.expedition, null, 'nobody has sailed yet - the men board with the ship, or the raid would end before it began');
  timers.shift()();
  assert.deepEqual(sailed, ['silverfjord']);
  const e = c.expedition;
  assert.equal(e.ally, 'silverfjord'); assert.equal(e.auto, false);
  assert.equal(e.watch + e.cadets + e.mercs, 133, 'the whole watch, the cadets and a hundred sellswords');
  assert.equal(e.cap, E.RAID_CAP, 'strong enough to raze all a raid can');
  const before = box.raidTest();
  assert.match(before, /^raid test: /, 'a second test may follow the first');
  vm.runInContext('S={id:"real"};gameOn=true;', box);
  assert.match(box.raidTest(), /^Change Character first/, 'but never takes over a real hero in play');
});
