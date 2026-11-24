/* Run with: node --test tests/bug-review-2026-11-24-city.test.cjs
 * ⚔ The raid's part of the 2026-11-24 bug review, pinned:
 *  1. the raid HUD's buttons are made once - the lines above them are rewritten every 0.4 s and at every man down, and a button
 *     rewritten between the press and the release never got its click (Chromium drops it);
 *  2. a battle left midway (Change Character and back, the game closed and opened) is a retreat with the fallen booked - it used
 *     to land every man again on his feet against a fresh garrison, and a retreat then booked nobody hurt;
 *  3. a retreat sounded in the 1.4 s after the palace doors fall no longer drags the hero into the palace;
 *  5. an expedition that comes home by raidWatch is reckoned by the men who really fell - nobody, when it never fought.
 * The real raid block of game.js on the real TownWorld, RaidBattle and CityEconomy; only the page is a stand-in. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const section = (a, b) => { const i = game.indexOf(a), j = game.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, 'cannot find ' + a); return game.slice(i, j); };
const TW = require('../assets/city/town-world.js');
for (const f of fs.readdirSync(path.join(root, 'assets/city/towns')).filter(f => f.endsWith('.js'))) require('../assets/city/towns/' + f);
const RB = require('../assets/city/raid-battle.js');
const E = require('../assets/city/economy.js');

/* a stand-in element: it counts how often its HTML is written, and HTML with buttons in it gives it a first child and the buttons */
function fakeEl(dom) {
  const e = { style: {}, dataset: {}, className: '', textContent: '', writes: 0, html: '', listeners: {}, kids: [], firstChild: null, on: {},
    setAttribute() {}, addEventListener(t, f) { this.listeners[t] = f; }, remove() { if (this.id) delete dom[this.id]; },
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 1600, bottom: 900 }), querySelectorAll() { return this.kids; } };
  e.classList = { toggle: (k, v) => { e.on[k] = !!v; } };
  Object.defineProperty(e, 'innerHTML', { get() { return this.html; }, set(v) { this.html = String(v); this.writes++;
    if (/<button/.test(v)) { this.firstChild = fakeEl(dom); this.kids = [...String(v).matchAll(/data-raid="(\w+)">([^<]*)</g)].map(m => { const b = fakeEl(dom); b.dataset.raid = m[1]; b.textContent = m[2]; b.closest = () => b; return b; }); } } });
  let id = ''; Object.defineProperty(e, 'id', { get: () => id, set(v) { id = v; dom[v] = e; } });
  return e;
}
/* a crowned city at war with `id`: the watch at its top level, the Training Ground at 3, a hundred sellswords */
function warCity(id, str = 100) {
  const c = E.create(); c.chartered = true; c.crowned = true; c.deposed = 'gaol'; c.office = 3; c.treasury = 5e8; c.ticks = 40; c.kept = 40;
  c.season = { n: 1, card: { id: 'ordinary', mods: {} }, closes: 0, startLoan: 0, startTreasury: 5e8, target: 0, drawn: 0, peak: 0, red: 0, covered: 0, interest: 0, in: 0, out: 0, series: [] };
  c.budget.watch = E.LINES.watch.levels.length - 1; c.works.drillyard = { left: 0, lvl: 3 }; c.mercs = 100;
  assert.ok(E.declareWar(c, id).ok); c.allies[id].war.str = str;
  return c;
}
function rig() {
  const dom = {}, logs = [], msgs = [], timers = [];
  const box = vm.createContext({ Math, console, JSON, Number, String, Object, Array, Map, Set, Int8Array, Float32Array, Int32Array, Uint32Array,
    TownWorld: TW, RaidBattle: RB, CityEconomy: E, performance: { now: () => 0 }, setTimeout: fn => { timers.push(fn); },
    document: { createElement: () => fakeEl(dom), body: { appendChild() {} }, hasFocus: () => false },
    $: id => dom[id] || (id === 'cwOk' || id === 'cwRestore' ? (dom[id] = fakeEl(dom)) : null),
    stageMsg: t => { msgs.push(t); }, log: t => { logs.push(String(t).replace(/<[^>]+>/g, '')); },
    sfx: new Proxy({}, { get: () => () => {} }), sparkles() {}, burst() {}, mercStrike() {}, buildSkillbar() {}, save() {}, offerEmperorOutfit() {},
    fmtNum: v => String(v), fmtGold: v => String(v), esc: v => String(v), IS_TOUCH: false, inputMode: 'mouse', padHit: {}, padRep: {}, mp: { on: false }, mpLeave() {} });
  vm.runInContext(`
    var world=null,hero={x:0,y:0,dead:false},S=null,gameOn=true,voyage=null,zoom=1,camX=0,camY=0,VW=1600,VH=900,expeditionSpawn=null,sailed=[];
    var cv={getBoundingClientRect:()=>({left:0,top:0,right:1600,bottom:900})};
    var ZONES=[{name:'Moonshine'},{name:'City',city:true}].concat(TownWorld.list().map(t=>({name:t.name,town:t.id,interior:!!t.interior})));
    var zoneOf=()=>ZONES[S.zone],townZone=id=>ZONES.findIndex(z=>z.town===id);
    function setZoom(z){zoom=z;} function zmin(){return .2;} function townImages(){return {};} function drawNpc(){} function drawTownFoe(){}
    /* what the game's collide() does in a town */
    function collide(e,x,y){const r=e.r||12;if(!TownWorld.contains(world,x,y,r))return true;
     for(const s of world.solids){if(s.noCol)continue;if(s.crx){const kx=(x-s.x-(s.cxo||0))/(s.crx+r),ky=(y-s.y-(s.cyo||0))/(s.cry+r);if(kx*kx+ky*ky<1)return true;continue;}if(Math.hypot(x-s.x,y-s.y)<r+s.r*.8)return true;}
     for(const m of world.mwalls||[])if(x>m.x-r&&x<m.x+m.w+r&&y>m.y-r&&y<m.y+m.h+r)return true;
     return x<r+16||y<r+16||x>world.w-r-16||y>world.h-r-16;}
    function buildZone(){const z=zoneOf();if(z.town){world=TownWorld.create(z.town);townRaidApply();}else world={w:3000,h:2000,solids:[],npcs:[]};}
    function goToZone(z){S.zone=z;buildZone();}
    function setSail(id){sailed.push(id);}
  `, box);
  vm.runInContext(section('const RAID_SPARE=', 'const TEST_NAMES='), box);
  const run = code => vm.runInContext(code, box);
  /* the hero is written and read back, as saveSnapshot -> migrate do it, and his world is built again */
  const comeBack = (restart) => run((restart ? 'raidSiege=null;' : '') + 'S.city=CityEconomy.normalize(JSON.parse(JSON.stringify(S.city)));buildZone();raidWatch();');
  return { box, run, dom, logs, msgs, timers, comeBack };
}
function land(id, opts = {}) {
  const K = rig(), c = warCity(id, opts.str), D = E.defenders(c), r = E.sail(c, id, { watch: D.watch, cadets: D.cadets, mercs: D.mercs });
  assert.ok(r.ok, r.text);
  if (opts.old) { delete c.expedition.down; }
  K.box.__c = c; K.run(`S={zone:townZone('${id}'),city:__c};buildZone();`);
  return K;
}
const hurtOf = c => c.hurt ? c.hurt.watch + c.hurt.cadets + c.hurt.mercs : 0;

