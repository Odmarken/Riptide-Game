/* Run with: node --test tests/hero-test-mode.test.cjs
 * 🧪 The hero test (2026-10-12: "ge mig ett test build där alla karaktärer finns och alla har alla outfits och legendarys och
 * mounts så jag kan testa allt"). The real code, cut out of game.js: the shell starts it before the cloud; every race, sex and
 * class is on the hero list, each with every outfit unlocked, every legendary and every mount; the list, Enter World, Delete and
 * Change Character work on the test's own 32 in memory and never on this device's heroes; Enter World wakes at the stable.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const section = (a, b) => { const i = game.indexOf(a), j = game.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, 'cannot find ' + a); return game.slice(i, j); };
const Mounts = require('../assets/mounts/mounts.js');
const CityEconomy = require('../assets/city/economy.js');
const ids = list => [...section('const ' + list + '=[', '];').matchAll(/\{id:'([a-z]+)'/g)].map(m => m[1]);

function heroTest() {
  const made = [], shown = [];
  const c = vm.createContext({ Math, Date, JSON, Mounts, CityEconomy, made, shown,
    RACES: ids('RACES').map(id => ({ id })), CLASSES: ids('CLASSES').map(id => ({ id })), MAXLVL: 60, WASTELAND_ZONE: 7, LEGEND_MAX_UP: 6,
    freshState: (name, race, cls) => ({ name, race, cls, lvl: 1, prestige: 0, zone: 0, maxZone: 0, gear: { weapon: null, armor: null, trinket: null },
      bag: [], mounts: Mounts.normalize(null), city: CityEconomy.create() }),
    migrate: s => s });
  vm.runInContext('let S=null,gameOn=false;'
    + 'const syncFrostseeker=it=>(made.push(["frostseeker",S&&S.id]),it),syncFelGlaives=it=>(made.push(["felglaives",S&&S.id]),it);'
    + 'const makeIceArmor=st=>(made.push(["icearmor",S&&S.id,st.id]),{legend:"icearmor",slot:"armor"}),rollTheRing=()=>(made.push(["thering",S&&S.id]),{legend:"thering",slot:"trinket"});'
    + 'const isIce=it=>it&&it.legend==="icearmor";function showSelect(){shown.push(S);}'
    + section('const TEST_NAMES=', 'function raidTest(') + section('const TEST_NAMES_F=', 'function outfitTest(')
    + section('let TEST_ROSTER=null;', 'const fmtNum=') + section('function outfitUnlocked(', 'function heroOutfit(')
    + ';this.heroesTest=heroesTest;this.testArrive=testArrive;this.outfitUnlocked=outfitUnlocked;this.roster=()=>TEST_ROSTER;'
    + 'this.set=(s,g)=>{S=s;gameOn=g;};this.S=()=>S;', c);
  return c;
}

test('the hero test: started by the shell before the cloud, every race, sex and class on the hero list', () => {
  const boot = game.slice(game.indexOf('(async()=>{\n /* 🧪'), game.indexOf('if(FB.user)await enterAfterAuth();'));
  assert.ok(boot.includes("if(test==='heroes'){") && /heroesTest\(\);return;\}/.test(boot));
  assert.ok(boot.indexOf("test==='heroes'") < boot.indexOf('await initFirebase()'));
  const c = heroTest();
  assert.equal(c.heroesTest(), 'hero test: 32 heroes on the list');
  const heroes = [...c.roster().values()].map(j => JSON.parse(j));
  assert.equal(heroes.length, 32);
  const combos = new Set(heroes.map(h => h.race + h.gender + h.cls));
  assert.equal(combos.size, 32, 'every race x sex x class once');
  for (const r of ['human', 'dwarf', 'orc', 'undead']) for (const g of ['m', 'f']) for (const k of ['warrior', 'mage', 'hunter', 'priest'])
    assert.ok(combos.has(r + g + k), r + g + k);
  assert.equal(new Set(heroes.map(h => h.id)).size, 32);
  assert.equal(new Set(heroes.filter(h => h.gender === 'm').map(h => h.name)).size, 16, 'sixteen different men');
  assert.equal(new Set(heroes.filter(h => h.gender === 'f').map(h => h.name)).size, 16, 'sixteen different women');
  assert.deepEqual(heroes.map(h => h.createdAt), heroes.map((h, i) => i + 1), 'listed in race, sex, class order');
  assert.equal(c.shown.length, 1, 'the hero list opens');
  vm.runInContext('S={id:"real"};gameOn=true;', c);
  assert.match(c.heroesTest(), /^Change Character first/, 'never takes over a real hero in play');
});

test('each test hero: level 60, Prestige 40, every outfit, every legendary made for him, every mount with the dragon saddled, never saved', () => {
  const c = heroTest();
  c.heroesTest();
  for (const json of c.roster().values()) {
    const h = JSON.parse(json);
    assert.deepEqual([h.test, h.lvl, h.prestige, h.zone, h.introPending], [true, 60, 40, 7, false], h.id);
    for (const o of ['default', 'ice', 'royal', 'emperor']) assert.ok(c.outfitUnlocked(o, h), h.id + ' ' + o);
    assert.equal(h.outfit, 'default');
    assert.ok(h.emperorRegaliaOffered, 'the once-only regalia offer is not in the way');
    assert.deepEqual(h.mounts.owned, Mounts.catalog.map(m => m.id));
    assert.equal(h.mounts.equipped, 'dragon');
    assert.deepEqual([h.gear.weapon.legend, h.gear.weapon.star, h.gear.armor.legend, h.gear.trinket.legend], ['frostseeker', 3, 'icearmor', 'thering']);
    assert.deepEqual(h.bag.map(it => [it.legend, it.star]), [['felglaives', 3]]);
  }
  /* the legendaries size themselves to S: each was made while S was that hero, and S is given back afterwards */
  const heroes = [...c.roster().keys()];
  assert.equal(c.made.length, 32 * 4);
  for (const [kind, sId, stId] of c.made) { assert.ok(heroes.includes(sId), kind); if (stId) assert.equal(sId, stId); }
  assert.equal(c.S(), null);
});

