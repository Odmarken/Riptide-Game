/* Run with: node --test tests/city-forsaken.test.cjs
 * 🟣 The Forsaken and the Guards' Training Ground (asked for 2026-09-26): a work that rises twice and drills the city's guards,
 * random attacks fought out over one close by the guards alone, the houses they burn and the families they drive off, and the
 * rebuilding that brings them home.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../assets/city/economy.js');

const open = () => { const s = E.create(); E.charter(s); s.food.stock = 1e6; return s; };
const quiet = () => .95;               /* a roll of .95 never triggers anything */
const devoted = s => { for (const k of Object.keys(s.council)) s.council[k] = E.UP_FAVOUR; s.season.n = 2; };
const raise = s => { assert.ok(E.upgrade(s, {}, 'drillyard').ok); for (let i = 0; i < 2; i++) E.tick(s, {}, quiet); devoted(s); };

test('the Guards’ Training Ground is bought like any work and raised twice - drilling the guards harder, with more cadets, each time', () => {
  const s = open(); s.treasury = 1e8;
  const card = () => E.worksView(s, {}).list.find(w => w.id === 'drillyard');
  assert.equal(card().cat, 'order');
  assert.equal(E.capOf('drillyard'), 3, 'it rises twice'); assert.equal(E.capOf('carters'), 2, 'every other work once');
  assert.ok(card().effects.some(t => /40% stronger against the Forsaken/.test(t)) && card().effects.some(t => /6 cadets/.test(t)), card().effects.join(' | '));
  assert.equal(E.defenders(s).drill, 0);
  assert.ok(E.invest(s, {}, 'drillyard').ok);
  E.tick(s, {}, quiet); E.tick(s, {}, quiet);
  assert.equal(card().status, 'done'); assert.equal(E.drillOf(s), 1);
  assert.equal(card().up.level, 2); assert.equal(card().up.cap, 3);
  devoted(s);
  raise(s);
  assert.equal(E.lvlOf(s, 'drillyard'), 2); assert.equal(card().up.level, 3); assert.equal(card().up.status, 'ready', 'and once more');
  assert.equal(card().up.upkeep, Math.round(60 * 100) * 3, 'the third level keeps three times over');
  raise(s);
  assert.equal(E.lvlOf(s, 'drillyard'), 3); assert.equal(card().up.status, 'done');
  const r = E.upgrade(s, {}, 'drillyard');
  assert.equal(r.ok, false); assert.match(r.text, /level 3 already/);
  assert.equal(E.worksFx(s).drill, 3); assert.ok(Math.abs(E.worksFx(s).order - .06) < 1e-9, 'a little order at every level');
  assert.ok(card().effects.some(t => /140% stronger/.test(t)) && card().effects.some(t => /18 cadets/.test(t)), card().effects.join(' | '));
  const d = E.defenders(s);
  assert.deepEqual([d.drill, d.cadets], [3, 18]);
  /* through a save: the third level stands for the Training Ground alone, and a crew on its way to it is kept */
  const back = E.normalize(JSON.parse(JSON.stringify({ ...s, works: { drillyard: { left: 0, lvl: 3 }, carters: { left: 0, lvl: 3 }, quay: { left: 0, lvl: 2, up: 1 }, fleet: { left: 0, lvl: 2 } } })));
  assert.deepEqual(back.works.drillyard, { left: 0, lvl: 3 }); assert.deepEqual(back.works.carters, { left: 0 }, 'no third level for a work that rises once');
  const mid = E.normalize(JSON.parse(JSON.stringify({ ...s, works: { drillyard: { left: 0, lvl: 2, up: 1 } } })));
  assert.deepEqual(mid.works.drillyard, { left: 0, lvl: 2, up: 1 }, 'a crew half way to level 3');
});