test('1. the raid HUD makes its buttons once: the lines are rewritten, the buttons only shown, hidden and renamed - so a press always lands', () => {
  const hud = section('function raidHud(){', 'function raidMsgBelow(el){');
  assert.equal((hud.match(/el\.innerHTML=/g) || []).length, 1, 'the board itself is written once, when it is made');
  assert.ok(hud.includes("if(!el){el=document.createElement('div')") && hud.indexOf('el.innerHTML=') < hud.indexOf("el.addEventListener('click'"), 'inside the making of it');
  assert.ok(hud.includes('el.firstChild.innerHTML=info'), 'the lines go into a child of their own');
  const K = land('ravenholt'), el = K.dom.raidHud;
  assert.ok(el && el.kids.length === 3, 'All, Select and the retreat');
  const [all, sel, go] = el.kids, first = el.firstChild.html;
  assert.equal(go.dataset.raid, 'retreat'); assert.equal(sel.style.display, 'none', 'Select is a finger\'s button');
  K.run('world.raid.battle.theirs[0].alive=false;raidHud();raidHud();raidEvent(world.raid,{type:"down",x:0,y:0});');
  assert.equal(el.writes, 1, 'never written again');
  assert.deepEqual(el.kids, [all, sel, go], 'the same three buttons');
  assert.notEqual(el.firstChild.html, first, 'while the lines above them follow the battle');
  assert.ok(!/<button/.test(el.firstChild.html), 'and hold no button');
  K.run('world.raid.spent=true;raidHud();');
  assert.equal(go.dataset.raid, 'home'); assert.equal(go.textContent, '⚓ Sail home', 'burned all they can: the same button sails home');
  K.run('world.raid.spent=false;raidHud();');
  assert.equal(go.dataset.raid, 'retreat'); assert.equal(go.textContent, '🏳 Sound the retreat');
  /* a button answers the press itself: a line that wraps anew moves the row, and the release may land beside the button */
  el.listeners.pointerdown({ target: go, button: 2 });
  assert.equal(K.run('world.raid.over'), false, 'not the right button');
  el.listeners.pointerdown({ target: go, button: 0 });
  assert.equal(K.run('world.raid.over'), true, 'the retreat is sounded on the press');
  assert.equal(K.run('S.city.expedition'), null);
  assert.equal(all.style.display, 'none', 'no orders for men going aboard'); assert.equal(go.dataset.raid, 'home');
  el.listeners.click({ target: go, detail: 1 });   /* the release of that same press, on what is now Sail home */
  assert.equal(K.run('world.raid.goHome'), false, 'one press is one order');
  el.listeners.click({ target: go, detail: 0 });   /* a key or the pad presses nothing first */
  assert.equal(K.run('world.raid.goHome'), true); assert.equal(go.style.display, 'none');
});

