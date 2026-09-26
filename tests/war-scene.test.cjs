/* Run with: node --test tests/war-scene.test.cjs
 * ⚔ War in the game (asked for 2026-09-26): an enemy's soldiers in the City's streets, the sword and the war box on the Allies
 * page, and the raid on an enemy port - orders given by a click, buildings burned and razed, the men home with the ship.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const game = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const section = (a, b) => { const i = game.indexOf(a), j = game.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, 'cannot find ' + a); return game.slice(i, j); };
const mulberry32 = a => function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
/* the City's streets, as buildCity lays them (tests/free-company.test.cjs knows them the same way) */
const STREETS = [[300, 1180, 16500, 1180, 180], [300, 2600, 16500, 2600, 280], [300, 4020, 16500, 4020, 180], ...[2600, 5500, 8400, 11300, 14200].map(x => [x, 560, x, 4640, 200])];
const onStreet = (x, y) => Math.hypot(x - 8400, y - 2600) <= 520 || STREETS.some(([x0, y0, x1, y1, w]) => x >= Math.min(x0, x1) - w / 2 && x <= Math.max(x0, x1) + w / 2 && y >= Math.min(y0, y1) - w / 2 && y <= Math.max(y0, y1) + w / 2);
const HARBOR_MOUTH = { x: 8400, y: 4378 };

test('an army comes in by the west gate and over the north wall, or up the harbour stair - onto the streets - and burns the houses nearest its gates', () => {
  const solids = [];
  for (let x = 700; x < 16200; x += 260) for (const y of [960, 1400, 2380, 2820, 3800, 4240]) solids.push({ type: 'cityhouse', x, y, r: 34 });
  const box = vm.createContext({ Math, mulberry32, HARBOR_MOUTH, world: { streets: STREETS.map(([x0, y0, x1, y1, w]) => ({ x0, y0, x1, y1, w })), solids } });
  vm.runInContext(section('const FORSAKEN_AVOID=', 'function forsakenFoe(') + section('const RAID_ENTRIES=', 'function raidSoldier(') + ';this.RAID_ENTRIES=RAID_ENTRIES;', box);
  for (const by of ['land', 'sea']) {
    for (const e of box.RAID_ENTRIES[by]) {
      assert.ok(onStreet(e.x, e.y), by + ' entry on a street: ' + e.x + ',' + e.y);
      if (by === 'land') assert.ok(e.sx < 420 || e.sy < 600, 'a land army starts outside the walls: ' + e.sx + ',' + e.sy);
      else assert.ok(e.sy > HARBOR_MOUTH.y, 'a sea army comes up from the harbour: ' + e.sy);
    }
    for (const seed of [1, 99, 4321]) {
      const E = box.raidEntries(by, seed);
      assert.equal(E.length, 3); assert.deepEqual(E.map(e => e.x + ',' + e.y).sort(), box.RAID_ENTRIES[by].map(e => e.x + ',' + e.y).sort(), 'the same gates, dealt from the seed');
      const burned = box.scarredHouses({ seed, n: 7, by });
      assert.deepEqual(burned, box.forsakenHouses(seed, 7, E), 'what the books say burned is what the soldiers burned');
      const near = Math.min(...burned.map(h => Math.min(...E.map(e => Math.hypot(h.x - e.x, h.y - e.y)))));
      assert.ok(near < 500, 'by the gates');
    }
  }
  assert.deepEqual(box.scarredHouses({ seed: 5, n: 4 }), box.forsakenHouses(5, 4), 'a burn with no gates on it is the Forsaken\'s, by their portals');
});

test('the army in the streets is staged like the Forsaken - soldiers in their city\'s skin, not reapers - and nothing the hero can strike', () => {
  const block = section('/* 🟣 THE FORSAKEN IN THE STREETS', 'function cityLedgerClose(){');
  assert.ok(!/enemies\.push|spawnEnemyAt|hero\.target/.test(block), 'nothing the hero can target');
  assert.ok(block.includes("c.raid?{kind:'raid',ally:c.raid.ally,n:c.raid.n,seed:c.raid.seed}:null"), 'the books\' raid is staged');
  assert.ok(block.includes("function raidSoldier(B,x,y,i){return {name:'',skin:B.skin,"), 'in the skin of their city');
  assert.ok(block.includes('const b=CityEconomy.battleOf(c,F.n,F.per)'), 'fought at what one of them is worth');
  assert.ok(block.includes("if(F&&F.kind!=='raid'&&!execution){for(const P of F.portals)"), 'an army has no purple portals to light');
  assert.ok(game.includes('f:()=>raid?drawRaider(f):drawForsaken(f)'), 'drawn as men');
  assert.ok(game.includes("stageMsg('⚔ Soldiers of '+d.name+' are in your streets!"), 'and told on the stage');
});

