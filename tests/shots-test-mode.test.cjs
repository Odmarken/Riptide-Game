/* Run with: node --test tests/shots-test-mode.test.cjs
 * 📸 The screenshot test (2026-10-13: "ge mig en test build nu med 4 gubbar alla 30 prestige + olika klasser warrior, priest, mage
 * och hunter 3 males, ingen dwarf men female ska va undead ... på female att hon har en farm level 3 skit snygg och stor fint
 * byggd ... ge dom lite vapen och outfits också ... och random mycket pengar"). The real code, cut out of game.js: four heroes
 * as asked, none carrying what the store page keeps secret, and the Priestess's farm built inside its land with closed paddocks.
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
const FarmLayout = require('../assets/farm/layout.js');
const FARM_BUILD = vm.runInNewContext(section('const FARM_BUILD=', '/* ⇄/⤢ per-piece look.').replace('const FARM_BUILD=', '(') .replace(/;\s*$/, ')'));

function shots() {
  const shown = [];
  const c = vm.createContext({ Math, Date, JSON, Mounts, CityEconomy, FarmLayout, shown,
    MAXLVL: 60, WASTELAND_ZONE: 27, CITY_ZONE: 26, TAVERN_ZONE: 20, FARM_ZONE: 24, LEGEND_MAX_UP: 6, FARM_MAXLVL: 3, SCRAP_CAP: 800,
    goldCap: ch => ((ch && ch.prestige) || 0) >= 20 ? 2000000 : 1000000,
    freshState: (name, race, cls) => ({ name, race, cls, lvl: 1, prestige: 0, zone: 0, maxZone: 0, gold: 0, gear: { weapon: null, armor: null, trinket: null },
      bag: [], mounts: Mounts.normalize(null), city: CityEconomy.create(), farm: { owned: false, b: [], c: [], r: [] } }),
    migrate: s => s });
  vm.runInContext('let S=null,gameOn=false;let slot=0;'
    + 'const rollItem=()=>({slot:["weapon","armor","trinket"][slot++%3],rar:"epic",name:"Epic thing"});'
    + 'const enchSetOn=(it,v)=>{it.insc={id:v.id,rar:v.rar};it.wench="rune-"+v.id;};'
    + 'const syncFrostseeker=it=>it,syncFelGlaives=it=>it;function showSelect(){shown.push(S);}'
    + section('const TEST_NAMES=', 'function raidTest(') + section('const TEST_NAMES_F=', 'function outfitTest(')
    + section('let TEST_ROSTER=null;', 'const fmtNum=') + section('function outfitUnlocked(', 'function heroOutfit(')
    + ';const isIce=it=>!!it&&it.legend==="icearmor";'
    + 'this.shotsTest=shotsTest;this.shotsFarm=shotsFarm;this.outfitUnlocked=outfitUnlocked;this.roster=()=>TEST_ROSTER;this.set=(s,g)=>{S=s;gameOn=g;};', c);
  return c;
}

test('the screenshot test: started by the shell, four heroes as asked', () => {
  const boot = game.slice(game.indexOf('(async()=>{\n /* 🧪'), game.indexOf('if(FB.user)await enterAfterAuth();'));
  assert.ok(boot.includes("if(test==='shots'){") && /shotsTest\(\);return;\}/.test(boot), 'the shell starts it');
  const c = shots();
  assert.match(c.shotsTest(), /4 heroes/);
  const heroes = [...c.roster().values()].map(j => JSON.parse(j));
  assert.deepEqual(heroes.map(h => h.cls).sort(), ['hunter', 'mage', 'priest', 'warrior']);
  assert.equal(heroes.filter(h => h.gender === 'm').length, 3, 'three men');
  const her = heroes.find(h => h.gender === 'f');
  assert.equal(her.race, 'undead', 'the woman is Undead');
  assert.ok(!heroes.some(h => h.race === 'dwarf'), 'no dwarf');
  for (const h of heroes) {
    assert.equal(h.prestige, 30); assert.equal(h.lvl, 60); assert.ok(h.test, 'never saved');
    assert.ok(h.gold >= 1.2e6 && h.gold <= 2e6, 'a full purse, under its cap');
    assert.ok(h.overflow >= 40e6 && h.bankGold >= 150e6, 'and a fortune beside it');
    assert.equal(h.gear.weapon.rar, 'legendary'); assert.ok(h.gear.weapon.insc, 'a rune on the blade');
    assert.ok(h.bag.filter(it => it.slot === 'weapon').length >= 3, 'more weapons in the bag');
    assert.ok(c.outfitUnlocked('royal', h) && c.outfitUnlocked('default', h), 'the crown’s robes beside the class colours');
  }
  assert.equal(new Set(heroes.map(h => h.overflow)).size, 4, 'each fortune its own');
});

test('nothing the store page keeps secret is on them', () => {
  const c = shots(); c.shotsTest();
  for (const h of [...c.roster().values()].map(j => JSON.parse(j))) {
    assert.ok(!c.outfitUnlocked('ice', h), 'no Ice Armor');
    assert.ok(!c.outfitUnlocked('emperor', h), 'no Emperor’s regalia');
    const all = [...Object.values(h.gear), ...h.bag].filter(Boolean);
    assert.ok(!all.some(it => it.legend === 'thering' || it.legend === 'icearmor'), 'no Ring, no Ice Armor');
    assert.deepEqual(h.mounts.owned.slice().sort(), ['horse', 'leopard'], 'no spectral tiger, no dragon');
  }
});

test('the Priestess’s farm: its last level, built inside its land, paddocks closed and the beasts inside them', () => {
  const c = shots(); c.shotsTest();
  const farm = JSON.parse([...c.roster().values()].find(j => JSON.parse(j).gender === 'f')).farm;
  assert.ok(farm.owned); assert.equal(farm.lvl, 3); assert.equal(farm.layoutVersion, FarmLayout.LAYOUT_VERSION);
  const known = new Set(FARM_BUILD.map(d => d.id));
  for (const it of farm.b) { assert.ok(known.has(it.t), it.t); assert.ok(FarmLayout.contains(it.x, it.y), it.t + ' at ' + it.x + ',' + it.y); }
  for (const r of farm.r) assert.ok(FarmLayout.contains(r.x0, r.y0) && FarmLayout.contains(r.x1, r.y1));
  const cells = new Set();
  for (const k of farm.c) {
    assert.ok(known.has(k.t) && k.x % 72 === 0 && (k.y - 1300) % 48 === 0, 'crops on the field grid: ' + k.x + ',' + k.y);
    assert.ok(!cells.has(k.x + ',' + k.y), 'one crop to a cell'); cells.add(k.x + ',' + k.y);
  }
  assert.ok(farm.b.some(it => it.t === 'mansion') && farm.b.some(it => it.t === 'lada') && farm.b.some(it => it.t === 'medium'));
  /* every paddock is a closed ring: as many rails top and bottom, as many posts left and right */
  for (const [hz, vt, beasts] of [['staket', 'staketv', ['cowfarm_big', 'cowfarm', 'tjur']], ['staket_black', 'staketv_black', ['chickenfarm_big', 'chickenfarm']]]) {
    const rails = farm.b.filter(it => it.t === hz), posts = farm.b.filter(it => it.t === vt);
    const ys = [...new Set(rails.map(r => r.y))].sort((a, b) => a - b), xs = [...new Set(posts.map(p => p.x))].sort((a, b) => a - b);
    assert.equal(ys.length, 2, hz + ': a top and a bottom rail');
    assert.equal(rails.filter(r => r.y === ys[0]).length, rails.filter(r => r.y === ys[1]).length);
    assert.equal(xs.length, 2, vt + ': a left and a right side');
    assert.equal(posts.filter(p => p.x === xs[0]).length, posts.filter(p => p.x === xs[1]).length);
    const VH = 13 * 1045 / 145;
    assert.ok(Math.abs((ys[1] - ys[0]) - VH * posts.filter(p => p.x === xs[0]).length) < 0.5, 'the sides reach the bottom rail');
    for (const a of farm.b.filter(it => beasts.includes(it.t)))
      assert.ok(a.x > xs[0] && a.x < xs[1] && a.y > ys[0] && a.y < ys[1], a.t + ' inside its paddock');
  }
});