test('who turns out: the watch on its budget line, the cadets, the sellswords - all drilled by the Training Ground', () => {
  const s = open();
  const power = () => E.defenders(s).power;
  s.budget.watch = 0; assert.equal(power(), 0, 'a disbanded watch and nobody else');
  s.budget.watch = 1; assert.equal(power(), 5);
  s.budget.watch = 3; assert.equal(power(), 15);
  s.mercs = 20; assert.equal(power(), 15 + 20 * E.MERC_POWER);
  s.works.drillyard = { left: 0 }; assert.equal(power(), Math.round((15 + 6 + 20 * E.MERC_POWER) * E.DRILL_POWER[1] * 10) / 10);
  s.works.drillyard = { left: 0, lvl: 3 }; assert.equal(power(), Math.round((15 + 18 + 20 * E.MERC_POWER) * E.DRILL_POWER[3] * 10) / 10);
});

test('the fight: no guards and they burn freely, enough guards and not a roof is lost, and everything between', () => {
  const s = open(); s.pop = 1500;
  const n = E.forsakenCount(s);
  assert.equal(n, 16, 'more of them the bigger the city');
  s.budget.watch = 0; const none = E.battleOf(s, n);
  assert.equal(none.harm, 1); assert.ok(none.houses >= 10 && none.fled > 50, JSON.stringify(none));
  s.budget.watch = 1; const five = E.battleOf(s, n);
  s.budget.watch = 3; s.works.drillyard = { left: 0 }; const drilled = E.battleOf(s, n);
  s.works.drillyard = { left: 0, lvl: 3 }; const trained = E.battleOf(s, n);
  assert.ok(none.harm > five.harm && five.harm > drilled.harm && drilled.harm > trained.harm, [none.harm, five.harm, drilled.harm, trained.harm].join(' > '));
  assert.equal(trained.harm, 0, 'a royal watch with a Training Ground at its top holds a city of 1500 clean');
  assert.equal(trained.houses + trained.fled, 0);
});

test('the watch and the cadets go first; the Free Company is sent in only as far as they fall short - and the fires are what they were with every man in', () => {
  const s = open();
  let checked = 0;
  for (const pop of [500, 1500, 4000]) for (const watch of [0, 1, 2, 3]) for (const lvl of [0, 1, 2, 3]) for (const mercs of [0, 20, 60, 100]) {
    s.pop = pop; s.budget.watch = watch; s.mercs = mercs;
    if (lvl) s.works.drillyard = lvl > 1 ? { left: 0, lvl } : { left: 0 }; else delete s.works.drillyard;
    const n = E.forsakenCount(s), b = E.battleOf(s, n), D = b.defence, dp = E.DRILL_POWER[D.drill], need = n * E.FORSAKEN_POWER * 1.5;
    const all = Math.pow(Math.max(0, 1 - D.power / (n * E.FORSAKEN_POWER) / 1.5), 1.3);   /* the harm when every man turned out */
    const at = JSON.stringify({ pop, watch, lvl, mercs });
    assert.equal(b.harm, Math.round(all * 1000) / 1000, 'enough is enough: ' + at);
    assert.ok(b.called >= 0 && b.called <= D.mercs, at);
    const first = (D.watch + D.cadets) * dp;
    if (first >= need) assert.equal(b.called, 0, 'the watch holds alone and the sellswords stay on their beats: ' + at);
    else if (b.called < D.mercs) assert.ok(first + b.called * E.MERC_POWER * dp >= need - 1e-6 && first + (b.called - 1) * E.MERC_POWER * dp < need, 'as many as it takes and not one more: ' + at);
    checked++;
  }
  assert.equal(checked, 192);
  s.pop = 1500; s.budget.watch = 3; s.works.drillyard = { left: 0, lvl: 3 }; s.mercs = 60;
  assert.equal(E.battleOf(s, 16).called, 0, 'a royal watch with a full Training Ground needs nobody');
  assert.equal(E.battleOf(s, 28).called, 17, 'the biggest attack wants 17 sellswords behind it');
  s.budget.watch = 1; delete s.works.drillyard; s.mercs = 100;
  assert.equal(E.battleOf(s, 16).called, 56);
  s.mercs = 20;
  const short = E.battleOf(s, 16);
  assert.equal(short.called, 20, 'all of them, when all of them are not enough'); assert.ok(short.harm > 0);
});