test('in an enemy port the seat, the holy places and the walls are never burned; a barracks counts double, a market half again', () => {
  const box = vm.createContext({ Math, CityEconomy: { ALLIES: [] } });
  vm.runInContext(section('const RAID_SPARE=', 'const raidAlly=') + ';this.raidTargetable=raidTargetable;this.raidWeight=raidWeight;this.raidKey=raidKey;this.raidName=raidName;', box);
  const b = (kind, extra = {}) => ({ type: 'townprop', big: true, kind, x: 930.4, y: 2366.6, ...extra });
  for (const k of ['rh_house_a', 'rh_inn', 'h_warehouse', 'rh_barracks', 'ef_market', 'sf_house_b']) assert.equal(box.raidTargetable(b(k)), true, k);
  for (const k of ['rh_keep', 'sf_palace', 'ef_foundry', 'rh_chapel', 'rh_gatehouse', 'rh_tower', 'rh_wall', 'harbor_beacon']) assert.equal(box.raidTargetable(b(k)), false, k + ' is spared');
  assert.equal(box.raidTargetable(b('galleon', { floats: true })), false, 'nor the ships');
  assert.equal(box.raidTargetable(b('crates', { big: false })), false, 'nor a pile of crates');
  assert.deepEqual(['rh_barracks', 'rh_armory', 'ef_market', 'h_warehouse', 'rh_inn', 'rh_house_a'].map(k => box.raidWeight(b(k))), [2, 2, 1.5, 1.5, 1.5, 1]);
  assert.equal(box.raidKey(b('rh_house_a')), 'rh_house_a@930,2367', 'one key for one building, through a save');
  assert.deepEqual(['rh_house_c', 'h_warehouse', 'rh_barracks', 'ef_house_a'].map(k => box.raidName(b(k))), ['house', 'warehouse', 'barracks', 'house']);
});

test('the raid: the men land with you, take their orders by a click, burn and raze - and come home with the ship', () => {
  assert.ok(game.includes('  townRaidApply();   /* ⚔ what the crown\'s raids burned'), 'a port is built with its ashes, and the raid if the men have landed');
  assert.ok(game.includes(" if(z.town&&raidClick(wx,wy))return true;"), 'a click in a port is an order first');
  assert.ok(game.includes('if(world.raid)raidTick(dt);') && game.includes(' raidWatch();   /* ⚔ the men come home with the ship */'));
  const watch = section('function raidWatch(){', 'function raidHud(){');
  assert.ok(watch.includes('if(!e||e.auto||voyage)return;') && watch.includes('CityEconomy.endRaid(S.city)'), 'sailing away - or loading a save elsewhere - brings the men home');
  const tick = section('function raidTick(dt){', 'function raidEnd(){');
  assert.ok(tick.includes('CityEconomy.raze(S.city,R.ally,raidKey(T),raidWeight(T))'), 'the books raze what burned');
  assert.ok(tick.includes('R.t>=RAID_FIGHT') && tick.includes('R.t>=RAID_BURN'), 'a fight, then the fire');
  assert.ok(!/enemies\.push|hero\.target|dmgEnemy/.test(section('/* ==================== ⚔ THE RAID', '/* ⚔ The Free Company')), 'the hero commands - he does not fight');
  assert.ok(game.includes("if(s.raidFire||s.razed)drawTownRuin(s,f,al);"), 'burning and burned buildings are drawn, and fade with the building');
  const sail = section("else if(act==='sail'){", "else if(act==='peace'){");
  assert.ok(sail.includes('E.sail(c,k,force,{auto:!port})') && sail.includes('setSail(k)'), 'the men board, and where the Black Tide puts in, you with them');
});

test('the Allies page: a sword beside each ruler, an are-you-sure before war, goodwill in the ruler\'s own words, and the war box', () => {
  const allies = section('function allyGoodwill(W){', 'function ledgerTalk(c){');
  assert.ok(allies.includes('class="ally-sword" data-lact="war"'), 'the sword');
  assert.ok(allies.includes('“\'+r.text+\'”'), 'his words');
  assert.ok(allies.includes('data-lact="sail"') && allies.includes('data-lact="peace"'), 'sail, or make peace');
  const war = section("else if(act==='war'){", "else if(act==='sail'){");
  assert.ok(war.includes("confirmBox('⚔ <b>Sure you want to go to war with '"), 'are you sure?');
  assert.ok(war.includes('E.declareWar(c,k)'));
  assert.ok(section("else if(act==='peace'){", " else if(act==='settle')").includes('confirmBox('), 'and peace is confirmed too');
});

test('the guards abroad with an expedition are off their rounds at home, like the hurt', () => {
  const box = vm.createContext({ Math, Set, world: null });
  vm.runInContext(section('function forsakenHurtWatch(c){', 'function forsakenInfirmary(){'), box);
  const file = Array.from({ length: 15 }, (_, i) => ({ name: 'W' + i, watch: 'a', patrol: true, recruit: i >= 5, hidden: false, x: 0, y: 0, i: 0, pts: [{ x: 1, y: 2 }] }));
  box.world = { npcs: file };
  box.forsakenHurtWatch({ chartered: true, budget: { watch: 3 }, hurt: { watch: 2 }, expedition: { watch: 4 } });
  assert.equal(file.filter(n => n.hidden).length, 6, 'two hurt and four abroad');
  box.forsakenHurtWatch({ chartered: true, budget: { watch: 3 }, hurt: null, expedition: null });
  assert.equal(file.filter(n => n.hidden).length, 0, 'home again');
  assert.ok(game.includes("n=Math.max(0,CityEconomy.mercView(S.city).count-(h?h.mercs:0)-(x?x.mercs:0))"), 'and the sellswords abroad walk no beat');
});
