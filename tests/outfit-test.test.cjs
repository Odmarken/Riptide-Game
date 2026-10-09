/* Run with: node --test tests/outfit-test.test.cjs
 * 🧪 The outfit test (asked for 2026-10-09): `--riptide-test=outfits` starts a throwaway human woman of a random class who has
 * every outfit - the class colours, the Ice Armor, the Queen's robes and the Empress's regalia. It runs in the raid test's
 * profile of its own, never signs in, and the hero is kept out of every save (tests/raid-test.test.cjs pins those parts).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const game = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const section = (a, b) => { const i = game.indexOf(a), j = game.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, 'cannot find ' + a); return game.slice(i, j); };

test('the shell starts the outfit test before the cloud is even loaded, like the raid test', () => {
  const boot = game.slice(game.indexOf('(async()=>{\n /* 🧪'), game.indexOf('if(FB.user)await enterAfterAuth();'));
  assert.ok(boot.includes("if(test==='outfits'){") && /outfitTest\(\);return;\}/.test(boot), 'outfits starts the test and never reaches the sign-in');
  assert.ok(boot.indexOf("test==='outfits'") < boot.indexOf('await initFirebase()'));
});

test('outfitTest makes a human Empress who has every outfit and opens the Outfits page once the loading screen is gone', () => {
  const E = require('../assets/city/economy.js');
  const timers = [], tabs = [], logs = [];
  let bootGone = false;
  const box = vm.createContext({
    Math, Date, CityEconomy: E, timers, tabs, logs,
    CLASSES: [{ id: 'warrior', name: 'Warrior' }, { id: 'priest', name: 'Priest' }], CITY_ZONE: 26,
    freshState: (name, race, cls) => ({ name, race, cls, bag: [], gear: { armor: null }, city: E.create() }), migrate: s => s,
    makeIceArmor: () => ({ legend: 'icearmor' }), isIce: it => !!(it && it.legend === 'icearmor'),
    esc: s => s, log: t => logs.push(t), openTab: t => tabs.push(t),
    $: () => ({ classList: { remove() {}, contains: c => c === 'gone' && bootGone } }),
    setTimeout: f => timers.push(f),
  });
  vm.runInContext('let S=null,gameOn=false;function beginGame(){gameOn=true;}'
    + section('const OUTFITS=[', 'function heroOutfit(') + section('const TEST_NAMES_F=', 'const fmtNum=')
    + ';this.outfitTest=outfitTest;this.S=()=>S;this.unlocked=id=>outfitUnlocked(id);', box);
  assert.match(box.outfitTest(), /^outfit test: \w+ the Human (Warrior|Priest), Empress, every outfit$/);
  const S = box.S();
  assert.equal(S.test, true); assert.equal(S.gender, 'f'); assert.equal(S.race, 'human'); assert.equal(S.zone, 26);
  assert.equal(S.outfit, 'emperor', 'she wakes in the regalia');
  assert.ok(E.isEmperor(S.city), 'crowned, with all three cities and both great ports under the crown');
  for (const id of ['default', 'ice', 'royal', 'emperor']) assert.equal(box.unlocked(id), true, id + ' is hers');
  assert.equal(S.bag.filter(it => it.legend === 'icearmor').length, 1, 'the plate the ritual hands over');
  assert.equal(S.emperorRegaliaOffered, true, 'no offer box over the Outfits page - she already wears them');
  timers.shift()();
  assert.deepEqual(tabs, [], 'not while the loading screen is up');
  bootGone = true; timers.shift()();
  assert.deepEqual(tabs, ['outfits']);
  vm.runInContext('S={id:"real"};gameOn=true;', box);
  assert.match(box.outfitTest(), /^Change Character first/, 'never takes over a real hero in play');
});