test('those who fight come home hurt - a handful after a rout, half of them after a lost fight - and are off duty for two closes', () => {
  const s = open(); s.pop = 1500;
  s.budget.watch = 0;
  assert.deepEqual(E.battleOf(s, 16).injured, { watch: 0, cadets: 0, mercs: 0, total: 0 }, 'nobody fought, nobody is hurt');
  s.budget.watch = 1; const lost = E.battleOf(s, 16);
  s.budget.watch = 3; s.works.drillyard = { left: 0, lvl: 3 }; const held = E.battleOf(s, 16);
  s.mercs = 60; const big = E.battleOf(s, 28);
  for (const b of [lost, held, big]) {
    const I = b.injured, D = b.defence;
    assert.equal(I.watch + I.cadets + I.mercs, I.total);
    assert.ok(I.watch <= D.watch && I.cadets <= D.cadets && I.mercs <= b.called, 'only those who fought: ' + JSON.stringify(b));
  }
  assert.equal(lost.injured.total, 3, 'three of five watchmen who could not hold them');
  assert.equal(held.injured.total, 4, 'four of 33 who routed them');
  assert.ok(lost.injured.total / 5 > held.injured.total / 33, 'a lost fight hurts a bigger share');
  assert.equal(held.injured.mercs, 0, 'the sellswords were never sent in');
  assert.ok(big.injured.mercs > 0, 'the ones sent in share the wounds');
  /* fought out: the hurt are off duty, the watch keeps less order, and two closes later they are back */
  s.mercs = 0; s.forsaken = { n: 16, seed: 5 }; s.ticks = 40;
  const order0 = E.watchOrder(s);
  const c = E.tick(s, { live: true }, quiet);
  assert.deepEqual(s.hurt, { watch: held.injured.watch, cadets: held.injured.cadets, mercs: 0, left: E.HURT_CLOSES });
  assert.equal(E.HURT_CLOSES, 2, 'two closes to heal, as asked');
  assert.equal(c.forsaken.injured, 4);
  assert.ok(c.unrest.some(t => /^🩹 4 hurt in the fighting \(2 of the watch, 2 cadets\)/.test(t)), c.unrest.join(' | '));
  const d = E.defenders(s);
  assert.deepEqual([d.watch, d.cadets, d.hurt], [13, 16, 4]);
  assert.ok(Math.abs(E.watchOrder(s) - 1.21) < 1e-9, '13 men on their rounds keep the order of 13, between a doubled and a royal watch');
  const tolls = () => E.forecast(s, {}).income.find(x => x.id === 'tolls').amount, hurt = s.hurt, less = tolls();
  s.hurt = null; const whole = tolls(); s.hurt = hurt;
  assert.ok(less < whole, 'and the market feels it: ' + less + ' < ' + whole);
  assert.match(E.forecast(s, {}).expenses.find(x => x.id === 'watch').note, /15 men - Royal · 2 injured/);
  E.tick(s, { live: true }, quiet);
  assert.equal(s.hurt && s.hurt.left, 1);
  const back = E.tick(s, { live: true }, quiet);
  assert.equal(s.hurt, null, 'healed after ' + E.HURT_CLOSES + ' closes');
  assert.ok(back.unrest.some(t => /^✔ The guards hurt fighting the Forsaken are back on duty/.test(t)), back.unrest.join(' | '));
  assert.equal(E.watchOrder(s), order0);
  s.mercs = 20; s.hurt = { watch: 0, cadets: 0, mercs: 5, left: 2 };
  assert.equal(E.defenders(s).mercs, 15, 'a hurt sellsword is not on the roll either');
});

