/* Run with: node --test tests/city-war.test.cjs
 * ⚔ War with the allies (asked for 2026-09-26): each court's goodwill toward the crown, wars declared by an angry ruler or with the
 * sword on his card, his soldiers raiding the City like the Forsaken, the crown's guards sailing to raze his port - a few buildings
 * a raid, never the whole place at once - his surrender, and the peace that can be bought instead.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../assets/city/economy.js');

const quiet = () => .95, live = { live: true };
const def = id => E.ALLIES.find(a => a.id === id);
const crowned = () => { const s = E.create(); E.charter(s); s.food.stock = 1e6; s.crowned = true; s.deposed = 'gaol'; s.treasury = 5e8; s.pop = 1500; s.ticks = 30; return s; };
const strong = s => { s.budget.watch = 3; s.works.drillyard = { left: 0, lvl: 3 }; s.mercs = 60; return s; };
const target = (s, id) => E.goodwillOf(s, def(id)).target;

test('each court looks at the crown with its own eyes: tariffs grate on the traders, a stake softens, a soldier weighs your guards', () => {
  const s = crowned(); s.mood = 60;
  s.budget.duty = 1; s.budget.fee = 1;
  assert.deepEqual(E.ALLIES.map(a => target(s, a.id)), [34, 60, 60, 60, 60], 'customary rates: only the soldier frowns - at five watchmen before a strongroom of 500 million');
  s.budget.duty = 3; s.budget.fee = 3;
  const wall = Object.fromEntries(E.ALLIES.map(a => [a.id, target(s, a.id)]));
  assert.deepEqual(wall, { ravenholt: 16, emberfall: 12, silverfjord: 35, krakensrest: 18, meridian: 24 }, 'a wall of tariffs and extortionate fees');
  assert.equal(E.goodwillOf(s, def('emberfall')).reasons[0].text, 'Your tariffs are ruining my smiths - every ingot we send you pays twice.', 'in his own voice, the worst first');
  s.allies = { emberfall: { stake: 60, held: 0, owned: false, put: 3e6, pending: [] } };
  assert.equal(target(s, 'emberfall'), 24, 'a stake buys patience - twelve points at most');
  assert.ok(target(s, 'emberfall') < 30, 'and even a court the crown has put gold into goes sour under a wall of tariffs');
  s.budget.duty = 0; s.budget.fee = 0;
  assert.equal(target(s, 'emberfall'), 82, 'open gates and a free market please everybody');
  strong(s); s.budget.duty = 1; s.budget.fee = 1;
  assert.equal(target(s, 'ravenholt'), 68, 'a royal watch and a full Training Ground: a soldier respects a city that can hold a line');
  s.budget.watch = 0; s.works = {}; s.mercs = 0;
  assert.equal(target(s, 'ravenholt'), 23, 'and despises an open door - before a fat strongroom most of all');
  s.treasury = 1e6;
  assert.equal(target(s, 'ravenholt'), 35, 'a poor city is less of a temptation');
  assert.equal(E.goodwillName(75), 'Friendly'); assert.equal(E.goodwillName(E.WAR_AT - 1), 'Hostile');
});

test('goodwill drifts only toward a crowned head - a sixth of the way a close - and the envoys complain before anybody marches', () => {
  const s = E.create(); E.charter(s); s.food.stock = 1e6; s.budget.duty = 3; s.budget.fee = 3;
  for (let i = 0; i < 30; i++) E.tick(s, live, quiet);
  assert.ok(!s.allies || Object.values(s.allies).every(a => a.rel === undefined && !a.war), 'the old King keeps the peace himself');
  s.crowned = true;
  E.tick(s, live, quiet);
  assert.equal(s.allies.emberfall.rel, 56, 'at most four points a close');
  const said = [];
  for (let i = 0; i < 12 && !s.allies.emberfall.war; i++) { s.pop = 1500; said.push(...E.tick(s, live, quiet).unrest); }
  assert.ok(said.some(t => t.startsWith('🤝 Emberfall’s envoy has complained at the palace. “Your tariffs are ruining my smiths')), said.join(' | '));
  assert.ok(said.some(t => t.startsWith('⚔ Word from Emberfall: King Aldric Cindermane is counting his men.')));
  const v = E.warView(s, 'emberfall');
  assert.ok(v.rel < 30 && v.mood === 'Angry' || v.mood === 'Hostile', JSON.stringify(v.rel));
});

test('a ruler under the war line for three closes may march - only in a live city - and the war stops trade and seizes the chests on the road', () => {
  const quietCity = E.create(); E.charter(quietCity); quietCity.food.stock = 1e6; quietCity.crowned = true; quietCity.budget.duty = 3; quietCity.budget.fee = 3;
  for (let i = 0; i < 200; i++) E.tick(quietCity, {}, quiet);
  assert.ok(Object.values(quietCity.allies).every(a => !a.war), 'a scripted city is never attacked');
  const s = crowned(); s.budget.duty = 3; s.budget.fee = 3;
  let began = null, under = 0;
  for (let i = 0; i < 120 && !began; i++) {
    s.pop = 1500;
    const r = E.tick(s, live, quiet), a = s.allies.emberfall;
    if (a.war) began = r; else under = a.rel < E.WAR_AT ? under + 1 : 0;
  }
  assert.ok(began, 'sooner or later he marches');
  assert.ok(under >= E.WAR_CAUSE - 1, 'not before he has been angry a while');
  assert.ok(began.unrest.some(t => t.startsWith('⚔ King Aldric Cindermane has declared war on the crown! “Your tariffs are ruining my smiths')), began.unrest.join(' | '));
  assert.equal(s.allies.emberfall.war.by, 'them');
  /* the sword on a card: an envoy's chest on the road is lost */
  const t = crowned(); t.pop = 1500;
  assert.ok(E.allyInvest(t, 'ravenholt', 1e6).ok);
  const d = E.declareWar(t, 'ravenholt');
  assert.ok(d.ok, d.text); assert.equal(d.seized, 1e6); assert.deepEqual(t.allies.ravenholt.pending, []);
  t.allies.silverfjord = { stake: 30, held: 0, owned: false, put: 0, pending: [] };
  const f = E.forecast(t, {});
  assert.equal(E.alliesFx(t).income, E.alliesFx({ ...t, allies: { silverfjord: t.allies.silverfjord } }).income, 'nothing comes from a place at war');
  assert.ok(Math.abs(E.alliesFx(t).trade + E.WAR_TRADE) < 1e-9, 'and its caravans stop');
  assert.ok(f.moodFactors.some(x => x.name === '⚔ At war with Ravenholt' && x.value === -2) && f.attractFactors.some(x => x.name === '⚔ A city at war'));
});

