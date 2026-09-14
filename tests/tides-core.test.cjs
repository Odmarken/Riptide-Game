const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const T = require('../assets/tides/core.js');
const clone = value => JSON.parse(JSON.stringify(value));

function collection(speciesId = 'meadowmouse', level = 1) {
  const c = T.createCollection();
  T.purchaseLasso(c, 10000, {now: 1000, rng: () => 0});
  c.pets[0].speciesId = speciesId; c.pets[0].level = level;
  return c;
}
function begin(c, speciesId = 'meadowmouse', level = 1, seed = 0.27, now = 2000) {
  const result = T.beginBattle(c, {speciesId, level}, {rng: () => seed, now});
  assert.equal(result.ok, true);
  return result.battle;
}
function play(battle, smart = true) {
  let turns = 0;
  while (!battle.outcome) {
    const p = battle.player, skill = T.getSpecies(p.speciesId).skill;
    const wait = smart && skill.heal && p.maxHp - p.hp < p.maxHp * skill.heal * 0.8;
    const result = T.act(battle, p.powerCooldown || wait ? 'attack' : 'power');
    assert.equal(result.ok, true);
    assert.ok(++turns <= 60, 'all fights terminate');
    for (const unit of [battle.player, battle.foe]) {
      assert.ok(Number.isFinite(unit.hp) && unit.hp >= 0 && unit.hp <= unit.maxHp);
      assert.ok(unit.shield >= 0 && unit.powerCooldown >= 0);
    }
  }
  return battle.outcome;
}