test('an attack begins at a close in a live city only, is fought out at the next, and leaves ruins that heal slowly - or at once, for the price of rebuilding', () => {
  const s = open(); s.treasury = 5e7; s.pop = 450; s.budget.watch = 1;   /* under the 500 roofs a new city has */
  for (let i = 0; i < 200; i++) E.tick(s, {}, quiet);
  assert.equal(s.forsaken, null, 'a scripted, quiet city is never attacked');
  assert.equal(s.history.filter(h => h.attack).length, 0);
  const live = { live: true };
  let began = null;
  for (let i = 0; i < 400 && !began; i++) { s.pop = 450; s.attract = 50; const c = E.tick(s, live, quiet); if (s.forsaken) began = c; }   /* a steady city of 450 while we wait */
  assert.ok(began, 'sooner or later they come');
  assert.ok(began.unrest.some(t => /^🟣 Purple portals/.test(t)), began.unrest.join(' | '));
  assert.equal(began.attack, s.forsaken.n);
  assert.ok(E.forecast(s, {}).moodFactors.some(f => /Forsaken in the streets/.test(f.name)), 'the people feel it');
  const pop = s.pop, mood = s.mood, v = E.forsakenView(s, {});
  assert.ok(v.active && v.harm > 0, 'five watchmen will not hold them');
  const fought = E.tick(s, live, quiet);
  assert.equal(s.forsaken, null, 'one close and it is over');
  assert.ok(fought.forsaken && fought.forsaken.houses > 0, JSON.stringify(fought.forsaken));
  assert.ok(fought.unrest.some(t => /^🔥 The Forsaken are gone/.test(t)));
  assert.ok(s.pop <= pop - fought.forsaken.fled + 40, 'families fled (the close\'s own arrivals aside)');
  assert.ok(s.mood < mood + 5);
  const burned = fought.forsaken.houses;
  assert.deepEqual(s.scars.burns.map(b => b.n), [burned]);
  const f = E.forecast(s, {});
  assert.ok(f.moodFactors.some(x => /not yet rebuilt/.test(x.name)) && f.attractFactors.some(x => /Burned-out/.test(x.name)));
  s.scars = null; const whole = E.forecast(s, {}).housing; s.scars = { burns: [{ seed: 1, n: burned }], fled: fought.forsaken.fled };
  assert.equal(f.housing, whole - burned * E.SCAR_ROOFS, 'a burned house holds nobody');
  /* the rest after an attack */
  assert.ok(E.forsakenView(s, {}).calm > 0);
  const quietAfter = s.ticks;
  const fledAtFirst = s.scars.fled;
  for (let i = 0; i < E.FORSAKEN_COOL - 1; i++) { E.tick(s, live, quiet); assert.equal(s.forsaken, null, 'the city rests a few closes'); }
  assert.ok(s.ticks - quietAfter < E.FORSAKEN_COOL);
  /* nobody paid, and the townsfolk put a roof back up themselves every SCAR_HEAL closes - slowly */
  const left = s.scars.burns.reduce((t, b) => t + b.n, 0), healed = Array.from({ length: E.FORSAKEN_COOL - 1 }, (_, i) => quietAfter + 1 + i).filter(n => n % E.SCAR_HEAL === 0).length;
  assert.equal(left, burned - healed, 'one house every ' + E.SCAR_HEAL + ' closes');
  assert.ok(healed === 0 || s.scars.fled < fledAtFirst, 'and some of the families with it');
  /* rebuild what is left */
  const cost = left * E.SCAR_REPAIR * 100, before = s.treasury, popBefore = s.pop, fled = s.scars.fled;
  const r = E.rebuild(s, {});
  assert.ok(r.ok, r.text); assert.equal(r.cost, cost); assert.equal(s.treasury, before - cost); assert.equal(s.scars, null);
  assert.equal(s.pop, popBefore + r.back); assert.ok(r.back > 0 && r.back <= fled, 'the families come home');
  assert.equal(E.rebuild(s, {}).ok, false, 'nothing left to rebuild');
});