test('the sword: only a crowned head draws it, never on a place of the crown\'s, twice, or in a truce - and a warmonger is watched abroad', () => {
  const s = crowned(); E.tick(s, live, quiet);
  const before = Object.fromEntries(E.ALLIES.map(a => [a.id, s.allies[a.id].rel])), mood = s.mood;
  s.crowned = false; assert.equal(E.declareWar(s, 'emberfall').text, 'Only a crowned head declares war.'); s.crowned = true;
  s.allies.meridian.owned = true;
  assert.match(E.declareWar(s, 'meridian').text, /under the crown already/);
  assert.ok(E.declareWar(s, 'emberfall').ok);
  assert.match(E.declareWar(s, 'emberfall').text, /at war with Emberfall already/);
  assert.equal(s.mood, mood - 3, 'a war of the crown\'s own choosing frightens its people');
  for (const id of ['ravenholt', 'silverfjord', 'krakensrest']) assert.equal(s.allies[id].rel, Math.round((before[id] - 8) * 10) / 10, 'and every court abroad trusts it less');
  assert.equal(s.allies.meridian.rel, before.meridian, 'the crown\'s own are not asked');
  s.allies.ravenholt.truce = 5;
  assert.equal(E.declareWar(s, 'ravenholt').text, 'A truce holds with Ravenholt for 5 more closes.');
});

