/* Run with: node --test tests/crown-test.test.cjs
 * 🧪 The crown test (asked for 2026-10-11: "en exe test som är precis innan man ska krönas ... jag ska klicka själv i council
 * bordet ge mig en undead hunter"): `--riptide-test=crown` starts a throwaway Undead Hunter the moment before the crown - chartered,
 * a season graded, full trust, a devoted council, the crown not yet taken - in the Throne Hall before the council table; the player
 * clicks the table. It runs in the raid test's profile of its own, never signs in, and the hero is kept out of every save
 * (tests/raid-test.test.cjs pins those parts).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const game = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const section = (a, b) => { const i = game.indexOf(a), j = game.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, 'cannot find ' + a); return game.slice(i, j); };

test('the shell starts the crown test before the cloud is even loaded, like the other tests', () => {
  const boot = game.slice(game.indexOf('(async()=>{\n /* 🧪'), game.indexOf('if(FB.user)await enterAfterAuth();'));
  assert.ok(boot.includes("if(test==='crown'){") && /crownTest\(\);return;\}/.test(boot), 'crown starts the test and never reaches the sign-in');
  assert.ok(boot.indexOf("test==='crown'") < boot.indexOf('await initFirebase()'));
});

test('crownTest makes an Undead Hunter who can take the crown and has not, in the Throne Hall before the council table - the clicking is the player\'s', () => {
  const E = require('../assets/city/economy.js');
  const timers = [], logs = [], ledger = [], zones = [];
  let bootGone = false, throne = false;
  const hero = { x: 0, y: 0, moveTo: { x: 1, y: 1 }, target: {} };
  const box = vm.createContext({
    Math, Date, CityEconomy: E, timers, logs, ledger, zones, hero,
    RACES: [{ id: 'human', name: 'Human' }, { id: 'undead', name: 'Undead' }], CLASSES: [{ id: 'warrior', name: 'Warrior' }, { id: 'hunter', name: 'Hunter' }],
    CITY_ZONE: 26, THRONE_ZONE: 30, ThroneWorld: { TABLE: { x: 900, y: 640 } },
    freshState: (name, race, cls) => ({ name, race, cls, bag: [], city: E.create() }), migrate: s => s,
    esc: s => s, log: t => logs.push(t), openLedger: t => ledger.push(t),
    zoneOf: () => ({ throne }), goToZone: i => { zones.push(i); throne = true; },
    $: () => ({ classList: { remove() {}, contains: c => c === 'gone' && bootGone } }),
    setTimeout: f => timers.push(f),
  });
  vm.runInContext('let S=null,gameOn=false;function beginGame(){gameOn=true;}'
    + section('const TEST_NAMES=', 'function raidTest(') + section('const TEST_NAMES_F=', 'const fmtNum=')
    + ';this.crownTest=crownTest;this.S=()=>S;', box);
  assert.match(box.crownTest(), /^crown test: \w+ the Undead Hunter, in the Throne Hall before the council table$/);
  const S = box.S(), c = S.city;
  assert.equal(S.test, true, 'kept out of every save');assert.deepEqual([S.race, S.cls, S.gender], ['undead', 'hunter', 'm']);
  assert.equal(c.chartered, true);assert.equal(c.crowned, false, 'the crown not yet taken');
  assert.equal(E.canClaim(c), true, 'everything Take the crown asks for');
  const v = E.crownView(c);
  assert.ok(v.trust >= v.coupAt && v.favour >= v.coupFavour && v.seasonsPlayed >= v.coupSeasons);
  assert.equal(c.clock, 0, 'the next close a whole five minutes off');
  /* the hall once the loading screen is gone - and nothing opened for the player: the table is theirs to click */
  timers.shift()();
  assert.deepEqual(zones, [], 'not while the loading screen is up');
  bootGone = true; timers.shift()();
  assert.deepEqual(zones, [30]);assert.deepEqual(ledger, [], 'no ledger opened by the test');
  assert.deepEqual([hero.x, hero.y, hero.moveTo], [900, 850, null], 'a few steps in front of the council table');
  /* the crown is really there to take: the claim goes through on this very state */
  const r = E.claimCrown(c, 'gaol');
  assert.equal(r.ok, true, r.text);assert.equal(c.crowned, true);
  vm.runInContext('S={id:"real"};gameOn=true;', box);
  assert.match(box.crownTest(), /^Change Character first/, 'never takes over a real hero in play');
});