test('a clean defence cheers the city; no attack under the bank, before the tenth close, or in a city whose books are shut', () => {
  const s = open(); s.pop = 900; s.budget.watch = 3; s.works.drillyard = { left: 0, lvl: 3 }; s.mercs = 20;
  s.forsaken = { n: E.forsakenCount(s), seed: 7 }; s.ticks = 40;
  const mood = s.mood, trust = s.trust, c = E.tick(s, { live: true }, quiet);
  assert.equal(c.forsaken.harm, 0); assert.equal(s.scars, null);
  assert.ok(c.unrest.some(t => /^🛡 The Forsaken were cut down/.test(t)), c.unrest.join(' | '));
  assert.ok(s.trust >= trust, 'the guards held');
  const bank = open(); bank.bankRule = { left: 40 }; bank.ticks = 50;
  for (let i = 0; i < 200; i++) { E.tick(bank, { live: true }, quiet); assert.equal(bank.forsaken, null, 'not while the bank keeps the books'); if (!bank.bankRule) break; }
  const shut = E.create();
  for (let i = 0; i < 100; i++) { E.tick(shut, { live: true }, quiet); assert.equal(shut.forsaken, null); }
  const young = open();
  for (let i = 0; i < E.FORSAKEN_FROM - 1; i++) { E.tick(young, { live: true }, quiet); assert.equal(young.forsaken, null, 'a new steward is given ten closes'); }
});

test('the books keep an attack and its ruins through a save, and drop nonsense', () => {
  const s = open(); s.ticks = 30; s.forsakenAt = 22;
  s.forsaken = { n: 12, seed: 123456 }; s.scars = { burns: [{ seed: 99, n: 4 }, { seed: 7, n: 2 }], fled: 57 };
  const back = E.normalize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.forsaken, s.forsaken); assert.deepEqual(back.scars, s.scars); assert.equal(back.forsakenAt, 22);
  assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(back))), back, 'round and round');
  const junk = E.normalize({ ...JSON.parse(JSON.stringify(s)), forsaken: 'x', scars: { burns: [{ n: -3 }, null, { seed: 'a', n: 2.7 }], fled: -9 }, forsakenAt: 999 });
  assert.equal(junk.forsaken, null); assert.deepEqual(junk.scars, { burns: [{ seed: 0, n: 2 }], fled: 0 }); assert.equal(junk.forsakenAt, 30);
  const shut = E.normalize({ ...JSON.parse(JSON.stringify(s)), chartered: false });
  assert.equal(shut.forsaken, null, 'no attack in a city nobody runs');
  assert.deepEqual(E.normalize(undefined), E.create());
  /* 🩹 the hurt, too */
  s.hurt = { watch: 3, cadets: 2, mercs: 4, left: 2 };
  const kept = E.normalize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(kept.hurt, s.hurt); assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(kept))), kept);
  assert.deepEqual(E.normalize({ ...JSON.parse(JSON.stringify(s)), hurt: { watch: 99, cadets: -1, mercs: 'x', left: 9 } }).hurt, { watch: 15, cadets: 0, mercs: 0, left: 2 });
  assert.equal(E.normalize({ ...JSON.parse(JSON.stringify(s)), hurt: { watch: 0, cadets: 0, mercs: 0, left: 2 } }).hurt, null, 'nobody hurt is no record');
  assert.equal(E.normalize({ ...JSON.parse(JSON.stringify(s)), hurt: 'x' }).hurt, null);
  assert.equal(E.normalize({ ...JSON.parse(JSON.stringify(s)), chartered: false }).hurt, null);
  assert.equal(E.create().hurt, null);
});