test('a screenshot hero goes in whenever it likes: no gate times, no lockouts, no guardian timers (2026-10-13)', () => {
  const free = section('function shotsFree(){', '\n');
  assert.match(free, /S\.test&&S\.shotsAt!==undefined/, 'only the screenshot test’s heroes - never a played hero, nor the hero test’s');
  assert.match(section('function thorStatus(){', 'const thorLocked='), /if\(shotsFree\(\)\)return \{open:true,left:THOR_OPEN\};/, 'Thor is always out');
  assert.match(game, /const thorLocked=\(\)=>S&&!shotsFree\(\)&&S\.thorLock===thorWindow\(\);/, 'no Valhalla seal');
  assert.match(section('function raidStatus(){', 'const raidWindow='), /if\(shotsFree\(\)\)return \{open:true,left:RAID_OPEN\};/, 'the Violet Halls always open');
  assert.match(game, /const raidCleared=\(\)=>!!S&&!shotsFree\(\)&&S\.raidLock===raidWindow\(\);/, 'no raid lockout');
  assert.match(game, /if\(shotsFree\(\)\)S\.wastelandBossReadyAt\[z\.dungeon\]=\{\};/, 'both guardians stand at every visit');
  assert.match(game, /if\(shotsFree\(\)&&world\.encounter\)\{[^}]*Date\.now\(\)\+6000/, 'and again a few seconds after a clear');
});