test('at war, his soldiers come into the City now and then - a close each, one attack at a time - and are fought like the Forsaken', () => {
  const s = strong(crowned());
  E.declareWar(s, 'ravenholt');
  const began = [];
  for (let i = 1; i <= 40; i++) { s.pop = 1500; const r = E.tick(s, live, quiet); if (r.raiders) began.push(i); if (r.raid) assert.equal(r.raid.ally, 'ravenholt'); }
  assert.ok(began.length >= 3, 'raids came: ' + began.join(','));
  assert.ok(began[0] > E.RAID_FIRST, 'not before the army has marched');
  for (let i = 1; i < began.length; i++) assert.ok(began[i] - began[i - 1] >= E.RAID_COOL + 1, 'and some closes apart: ' + began.join(','));
  const w = s.allies.ravenholt.war;
  assert.ok(w.beaten >= 3 && w.str < 100 && w.str >= E.RAID_FLOOR, 'a guarded city cuts them down, and they are the fewer for it - but no war is won in your own streets alone: ' + w.str);
  /* a weak city: houses burn, families flee, gold is carried off, guards are hurt */
  const weak = crowned(); weak.budget.watch = 1; weak.ticks = 60;
  E.declareWar(weak, 'emberfall');
  weak.allies.emberfall.war.cool = 0;
  weak.raid = { ally: 'emberfall', n: 12, seed: 99 };
  const gold = weak.treasury, pop = weak.pop, r = E.tick(weak, live, quiet);
  assert.ok(r.raid.harm > .5 && r.raid.houses > 0 && r.raid.fled > 0, JSON.stringify(r.raid));
  assert.ok(r.raid.plunder > 0 && weak.treasury <= gold - r.raid.plunder + 1e7, 'the strongroom was robbed: ' + r.raid.plunder);
  assert.equal(r.raid.plunder, Math.round(r.raid.harm * Math.min(gold * E.PLUNDER, def('emberfall').yield * 3)), 'a share of what it holds, by how badly the guards lost');
  assert.deepEqual(weak.scars.burns.at(-1), { seed: 99, n: r.raid.houses, by: 'land' }, 'the houses they burned - by the gates - stand charred until rebuilt');
  assert.ok(weak.pop < pop && weak.hurt && weak.hurt.watch > 0);
  assert.ok(r.unrest.some(t => t.startsWith('🔥 Emberfall’s soldiers have gone:')), r.unrest.join(' | '));
  /* the Forsaken and a raid never hold the streets together */
  const both = strong(crowned()); E.declareWar(both, 'ravenholt'); both.allies.ravenholt.war.cool = 0; both.forsaken = { n: 12, seed: 7 };
  for (let i = 0; i < 20; i++) { E.tick(both, live, quiet); assert.ok(!(both.forsaken && both.raid), 'never the Forsaken and a raid in the streets together'); if (both.forsaken) both.allies.ravenholt.war.cool = 0; }
});