test('2. a battle left midway is a retreat with the fallen booked - no second landing with every man on his feet', () => {
  const K = land('ravenholt'), c = K.run('S.city'), e = c.expedition;
  assert.equal(e.landed, true, 'the landing is on the books'); assert.equal(e.down, 0);
  assert.equal(K.run('world.raid.troops.length'), 90);
  K.run('for(let i=0;i<20;i++)raidEvent(world.raid,{type:"down",x:0,y:0});');
  const fell = Math.round(20 * 133 / 90);
  assert.equal(e.down, fell, 'the fallen are written as they fall, in men');
  assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(c))).expedition, JSON.parse(JSON.stringify(e)), 'and a save keeps them');
  K.comeBack();   /* Change Character and the same hero again - or the game closed and opened */
  const c2 = K.run('S.city');
  assert.ok(!K.run('world.raid'), 'no fresh battle');
  assert.equal(c2.expedition, null, 'the men are home');
  assert.equal(hurtOf(c2), fell, 'with exactly the men who fell hurt - no free retry, and no more lost than fell');
  assert.equal(c2.allies.ravenholt.war.refit, E.RAID_REFIT);
  assert.ok(K.msgs.some(m => m.startsWith('🏳 The retreat is sounded: ')), 'and the player is told it was a retreat');
  assert.equal(K.dom.raidHud, undefined, 'no board for a raid that is over');
  K.comeBack();
  assert.equal(hurtOf(K.run('S.city')), fell, 'booked once');
});

test('2. an expedition saved before the count was kept lands as it always did, and carries the count from then on', () => {
  const K = land('ravenholt', { old: true }), e = K.run('S.city.expedition');
  assert.equal(K.run('world.raid.troops.length'), 90, 'the battle is built');
  assert.equal(e.landed, true); assert.equal(e.down, 0);
  const plain = E.normalize({ ...JSON.parse(JSON.stringify(K.run('S.city'))), expedition: { ally: 'ravenholt', watch: 5, cadets: 0, mercs: 0, cap: 3, used: 1, rate: .2, at: 10, auto: false } }).expedition;
  assert.ok(!('down' in plain) && !('landed' in plain), 'a save without the fields reloads without them');
  const junk = E.normalize({ ...JSON.parse(JSON.stringify(K.run('S.city'))), expedition: { ally: 'ravenholt', watch: 5, cadets: 0, mercs: 0, cap: 3, used: 1, rate: .2, at: 10, auto: false, down: 999, landed: 'yes' } }).expedition;
  assert.equal(junk.down, 5, 'never more fallen than sailed'); assert.ok(!('landed' in junk));
  assert.equal(E.normalize({ ...JSON.parse(JSON.stringify(K.run('S.city'))), expedition: { ally: 'ravenholt', watch: 5, down: -3 } }).expedition.down, 0);
});