test('25 individual species have unique powers, complete art metadata and deliberately rare spectral encounters', () => {
  assert.equal(T.catalog.length, 25);
  assert.equal(new Set(T.catalog.map(s => s.id)).size, 25);
  assert.equal(new Set(T.catalog.map(s => s.skill.name)).size, 25);
  const effects = T.catalog.map(s => {
    const {name, description, style, color, ...mechanics} = s.skill;
    return JSON.stringify(mechanics);
  });
  assert.equal(new Set(effects).size, 25);
  for (let stars = 1; stars <= 5; stars++) {
    const group = T.catalog.filter(s => s.stars === stars);
    assert.equal(group.length, 5);
    assert.deepEqual(group.map(s => s.cell), [0, 1, 2, 3, 4]);
    assert.ok(group.every(s => s.sheet === `assets/tides/tides-${stars}.png` && s.columns === 3 && s.rows === 2));
  }
  const total = T.catalog.reduce((sum, s) => sum + s.encounterWeight, 0);
  const spectral = T.catalog.filter(s => s.spectral);
  assert.equal(spectral.length, 2);
  assert.ok(spectral.every(s => s.stars === 5));
  assert.ok(Math.abs(spectral.reduce((sum, s) => sum + s.encounterWeight, 0) / total - 0.0004) < 1e-10);
  for (const species of T.catalog) {
    assert.ok(['melee', 'magic'].includes(species.skill.style));
    assert.ok(['melee', 'magic'].includes(species.attack.style));
    assert.match(species.skill.color, /^#[0-9a-f]{6}$/i);
    assert.ok(species.attack.name && species.skill.description);
  }
});

test('the permanent lasso costs exactly 10000 gold once and includes a random level-one common starter', () => {
  for (const gold of [0, 9999, NaN, Infinity]) {
    const c = T.createCollection(), before = clone(c);
    const failed = T.purchaseLasso(c, gold, {rng: () => { throw Error('no roll before payment'); }});
    assert.equal(failed.ok, false); assert.equal(failed.reason, 'gold'); assert.deepEqual(c, before);
  }
  const starters = new Set();
  for (let i = 0; i < 5; i++) {
    const c = T.createCollection();
    const paid = T.purchaseLasso(c, 12345, {rng: () => (i + 0.5) / 5, now: 100});
    assert.equal(paid.gold, 2345); assert.equal(paid.starter.level, 1);
    assert.equal(T.getSpecies(paid.starter).stars, 1); assert.equal(c.equippedId, paid.starter.id);
    starters.add(paid.starter.speciesId);
    const before = clone(c);
    const duplicate = T.purchaseLasso(c, paid.gold, {rng: () => { throw Error('purchase cannot reroll'); }});
    assert.equal(duplicate.reason, 'owned'); assert.equal(duplicate.gold, 2345); assert.deepEqual(c, before);
  }
  assert.equal(starters.size, 5);
});

test('normalization repairs old data, clears previous injuries for playtesting and preserves duplicates, progression and exploration', () => {
  for (const raw of [null, undefined, [], 'bad', {}, {pets: 'bad'}]) assert.deepEqual(T.normalizeCollection(raw, 10), T.createCollection());
  const raw = {lassoOwned: false, pets: [
    {id: 'tide-7', speciesId: 'meadowmouse', level: 3, xp: 17, injuredUntil: 500},
    {id: 'tide-7', speciesId: 'meadowmouse', level: 99, xp: 999},
    {speciesId: 'unknown'}, {id: 'custom', speciesId: 'moonowl', level: 0, xp: -2}
  ], equippedId: 'tide-7', exploration: {distance: 17, encounters: [{id: 'wild-1', speciesId: 'moonowl'}]}};
  const before = clone(raw), c = T.normalizeCollection(raw, 20);
  assert.deepEqual(raw, before); assert.equal(c.pets.length, 3); assert.equal(new Set(c.pets.map(p => p.id)).size, 3);
  assert.equal(c.lassoOwned, true); assert.equal(T.equipped(c).xp, 17); assert.equal(T.equipped(c).injuredUntil, 0);
  assert.equal(c.pets[1].level, 20); assert.equal(c.pets[1].xp, 0); assert.equal(c.pets[2].level, 1);
  assert.deepEqual(c.exploration, raw.exploration); assert.notEqual(c.exploration, raw.exploration);
  assert.deepEqual(T.normalizeCollection(clone(c), 20), c);
});

test('only the equipped Tide earns small world XP, old injuries do not block playtesting and duplicate deaths do not award again', () => {
  const c = collection(), pet = T.equipped(c);
  c.pets.push({...pet, id: 'reserve'});
  assert.equal(T.awardWorldXp(c, {now: 2000, eventId: 'mob-1'}).xp, 2);
  assert.equal(T.awardWorldXp(c, {now: 2000, eventId: 'mob-1'}).reason, 'duplicate');
  assert.equal(pet.xp, 2); assert.equal(c.pets[1].xp, 0);
  for (let i = 0; i < 17; i++) T.awardWorldXp(c, {now: 2000, eventId: 'mob-' + (i + 2)});
  assert.equal(pet.level, 2); assert.equal(pet.xp, 0);
  assert.equal(T.equip(c, 'reserve', 2000).ok, true);
  T.awardWorldXp(c, {now: 2000}); assert.equal(c.pets[1].xp, 2); assert.equal(pet.xp, 0);
  c.pets[1].injuredUntil = 5000;
  assert.equal(T.remainingInjury(c.pets[1], 2000), 0);
  assert.equal(T.equip(c, 'reserve', 2000).injured, false);
  assert.equal(T.awardWorldXp(c, {now: 4999}).ok, true);
  assert.equal(T.awardWorldXp(c, {now: 5000}).ok, true);
  c.pets[1].level = 20; c.pets[1].xp = 0;
  T.awardWorldXp(c, {now: 5000}); assert.equal(c.pets[1].level, 20); assert.equal(c.pets[1].xp, 0);
});

test('invalid actions and cooling powers are inert; legal rounds expose both sides and deterministic persisted RNG', () => {
  const c = collection('pebbletoad', 10), battle = begin(c, 'obsidianbear', 10);
  const before = clone(battle);
  assert.equal(T.act(battle, 'invalid').reason, 'action'); assert.deepEqual(battle, before);
  const round = T.act(battle, 'power');
  assert.ok(round.events.some(e => e.type === 'power' && e.side === 'player'));
  assert.ok(round.events.some(e => e.side === 'foe'));
  assert.ok(round.events.some(e => e.type === 'shield' && e.amount > 0));
  assert.equal(battle.player.powerCooldown, 2);
  const cooling = clone(battle);
  assert.equal(T.act(battle, 'power').reason, 'cooldown'); assert.deepEqual(battle, cooling);
  const replay = clone(battle);
  assert.deepEqual(T.act(battle, 'attack'), T.act(replay, 'attack')); assert.deepEqual(battle, replay);
  T.act(battle, 'attack'); assert.equal(battle.player.powerCooldown, 0);
  assert.equal(T.equip(c, c.equippedId).reason, 'battle');
  assert.equal(T.awardWorldXp(c, {now: 2000}).reason, 'injured');
  assert.equal(T.finishBattle(c, battle, {now: 2000}).reason, 'unfinished');
});

test('a victory captures each encounter once, grants substantial XP, and stale results cannot settle a subsequent battle', () => {
  const c = collection('meadowmouse', 10), pet = T.equipped(c), originalId = pet.id;
  const battle = begin(c);
  assert.equal(pet.injuredUntil, 0);
  assert.equal(play(battle), 'win');
  const stale = clone(battle), result = T.finishBattle(c, battle, {now: 3000});
  assert.equal(result.ok, true); assert.equal(result.captured.speciesId, 'meadowmouse');
  assert.equal(result.captured.level, 1); assert.notEqual(result.captured.id, originalId);
  assert.ok(result.xp >= 40); assert.equal(pet.injuredUntil, 0); assert.equal(c.equippedId, originalId);
  assert.equal(T.finishBattle(c, battle, {now: 4000}).reason, 'settled');
  const newBattle = begin(c, 'spectralwyrm', 20, 0.5, 5000), deadline = pet.injuredUntil;
  assert.equal(T.finishBattle(c, stale, {now: 6000}).reason, 'settled');
  assert.equal(pet.injuredUntil, deadline); assert.equal(c.activeBattle.id, newBattle.id);
  assert.equal(c.pets.length, 2);
});

test('storage accepts repeated captures as independent creatures without a party capacity', () => {
  const c = collection('meadowmouse', 20);
  for (let i = 0; i < 160; i++) {
    const battle = begin(c, 'meadowmouse', 1, (i + 1) / 200, 3000 + i);
    assert.equal(play(battle), 'win'); assert.equal(T.finishBattle(c, battle, {now: 4000 + i}).ok, true);
  }
  assert.equal(c.pets.length, 161); assert.equal(new Set(c.pets.map(p => p.id)).size, 161);
  c.pets[1].xp = 9; c.pets[1].injuredUntil = 9000;
  assert.equal(c.pets[2].xp, 0); assert.equal(c.pets[2].injuredUntil, 0);
  const restored = T.normalizeCollection(clone(c), 6000);
  assert.equal(restored.pets.length, 161); assert.deepEqual(restored.pets, c.pets.map(pet=>({...pet,injuredUntil:0})));
});

test('defeat and abandonment allow immediate reuse during playtesting while duplicate settlement remains inert', () => {
  assert.equal(T.INJURY_MS, 0);
  const c = collection(), battle = begin(c, 'spectralwyrm', 20, 0.2, 10000), pet = T.equipped(c);
  assert.equal(play(battle), 'loss');
  const result = T.finishBattle(c, battle, {now: 12000});
  assert.equal(result.outcome, 'loss'); assert.equal(c.pets.length, 1); assert.equal(pet.xp, 0);
  assert.equal(pet.injuredUntil, 0);
  const settled = clone(c);
  assert.equal(T.finishBattle(c, battle, {now: 20000}).reason, 'settled');
  assert.deepEqual(c, settled);
  const next = begin(c, 'meadowmouse', 1, 0.3, 12000);
  assert.equal(T.abandonBattle(c, next, {now: 12000}).outcome, 'loss');
  assert.equal(pet.injuredUntil, 0); assert.equal(pet.xp, 0); assert.equal(c.pets.length, 1);
  const loaded = T.normalizeCollection(clone(c), 12000);
  assert.equal(T.remainingInjury(T.equipped(loaded), 12000), 0);
  const fresh = begin(loaded, 'meadowmouse', 1, 0.3, 12000), beforeDuplicate = clone(loaded);
  assert.equal(T.abandonBattle(loaded, next, {now: 999999999}).reason, 'settled');
  assert.deepEqual(loaded, beforeDuplicate); assert.equal(loaded.activeBattle.id, fresh.id);
});

test('reloading an unfinished fight abandons it without rewards or injury and allows a new fight immediately', () => {
  const c = collection(), battle = begin(c, 'spectralpanther', 1, 0.2, 10000);
  assert.equal(T.beginBattle(c, {speciesId: 'meadowmouse', level: 1}, {now: 10001}).reason, 'battle');
  c.pets[0].injuredUntil = 10000 + 2 * 60 * 60 * 1000; // An unfinished fight saved before playtesting.
  const loaded = T.normalizeCollection(clone(c), 11000);
  assert.equal(loaded.activeBattle, null); assert.equal(T.equipped(loaded).injuredUntil, 0);
  assert.equal(T.finishBattle(loaded, battle, {now: 12000}).reason, 'settled');
  assert.equal(loaded.pets.length, 1); assert.equal(T.equipped(loaded).xp, 0);
  const secondLoad = T.normalizeCollection(clone(loaded), 11000);
  assert.equal(T.equipped(secondLoad).injuredUntil, 0);
  assert.equal(T.awardWorldXp(secondLoad, {now: 11000}).ok, true);
  const fresh = begin(secondLoad, 'meadowmouse', 1, 0.3, 11000);
  assert.notEqual(fresh.id, battle.id);
  const before = clone(secondLoad);
  assert.equal(T.finishBattle(secondLoad, battle, {now: 11000}).reason, 'settled');
  assert.deepEqual(secondLoad, before);
});

test('an old in-memory injury cannot block a new battle and defeat text promises no waiting during playtesting', () => {
  const c = collection();
  T.equipped(c).injuredUntil = 10000 + 2 * 60 * 60 * 1000;
  const battle = begin(c, 'spectralwyrm', 20, 0.2, 10000);
  assert.equal(T.equipped(c).injuredUntil, 0);
  battle.player.hp = 1;
  const result = T.act(battle, 'attack');
  assert.equal(result.outcome, 'loss');
  assert.match(result.events.find(event=>event.type==='result').text, /ready to battle again/);
  assert.equal(result.events.some(event=>/hours|rest/.test(event.text)), false);
});

test('deterministic matchups keep all powers finite, every starter viable, and five-star companions beatable at equal level', () => {
  for (const level of [1, 10, 20]) {
    const wins = Array(25).fill(0), losses = Array(25).fill(0), commonWins = Array(5).fill(0);
    for (let i = 0; i < 25; i++) for (let j = 0; j < 25; j++) for (let sample = 0; sample < 12; sample++) {
      const seed = ((123456789 + sample * 768371 + i * 18221 + j * 392887) >>> 0) / 4294967296;
      const battle = begin(collection(T.catalog[i].id, level), T.catalog[j].id, level, seed);
      const outcome = play(battle);
      if (outcome === 'win') { wins[i]++; if (i < 5 && j < 5) commonWins[i]++; }
      else losses[i]++;
    }
    for (let i = 0; i < 25; i++) {
      assert.ok(wins[i] > 0, `${T.catalog[i].id} can win at level ${level}`);
      assert.ok(losses[i] > 0, `${T.catalog[i].id} is not invincible at level ${level}`);
    }
    for (let i = 0; i < 5; i++) assert.ok(commonWins[i] >= 24, `${T.catalog[i].id} wins at least 40% of common fights at level ${level}`);
  }
});

test('catalog and core also load in a browser without CommonJS', () => {
  const context = vm.createContext({});
  for (const file of ['catalog.js', 'core.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/tides', file), 'utf8'), context);
  assert.equal(context.TidesCatalog.length, 25); assert.equal(context.Tides.catalog, context.TidesCatalog);
  assert.equal(context.Tides.purchaseLasso(context.Tides.createCollection(), 10000, {rng: () => 0, now: 10}).ok, true);
});