test('an expedition: the odds against their garrison decide how much it can raze - never a whole city in one raid - and the men who fight come home hurt', () => {
  const s = strong(crowned());
  const garrison = 30 * 3.5;
  assert.equal(E.raidOf(s, 'ravenholt', { watch: 15 }).cap, 0, 'no war, full strength: 15 men drilled x2.4 are 36 against 105');
  assert.equal(E.raidOf(s, 'ravenholt', { mercs: 60 }).garrison, garrison);
  const odds = (p, g) => Math.floor(E.RAID_CAP * (p / g - .5) / 1.5 + 1e-9);
  assert.equal(E.raidOf(s, 'ravenholt', { mercs: 60 }).cap, odds(60 * 1.2 * 2.4, garrison), 'the sellswords alone');
  assert.equal(E.raidOf(s, 'ravenholt', { watch: 15, cadets: 18, mercs: 60 }).cap, E.RAID_CAP, 'two to one or better: the most one raid can do');
  assert.match(E.sail(s, 'ravenholt', { mercs: 20 }).text, /not at war/);
  E.declareWar(s, 'ravenholt');
  assert.match(E.sail(s, 'ravenholt', { mercs: 61 }).text, /not that many men/);
  assert.match(E.sail(s, 'ravenholt', {}).text, /Choose the men/);
  const home = E.defenders(s), order = E.watchOrder(s);
  const r = E.sail(s, 'ravenholt', { watch: 15, cadets: 18, mercs: 60 });
  assert.ok(r.ok && r.cap === E.RAID_CAP, r.text);
  assert.match(E.sail(s, 'ravenholt', { mercs: 1 }).text, /abroad already/);
  const D = E.defenders(s);
  assert.deepEqual([D.watch, D.cadets, D.mercs, D.away], [0, 0, 0, 93], 'the men abroad defend nothing at home');
  assert.ok(E.watchOrder(s) < order && home.power > 0 && D.power === 0);
  /* razing: a house is one, a barracks two; the cap is spent, and a building burns once */
  let str = 100;
  const b1 = E.raze(s, 'ravenholt', 'rh_house_a@930,2366', 1); str -= 100 / 28;
  assert.ok(b1.ok); assert.equal(s.allies.ravenholt.war.str, Math.round(str * 10) / 10);
  assert.equal(E.raze(s, 'ravenholt', 'rh_house_a@930,2366', 1).text, 'That is ashes already.');
  E.raze(s, 'ravenholt', 'rh_barracks@3330,1570', 2);
  for (let k = 0; k < E.RAID_CAP - 3; k++) E.raze(s, 'ravenholt', 'h' + k, 1);
  assert.equal(s.expedition.used, E.RAID_CAP);
  const spent = E.raze(s, 'ravenholt', 'one more', 1);
  assert.equal(spent.ok, false); assert.equal(spent.spent, true);
  assert.equal(s.allies.ravenholt.ashes.length, E.RAID_CAP - 1, 'what they burned lies in ashes in the port');
  assert.ok(s.allies.ravenholt.war.str > 0 && s.allies.ravenholt.war, 'one raid does not burn a city to the ground (the siege takes it sooner, by its seat)');
  const back = E.endRaid(s);
  assert.equal(back.hurt, Math.round(93 * r.rate * (.35 + .65)), 'the harder they fought, the more are hurt');
  assert.deepEqual(Object.values(s.hurt).reduce((t, v) => t + v, 0) - s.hurt.left, back.hurt);
  assert.equal(s.hurt.left, 2); assert.equal(s.expedition, null); assert.equal(s.allies.ravenholt.war.refit, E.RAID_REFIT);
  assert.match(E.sail(s, 'ravenholt', { mercs: 10 }).text, /refitting/);
  assert.ok(back.text.startsWith('⚔ The expedition is home from Ravenholt: ' + E.RAID_CAP + ' buildings’ worth razed, '), back.text);
  assert.match(back.text, /, \d+ hurt\. Ravenholt stands at \d+% of its strength\.$/);
});