/* ---------- the street: game.js ---------- */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const game = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const section = (a, b) => { const i = game.indexOf(a), j = game.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, 'cannot find ' + a); return game.slice(i, j); };

test('the portals open on the main streets, apart from each other and clear of the gates; the houses nearest them burn', () => {
  const streets = [{ x0: 300, y0: 2600, x1: 16500, y1: 2600, w: 280 }, { x0: 8400, y0: 560, x1: 8400, y1: 4640, w: 200 }, { x0: 300, y0: 1180, x1: 16500, y1: 1180, w: 180 },
    { x0: 300, y0: 4020, x1: 16500, y1: 4020, w: 180 }, { x0: 2600, y0: 560, x1: 2600, y1: 4640, w: 200 }, { x0: 11300, y0: 560, x1: 11300, y1: 4640, w: 200 }, { x0: 1450, y0: 560, x1: 1450, y1: 4640, w: 88 }];
  const solids = [];
  for (let x = 700; x < 16200; x += 260) for (const y of [960, 1400, 2380, 2820, 3800, 4240]) solids.push({ type: 'cityhouse', x, y, r: 34 });
  solids[5].work = { id: 'school' };
  const box = vm.createContext({ Math, world: { streets, solids } });
  assert.ok(game.includes('function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;'), 'the seeded roll below is game.js\'s own');
  box.mulberry32 = a => { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  vm.runInContext(section('const FORSAKEN_AVOID=', 'function forsakenFoe('), box);
  for (const seed of [1, 42, 4242, 777, 31337, 99991, 123456789]) {
    const P = vm.runInContext(`forsakenPortals(${seed})`, box);
    assert.equal(P.length, 3 + seed % 2, 'three or four portals, by the seed - a few crowds rather than many thin ones');
    for (const p of P) {
      assert.ok(streets.some(s => s.w >= 180 && (Math.abs(s.y0 - s.y1) < 1 ? Math.abs(p.y - s.y0) <= s.w / 2 && p.x >= s.x0 && p.x <= s.x1 : Math.abs(p.x - s.x0) <= s.w / 2 && p.y >= s.y0 && p.y <= s.y1)), 'on a main street: ' + p.x + ',' + p.y);
      for (const [ax, ay, r] of [[520, 2600, 560], [16578, 2600, 640], [8400, 5062, 560], [8400, 2600, 170]]) assert.ok(Math.hypot(p.x - ax, p.y - ay) >= r, 'clear of the gates and the well');
      for (const q of P) if (q !== p) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= 1100, 'apart');
    }
    assert.deepEqual(vm.runInContext(`forsakenPortals(${seed})`, box), P, 'the same corners every time the seed is read - through a save, into the City again');
    const H = vm.runInContext(`forsakenHouses(${seed},9)`, box);
    assert.equal(H.length, 9); assert.ok(!H.some(h => h.work), 'a public work never burns');
    assert.equal(new Set(H).size, 9, 'nine different houses');
    const p0 = P[0], nearest = solids.filter(s => !s.work).sort((a, b) => Math.hypot(a.x - p0.x, a.y - p0.y) - Math.hypot(b.x - p0.x, b.y - p0.y))[0];
    assert.equal(H[0], nearest, 'the first to burn is the house nearest the first portal');
  }
});