test('the hero list, Enter World, Delete and Change Character work on the test\'s own heroes and never on this device', async () => {
  const loads = section('async function loadRoster(){', 'async function saveRoster(') + section('async function loadChar(id){', 'async function legacyLoad(');
  const device = [];
  const c = vm.createContext({ JSON, TEST_ROSTER: null, device, memRosters: {}, memChars: {}, migrate: s => ({ ...s, migrated: true }),
    rosterKey: () => 'riptide-roster', deviceGet: async k => { device.push(k); return null; } });
  vm.runInContext(loads + ';this.loadRoster=loadRoster;this.loadChar=loadChar;', c);
  c.TEST_ROSTER = new Map([['test-human-m-warrior', JSON.stringify({ id: 'test-human-m-warrior', test: true })], ['test-orc-f-mage', JSON.stringify({ id: 'test-orc-f-mage', test: true })]]);
  assert.deepEqual([...await c.loadRoster()], ['test-human-m-warrior', 'test-orc-f-mage']);
  assert.deepEqual({ ...await c.loadChar('test-orc-f-mage') }, { id: 'test-orc-f-mage', test: true, migrated: true });
  assert.deepEqual(device, [], 'the device is never read for the test');
  vm.runInContext('TEST_ROSTER=null;', c);
  assert.deepEqual([...await c.loadRoster()], []);
  assert.ok(device.includes('riptide-roster'), 'without the test the device roster is read as before');

  const select = section('async function renderSelect(){', 'function showSelect(){');
  const del = select.slice(select.indexOf("document.querySelectorAll('[data-del]')"));
  assert.ok(del.indexOf('if(TEST_ROSTER){TEST_ROSTER.delete(b.dataset.del);renderSelect();return;}') < del.indexOf('rememberDeletion'), 'a test hero is deleted from memory only');
  assert.ok(/beginGame\(false\);\n  if\(TEST_ROSTER&&S\.test\)testArrive\(\);/.test(select), 'Enter World wakes a test hero at the stable');
  const show = section('function showSelect(){', 'function showCreate(');
  const kept = show.indexOf('TEST_ROSTER.set(S.id,JSON.stringify(saveSnapshot()))');
  assert.ok(show.indexOf('closeCasinoWindows()') < kept && kept < show.indexOf('gameOn=false'), 'Change Character keeps what was changed, once the casino has handed back what is his');
});

test('Enter World wakes the hero at Torsten\'s stable once, after the loading screen', () => {
  const logs = [], hero = { x: 0, y: 0, fx: 1, moveTo: { x: 9, y: 9 } };
  let boot = false;
  const c = vm.createContext({ logs, hero, world: { stable: { vendor: { x: 1000, y: 2000 } } }, esc: s => s, log: t => logs.push(t),
    zoneOf: () => ({ wasteland: true }), $: () => ({ classList: { contains: () => boot } }), setTimeout: f => f() });
  vm.runInContext('let S={name:"Bjorn",test:true},gameOn=true;' + section('function testArrive(){', 'const fmtNum=')
    + ';this.testArrive=testArrive;this.S=()=>S;', c);
  boot = false;
  let calls = 0;
  c.$ = () => ({ classList: { contains: () => (++calls > 2) } });   /* the loading screen goes after two looks */
  vm.runInContext('$=this.$;', c);
  c.testArrive();
  assert.deepEqual([hero.x, hero.y, hero.fx, hero.moveTo], [1030, 2075, -1, null]);
  assert.ok(Math.hypot(30, 75) < 110, 'close enough to open the stable');
  assert.ok(c.S().testArrived);
  assert.match(logs[0], /Hero test/);
  hero.x = 5;
  c.testArrive();
  assert.equal(hero.x, 5, 'only the first time');
});