test('two raids or more burn a city to the ground and three a great port; the place surrenders for nothing, sacked, and every other court takes note', () => {
  const s = strong(crowned()); s.mercs = 100;
  E.tick(s, live, quiet);
  E.declareWar(s, 'ravenholt');
  let raids = 0, taken = null;
  while (!taken && raids < 8) {
    while (E.sailBar(s, 'ravenholt')) E.tick(s, live, quiet);
    const D = E.defenders(s), r = E.sail(s, 'ravenholt', { watch: D.watch, cadets: D.cadets, mercs: D.mercs });
    assert.ok(r.ok, r.text); raids++;
    for (let k = 0; k < 20 && s.expedition.used < s.expedition.cap; k++) { const z = E.raze(s, 'ravenholt', 'r' + raids + '-' + k, 1); if (z.conquered) { taken = z; break; } }
    E.endRaid(s);
  }
  assert.ok(taken, 'taken'); assert.ok(raids >= 2, 'in ' + raids + ' raids');
  assert.match(taken.text, /^🏳 King Roderic Varn has surrendered Ravenholt to the crown! It is ours without a coin paid/);
  const a = s.allies.ravenholt;
  assert.equal(a.owned, true); assert.equal(a.war, undefined); assert.equal(a.sacked, true); assert.equal(a.paid, undefined);
  assert.ok(taken.text.endsWith('its streets are sacked: it pays nothing until the crown restores it, for ' + (9600000).toLocaleString() + ' ◉ from the treasury.'), taken.text);
  assert.equal(E.alliesFx(s).income, 0, 'sacked (2026-10-03): it pays nothing');
  assert.ok(E.goodwillOf(s, def('emberfall')).reasons.some(r => r.text === 'You took Ravenholt by the sword. Every court is counting its walls.' && r.v === -12));
  for (let i = 0; i < 30; i++) E.tick(s, {}, quiet);
  assert.equal(a.sacked, true, 'nothing mends itself while it lies sacked'); assert.equal(E.alliesFx(s).income, 0);
  assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(s))).allies.ravenholt.sacked, true, 'through a save');
  const v = E.restoreAllyView(s, 'ravenholt');
  assert.equal(v.cost, 9600000, 'two fifths of what it would have cost to buy');
  const t0 = s.treasury, r = E.restoreAlly(s, 'ravenholt');
  assert.ok(r.ok, r.text); assert.equal(t0 - s.treasury, v.cost);
  assert.equal(a.sacked, undefined); assert.equal(a.ruin, undefined); assert.ok(E.alliesFx(s).income >= def('ravenholt').yield, 'restored, it pays in full');
  assert.equal(E.restoreAllyView(s, 'ravenholt'), null);
  /* a great port wants three raids at the least to burn to the ground, and a far bigger force */
  const p = strong(crowned()); p.mercs = 100; E.declareWar(p, 'meridian');
  const all = E.raidOf(p, 'meridian', E.defenders(p));
  assert.ok(all.cap >= 9, 'the whole war machine: ' + JSON.stringify(all));
  assert.ok(Math.ceil(100 / (all.cap * 100 / 50)) >= 3);
  assert.equal(E.raidOf(p, 'meridian', { watch: 15, cadets: 18 }).cap, 0, 'the watch and the cadets alone could not touch Meridian');
});

test('a port with no berth for the Black Tide: the books reckon the raid at the next close', () => {
  const s = strong(crowned()); s.mercs = 100; E.declareWar(s, 'krakensrest');
  const D = E.defenders(s), r = E.sail(s, 'krakensrest', { watch: D.watch, cadets: D.cadets, mercs: D.mercs }, { auto: true });
  assert.ok(r.ok && s.expedition.auto);
  const c = E.tick(s, live, quiet);
  assert.equal(s.expedition, null);
  assert.equal(s.allies.krakensrest.war.burned, Math.floor(r.cap * .75));
  assert.ok(c.unrest.some(t => t.startsWith('⚔ The expedition is home from Kraken’s Rest:')), c.unrest.join(' | '));
});

test('peace can be bought - dearer the stronger they still stand - a truce follows, and a ruler whose men keep dying asks for it himself', () => {
  const s = crowned(); E.declareWar(s, 'meridian');
  const v = E.peaceView(s, 'meridian');
  assert.equal(v.cost, 340e6 * E.PEACE_SHARE, 'fifteen percent of the list price at full strength');
  s.allies.meridian.war.str = 40;
  assert.equal(E.peaceView(s, 'meridian').cost, Math.round(340e6 * E.PEACE_SHARE * .4 / 1e4) * 1e4);
  s.raid = { ally: 'meridian', n: 20, seed: 3 };
  const p = E.makePeace(s, 'meridian');
  assert.ok(p.ok, p.text); assert.equal(s.allies.meridian.war, undefined); assert.equal(s.allies.meridian.truce, E.WAR_TRUCE);
  assert.ok(s.allies.meridian.rel >= 35); assert.equal(s.raid, null, 'their men in the streets go home');
  assert.ok(E.goodwillOf(s, def('meridian')).reasons.some(r => r.text === 'The last war between us is not forgotten.'));
  for (let i = 0; i < E.WAR_TRUCE; i++) E.tick(s, {}, quiet);
  assert.equal(s.allies.meridian.truce, undefined, 'the truce runs out');
  /* he asks */
  const t = strong(crowned()); E.declareWar(t, 'ravenholt');
  Object.assign(t.allies.ravenholt.war, { beaten: 3, str: 40 });
  const c = E.tick(t, live, quiet);
  assert.ok(c.unrest.some(x => x.startsWith('🕊 King Roderic Varn sues for peace')), c.unrest.join(' | '));
  assert.equal(E.peaceView(t, 'ravenholt').cost, 0);
  const gold = t.treasury; assert.ok(E.makePeace(t, 'ravenholt').ok); assert.equal(t.treasury, gold);
});