test('the attack is staged, never fought by the hero: guards take it over, the townsfolk run, and every real foe draws as before', () => {
  const block = section('/* 🟣 THE FORSAKEN IN THE STREETS', 'function cityLedgerClose(){');
  assert.ok(!/enemies\.push|spawnEnemyAt|hero\.target/.test(block), 'nothing the hero can target or strike');
  assert.ok(game.includes('cityCouncilMarks();hallApply();cityApplyForsaken();cityApplyMercs();}'), 'staged after every close and order, before the sellswords are laid out');
  assert.ok(game.includes('if(n.scripted||n.held)continue;'), 'a guard or townsman the attack has taken over is not walked by his round');
  assert.ok(game.includes('if(m.held||m.post)continue;'), 'nor a sellsword by his beat');
  assert.ok(game.includes(' if(world&&world.forsaken)forsakenTick(dt);'));
  assert.ok(block.includes('if(!F||execution||coronation||TideUI.isBattling())return;'), 'nothing plays while the gallows or a coronation holds the square');
  assert.ok(game.includes("if(world.forsaken&&!TideUI.isBattling()&&!execution){"), 'nor is drawn');
  assert.ok(game.includes('*(en.alpha===undefined?1:en.alpha)') && game.includes('const bfx=en.face||((hero&&hero.x<en.x)?-1:1);') && game.includes('const arms=raidSkin.dual&&!en.oneBlade'),
    'three optional fields on drawEnemy - a foe without them draws exactly as it did');
  assert.ok(game.includes("else if(act==='rebuild'){const r=E.rebuild(c,cityContext());"), 'the Ledger rebuilds');
  assert.ok(game.includes("+ledgerIncidents(f,c)+ledgerForsaken(c)"), 'and shows them under Unrest');
  assert.ok(game.includes("if(n.guildRole!=='member'&&!n.protest&&!n.brawl&&!n.prisoner&&!n.held&&"), 'no names over the fight');
});

test('in the street the watch goes first, the called sellswords follow, and the hurt go down, are helped away and stay off their rounds', () => {
  const block = section('/* 🟣 THE FORSAKEN IN THE STREETS', 'function cityLedgerClose(){');
  assert.ok(block.includes('const M=world.mercs||[],late=forsakenProgress()>=F.callAt?(F.calledIdx||[]).map(i=>M[i]).filter(Boolean):[];'), 'the sellswords only once the watch has had its go');
  assert.ok(/const FORSAKEN_CALL_AT=\.0\d+;/.test(game), 'a few seconds in');
  assert.ok(block.includes('world.mercs=null;'), 'standing down lays the sellswords out on their beats and posts again');
  const apply = section('function cityApplyForsaken(){', 'const FORSAKEN_CALL_AT=');
  assert.equal(apply.split('cityApplyMercs();').length - 1, 2, 'the sellswords are on their beats before the ones called are picked - a fresh City has none laid out yet');
  assert.ok(apply.indexOf('cityApplyMercs();') < apply.indexOf('forsakenRoles(world.forsaken,c);'));
  assert.ok(game.includes("const h=S.city.hurt,x=S.city.expedition,n=Math.max(0,CityEconomy.mercView(S.city).count-(h?h.mercs:0)-(x?x.mercs:0));"), 'less the hurt, and the men abroad');
  assert.ok(block.includes(" forsakenHurtWatch(c);   /* the books' hurt"), 'the hurt watchmen are set aside at every close and order');
  assert.ok(game.includes('if(n.fade!=null)ctx.globalAlpha*=n.fade;') && game.includes('if(n.down){const gy=body?boots.groundY:8;') && game.includes('if(n.hurtMark){'), 'drawNpc can lay a man out, fade him and mark him hurt');
  assert.ok(game.includes("||m.hurtS==='gone')continue;") && game.includes("if(d.hurtS!=='gone'&&seen(d.x,d.y))"), 'the ones helped away are not drawn');
  /* the watchmen the books say are hurt: the ones laid out in the fight first, then from the end of the file - and back on their rounds healed */
  const box = vm.createContext({ Math, Set, world: null });
  vm.runInContext(section('function forsakenHurtWatch(c){', 'function forsakenInfirmary(){'), box);
  const file = [];
  for (let i = 0; i < 15; i++) file.push({ name: 'W' + i, watch: i < 3 ? 'a' : 'b', patrol: true, recruit: i >= 5, hidden: false, x: 100 + i, y: 50, i: 1, pts: [{ x: 0, y: 0 }, { x: 900 + i, y: 700 }] });
  box.world = { npcs: [{ name: 'Baker' }, ...file] };
  const c = { chartered: true, budget: { watch: 3 }, hurt: { watch: 3, cadets: 0, mercs: 0, left: 2 } };
  file[4].hurtS = 'gone'; file[4].hidden = true;   /* laid out in this attack */
  box.forsakenHurtWatch(c);
  assert.deepEqual(file.filter(n => n.injured).map(n => n.name), ['W4', 'W13', 'W14'], 'the man who went down, then the last of the file');
  assert.ok(file.every(n => n.hidden === !!n.injured), 'and only they are off their rounds');
  box.forsakenHurtWatch(c);
  assert.deepEqual(file.filter(n => n.injured).map(n => n.name), ['W4', 'W13', 'W14'], 'the same men at the next order');
  file[4].hurtS = null; box.forsakenHurtWatch(c);   /* the stand-down forgets the fight - the books still have him */
  assert.ok(file[4].injured && file[4].hidden, 'still in his bed after the attack');
  c.hurt = null; box.forsakenHurtWatch(c);
  assert.ok(file.every(n => !n.injured && !n.hidden), 'healed, every one is back');
  assert.deepEqual([file[13].x, file[13].y], [913, 700], 'on his round where he left it, not at the hospital');
  c.budget.watch = 0; box.forsakenHurtWatch(c);
  assert.ok(file.filter(n => !n.recruit).every(n => n.hidden), 'a disbanded watch is gone as before');
  /* who is hurt is picked by name - the same men through every ledger order, and the ones already down count */
  vm.runInContext(section('function forsakenDealHurt(F,list,k){', '/* 🩹 the watchmen the books say'), box);
  const men = Array.from({ length: 10 }, (_, i) => ({ name: 'M' + i })), F = { seed: 4242 };
  box.forsakenDealHurt(F, men, 3);
  const picked = men.filter(g => g.hurtAt != null).map(g => g.name);
  assert.equal(picked.length, 3); assert.ok(men.filter(g => g.hurtAt != null).every(g => g.hurtAt > .1 && g.hurtAt < .9));
  box.forsakenDealHurt(F, men, 3);
  assert.deepEqual(men.filter(g => g.hurtAt != null).map(g => g.name), picked, 'the same picks');
  men.find(g => g.name === picked[0]).hurtS = 'down';
  box.forsakenDealHurt(F, men, 3);
  assert.equal(men.filter(g => g.hurtAt != null && !g.hurtS).length, 2, 'one is already down: two more to come');
});