test('2+3. the palace: a retreat as the doors fall is a retreat; a hall left midway is one too, the fallen of the town and the hall booked', () => {
  const K = land('silverfjord', { str: 55 });
  const breach = () => K.run('(()=>{const R=world.raid,b=R.battle.buildings.find(b=>b.seat);raidSeatFallen(R,b);})()');
  assert.equal(K.run('world.raid.canStorm&&!!world.raid.court'), true);
  K.run('for(let i=0;i<9;i++)raidEvent(world.raid,{type:"down",x:0,y:0});');
  breach();
  assert.equal(K.run('!!raidSiege'), true); assert.equal(K.timers.length, 1);
  K.run('raidRetreat()');
  assert.equal(K.run('raidSiege'), null, 'the retreat calls the hall off');
  K.timers.shift()();
  assert.equal(K.run('zoneOf().town'), 'silverfjord', 'and the hero stays with his men');
  assert.equal(hurtOf(K.run('S.city')), Math.round(9 * 133 / 90));
  assert.ok(section('function raidSeatFallen(R,b){', 'function raidHallApply(){').includes('world.raid===R&&!R.over'), 'the doors wait for a raid that is still on');

  const H = land('silverfjord', { str: 55 });
  H.run('for(let i=0;i<9;i++)raidEvent(world.raid,{type:"down",x:0,y:0});(()=>{const R=world.raid,b=R.battle.buildings.find(b=>b.seat);raidSeatFallen(R,b);})()');
  H.timers.shift()();
  assert.equal(H.run('zoneOf().town'), 'sf_palace'); assert.equal(H.run('world.raid.hall'), true, 'in they go');
  H.run('for(let i=0;i<6;i++)raidEvent(world.raid,{type:"down",x:0,y:0});');
  assert.equal(H.run('S.city.expedition.down'), Math.round(15 * 133 / 90), 'the hall\'s fallen on top of the town\'s');
  H.comeBack();   /* the same session: raidSiege still remembers the men who went in */
  assert.ok(!H.run('world.raid'), 'the hall is not fought again from the doors');
  assert.equal(H.run('raidSiege'), null); assert.equal(H.run('S.city.expedition'), null);
  assert.equal(hurtOf(H.run('S.city')), Math.round(15 * 133 / 90));

  const A = land('silverfjord', { str: 55 });
  A.run('for(let i=0;i<9;i++)raidEvent(world.raid,{type:"down",x:0,y:0});(()=>{const R=world.raid,b=R.battle.buildings.find(b=>b.seat);raidSeatFallen(R,b);})()');
  A.timers.shift()();
  A.run('for(let i=0;i<6;i++)raidEvent(world.raid,{type:"down",x:0,y:0});');
  A.comeBack(true);   /* the game closed and opened in the hall */
  assert.equal(A.run('S.city.expedition'), null);
  assert.equal(hurtOf(A.run('S.city')), Math.round(15 * 133 / 90), 'the men who fell, not a guess from the odds');
});

test('5. an expedition that comes home without its battle: nobody hurt when it never fought; one from before the count, by the odds as before', () => {
  const watch = section('function raidWatch(){', 'function raidHud(){');
  assert.ok(watch.includes('Number.isFinite(e.down)?CityEconomy.endRaid(S.city,{hurt:e.down}):CityEconomy.endRaid(S.city)'));
  for (const old of [false, true]) {
    const K = rig(), c = warCity('meridian'), D = E.defenders(c);
    assert.ok(E.sail(c, 'meridian', { watch: D.watch, cadets: D.cadets, mercs: D.mercs }).ok);
    assert.equal(c.expedition.down, 0, 'nobody has fallen when the ship casts off');
    if (old) delete c.expedition.down;
    const odds = E.normalize(JSON.parse(JSON.stringify(c))); E.endRaid(odds);
    K.box.__c = E.normalize(JSON.parse(JSON.stringify(c)));   /* the game closed on the crossing: the hero wakes where he sailed from */
    K.run('S={zone:1,city:__c};buildZone();raidWatch();');
    const c2 = K.run('S.city');
    assert.equal(c2.expedition, null, 'the men are home');
    if (old) { assert.ok(hurtOf(odds) > 0); assert.equal(hurtOf(c2), hurtOf(odds), 'an old expedition is reckoned as it was'); }
    else { assert.equal(c2.hurt, null, 'nobody is hurt in a battle that was never fought'); assert.ok(!K.msgs.some(m => /retreat/.test(m)), 'and nobody sounded a retreat'); }
  }
});