test('the siege (2026-10-03): burned down to STORM_AT, its seat stormed, the whole place is the crown’s at once - and not a moment before', () => {
  const s = strong(crowned()); s.mercs = 100; E.tick(s, live, quiet);
  E.declareWar(s, 'silverfjord');
  const D = E.defenders(s);
  assert.ok(E.sail(s, 'silverfjord', { watch: D.watch, cadets: D.cadets, mercs: D.mercs }).ok);
  const early = E.storm(s, 'silverfjord');
  assert.equal(early.ok, false); assert.match(early.text, /stands at 100% of its strength - burn it down to 60% before its seat can be stormed/);
  for (let k = 0; s.allies.silverfjord.war.str > E.STORM_AT && k < 20; k++) E.raze(s, 'silverfjord', 'h' + k, 1);
  assert.ok(s.allies.silverfjord.war.str <= E.STORM_AT);
  const r = E.storm(s, 'silverfjord');
  assert.ok(r.ok && r.conquered, r.text);
  const a = s.allies.silverfjord;
  assert.equal(a.owned, true); assert.equal(a.sacked, true); assert.equal(a.war, undefined);
  assert.equal(E.storm(s, 'silverfjord').ok, false, 'once is enough');
  const end = E.endRaid(s, { hurt: 4 });
  assert.ok(end.ok); assert.equal(end.hurt, 4, 'the men who went down in the battle are the hurt');
  assert.equal(E.restoreAllyView(s, 'silverfjord').cost, 26000000);
});

test('the books keep every war, truce, ruin and expedition through a save - and a city that never looked abroad reloads exactly as it was', () => {
  const reload = s => E.normalize(JSON.parse(JSON.stringify(s)));
  const plain = crowned(); plain.crowned = false; plain.deposed = null;
  for (let i = 0; i < 5; i++) E.tick(plain, live, quiet);
  assert.deepEqual(reload(plain), JSON.parse(JSON.stringify(plain)));
  const s = strong(crowned()); E.tick(s, live, quiet);
  E.declareWar(s, 'ravenholt'); E.declareWar(s, 'krakensrest');
  s.raid = { ally: 'krakensrest', n: 18, seed: 12345 };
  E.sail(s, 'ravenholt', { mercs: 40 }); E.raze(s, 'ravenholt', 'rh_house_b@640,1520', 1);
  s.allies.silverfjord.truce = 4; s.allies.silverfjord.peaceAt = 20;
  s.allies.emberfall = { stake: 100, held: 0, owned: true, put: 0, pending: [], rel: 30, conquered: 25, ruin: 44, ashes: ['ef_house_a@1,2'] };
  s.allies.ravenholt.war.offer = true;
  const back = reload(s);
  assert.deepEqual(back, JSON.parse(JSON.stringify(s)), 'round and round');
  assert.deepEqual(reload(back), back);
  const junk = reload({ ...JSON.parse(JSON.stringify(s)), raid: { ally: 'silverfjord', n: 9 }, expedition: { ally: 'meridian', mercs: 5 } });
  assert.equal(junk.raid, null, 'no raid from a place at peace'); assert.equal(junk.expedition, null, 'nor an expedition to one');
  const odd = JSON.parse(JSON.stringify(s)); odd.allies.meridian = { stake: 100, owned: true, pending: [], war: { str: 50 }, rel: 400 };
  const o = reload(odd).allies.meridian;
  assert.equal(o.war, undefined, 'the crown is not at war with its own'); assert.equal(o.rel, 100);
  assert.equal(reload({ ...JSON.parse(JSON.stringify(s)), chartered: false }).expedition, null);
});