test('an attack only ever begins while you play, somewhere in the world: the books close on play time alone, never for time away', () => {
  const eco = fs.readFileSync(path.join(__dirname, '..', 'assets', 'city', 'economy.js'), 'utf8');
  assert.ok(!/Date\.now|performance\.now|new Date/.test(eco), 'the economy keeps no wall clock of its own');
  assert.equal((game.match(/CityEconomy\.advance\(/g) || []).length, 1, 'one clock moves the books');
  assert.equal((game.match(/CityEconomy\.tick\(/g) || []).length, 1, 'one close');
  assert.equal((game.match(/cityLedgerClose\(\);/g) || []).length, 1, 'called from one place');
  assert.ok(game.includes('const closes=CityEconomy.advance(S.city,dt);\n  for(let i=0;i<closes;i++)cityLedgerClose();'), 'the frame\'s own time, in update()');
  assert.ok(section('function frame(t){', 'update(dt);renderVitals(dt);').includes('if(gameOn&&!gamePaused&&!guideOpen){'), 'and update() runs only with a hero in the world and the game not paused');
  const s = open(); s.ticks = 60;
  assert.equal(E.advance(s, 299.9), 0); assert.equal(E.advance(s, .2), 1, 'five minutes of play make a close');
  for (let i = 0; i < 300; i++) { E.tick(s, {}, quiet); assert.equal(s.forsaken, null, 'and nothing but a live close lets them in'); }
});
