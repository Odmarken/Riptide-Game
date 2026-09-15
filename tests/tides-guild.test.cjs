const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const T = require('../assets/tides/core.js');
const G = require('../assets/tides/guild.js');
const clone = value => JSON.parse(JSON.stringify(value));
function collection(Tides = T, level = 12) {
  const c = Tides.createCollection();
  Tides.purchaseLasso(c, 10000, {rng: () => 0, now: 1000});
  c.pets[0].level = level; c.pets[0].xp = 13;
  c.pets.push({...clone(c.pets[0]), id: 'reserve', speciesId: 'pebbletoad'});
  return c;
}
function start(c = collection(), options = {}, Guild = G) {
  const result = Guild.start(c, {now: 2000, rng: () => .35, trainer: {name: 'Test trainer', sex: 'female'}, ...options});
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
}
function endRound(c, series, battle, outcome, Guild = G) {
  battle.outcome = outcome;
  const result = Guild.finishRound(c, series, battle, {now: 3000});
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
}
function enabledInjuries() {
  const context = vm.createContext({TidesCatalog: T.catalog});
  const dir = path.join(__dirname, '../assets/tides');
  const source = fs.readFileSync(path.join(dir, 'core.js'), 'utf8').replace('const INJURY_MS = 0;', 'const INJURY_MS = 2 * 60 * 60 * 1000;');
  vm.runInContext(source, context);
  vm.runInContext(fs.readFileSync(path.join(dir, 'guild.js'), 'utf8'), context);
  return {Tides: context.Tides, Guild: context.TideGuild};
}

test('Guild rolls every original species uniformly and matches level even for low-level spectral opponents', () => {
  assert.equal(G.catalogOriginal.length, 25);
  assert.ok(G.catalogOriginal.every(s => !s.hybrid));
  for (const level of [1, 17, 30]) {
    const c = collection(T, level), seen = new Set();
    for (let index = 0; index < 25; index++) {
      const {series, battle} = start(c, {rng: () => (index + .5) / 25});
      seen.add(series.opponent.speciesId);
      assert.equal(series.opponent.speciesId, G.catalogOriginal[index].id);
      assert.equal(series.opponent.level, level);
      assert.equal(battle.player.level, level); assert.equal(battle.foe.level, level);
      assert.equal(battle.training, true); assert.equal(c.activeBattle.training, true);
      assert.equal(battle.mode, 'guild'); assert.equal(battle.guildSeriesId, series.id);
      assert.equal(G.abandon(c, series, battle).ok, true);
    }
    assert.equal(seen.size, 25);
  }
});

test('Guild accepts an equipped hybrid and keeps all its mutations and combined power', () => {
  const c = collection(), pet = T.equipped(c);
  pet.speciesId = T.getHybrid('bramblebunny', 'obsidianbear').id;
  pet.mutations = {hp: 2, attack: 2, power: 2, sixStar: true};
  const {battle} = start(c);
  assert.equal(battle.player.speciesId, pet.speciesId);
  assert.equal(battle.player.stars, 6);
  assert.equal(battle.player.atk, T.stats(pet).atk);
  assert.equal(battle.player.maxHp, T.stats(pet).maxHp);
  assert.equal(T.getSkill(battle.player).parentNames.length, 2);
  assert.equal(T.act(battle, 'power').ok, true);
});

test('Guild checks lasso, equipped pet, active fights, injuries and breeding without leaving a stuck series', () => {
  assert.equal(G.start(T.createCollection()).reason, 'lasso');
  const c = collection(); c.equippedId = 'missing';
  assert.equal(G.start(c).reason, 'equipped'); assert.equal(c.guildSeries, null);
  c.equippedId = c.pets[0].id;
  c.breedingJobs.push({parentAId: c.equippedId});
  assert.equal(G.start(c).reason, 'breeding'); assert.equal(c.guildSeries, null);
  c.breedingJobs = [];
  const wild = T.beginBattle(c, {speciesId: 'meadowmouse', level: 12}).battle;
  assert.equal(G.start(c).reason, 'battle'); assert.equal(c.activeBattle.id, wild.id);
  const {Tides, Guild} = enabledInjuries(), injured = collection(Tides);
  injured.pets[0].injuredUntil = 5000;
  assert.equal(Guild.start(injured, {now: 4000}).reason, 'injured');
  assert.equal(injured.guildSeries, null); assert.equal(injured.activeBattle, null);
});

test('best of three is first to two wins, including split 2–1 series, and cannot play a fourth round', () => {
  for (const outcomes of [['win', 'win'], ['win', 'loss', 'win'], ['loss', 'win', 'win'],
    ['loss', 'loss'], ['loss', 'win', 'loss'], ['win', 'loss', 'loss']]) {
    const c = collection(), pets = clone(c.pets), initial = start(c), series = initial.series;
    let battle = initial.battle;
    for (let i = 0; i < outcomes.length; i++) {
      assert.equal(series.round, i + 1);
      const result = endRound(c, series, battle, outcomes[i]);
      assert.equal(result.finished, i === outcomes.length - 1);
      assert.equal(result.captured, null); assert.equal(result.xp, 0); assert.equal(result.levels, 0);
      if (!result.finished) {
        const next = G.nextRound(c, series, {now: 5000 + i});
        assert.equal(next.ok, true); battle = next.battle;
      }
    }
    assert.deepEqual(series.score, {player: outcomes.filter(o => o === 'win').length, foe: outcomes.filter(o => o === 'loss').length});
    assert.equal(series.outcome, series.score.player === 2 ? 'win' : 'loss');
    assert.equal(series.status, 'finished'); assert.equal(c.guildSeries, null); assert.equal(c.activeBattle, null);
    assert.equal(G.nextRound(c, series).reason, 'settled');
    assert.equal(G.finishRound(c, series, battle).reason, 'settled');
    assert.deepEqual(c.pets, pets);
  }
});

test('each next round restores full HP and resets all combat effects while retaining the trainer and opponent', () => {
  const c = collection(), trainer = {name: 'Guild ranger', sex: 'female', loadout: {weapon: 'legendary', enchant: 'ice'}};
  const {series, battle} = start(c, {trainer});
  const originalTrainer = clone(trainer), originalOpponent = clone(series.opponent);
  trainer.loadout.weapon = 'changed';
  for (const unit of [battle.player, battle.foe]) Object.assign(unit, {hp: 1, shield: 35, powerCooldown: 3,
    buff: .5, buffTurns: 2, weaken: .3, weakenTurns: 1, poison: 20, poisonTurns: 3});
  endRound(c, series, battle, 'win');
  const next = G.nextRound(c, series, {rng: () => .9999, now: 6000});
  assert.equal(next.ok, true); assert.notEqual(next.battle.id, battle.id);
  assert.deepEqual(series.trainer, originalTrainer); assert.deepEqual(series.opponent, originalOpponent);
  assert.equal(next.battle.foe.speciesId, originalOpponent.speciesId);
  for (const unit of [next.battle.player, next.battle.foe]) {
    assert.equal(unit.hp, unit.maxHp);
    for (const key of ['shield', 'powerCooldown', 'buff', 'buffTurns', 'weaken', 'weakenTurns', 'poison', 'poisonTurns']) assert.equal(unit[key], 0, key);
  }
});

test('the equipped Tide stays locked between rounds and cannot gain XP, start wild battles, or breed', () => {
  const c = collection(), {series, battle} = start(c);
  assert.equal(T.equip(c, 'reserve').reason, 'battle');
  endRound(c, series, battle, 'win');
  assert.equal(T.equip(c, 'reserve').reason, 'battle');
  assert.equal(T.awardWorldXp(c, {amount: 5}).ok, false);
  assert.equal(T.beginBattle(c, {speciesId: 'meadowmouse', level: 12}).reason, 'battle');
  assert.equal(T.startBreeding(c, {stationId: 'station-1', parentAId: c.pets[0].id, parentBId: 'reserve'}).reason, 'battle');
  assert.equal(G.start(c).reason, 'battle');
  assert.equal(G.abandon(c, series, battle).ok, true);
  assert.equal(T.equip(c, 'reserve').ok, true);
  assert.equal(T.awardWorldXp(c).ok, true);
});

test('changing equipped pet or level externally cannot swap a team between rounds', () => {
  for (const change of [c => { c.equippedId = 'reserve'; }, c => { c.pets[0].level++; }]) {
    const c = collection(), {series, battle} = start(c);
    endRound(c, series, battle, 'win'); change(c);
    assert.equal(G.nextRound(c, series).reason, 'equipped');
    assert.equal(c.activeBattle, null); assert.equal(series.round, 1);
    assert.equal(G.abandon(c, series, battle).ok, true);
  }
});

test('core settlement uses authoritative training metadata and never captures or rewards a Guild opponent', () => {
  for (const outcome of ['win', 'loss']) {
    const c = collection(), pets = clone(c.pets), {battle} = start(c);
    delete battle.training; delete battle.mode; battle.outcome = outcome;
    const result = T.finishBattle(c, battle, {now: 9000});
    assert.equal(result.ok, true); assert.equal(result.training, true);
    assert.equal(result.captured, null); assert.equal(result.xp, 0); assert.equal(result.levels, 0);
    assert.deepEqual(c.pets, pets);
  }
});

test('Guild never imposes injuries even when the original two-hour injury rule is restored', () => {
  const {Tides, Guild} = enabledInjuries();
  assert.equal(Tides.INJURY_MS, 7200000);
  for (const outcome of ['win', 'loss', 'abandon', 'reload']) {
    const c = collection(Tides), {series, battle} = start(c, {}, Guild);
    assert.equal(c.pets[0].injuredUntil, 0);
    if (outcome === 'abandon') assert.equal(Guild.abandon(c, series, battle).ok, true);
    else if (outcome === 'reload') {
      const loaded = Tides.normalizeCollection(clone(c), 5000);
      assert.equal(loaded.pets[0].injuredUntil, 0); assert.equal(loaded.guildSeries, null); assert.equal(loaded.activeBattle, null);
    } else endRound(c, series, battle, outcome, Guild);
    assert.equal(c.pets[0].injuredUntil, 0);
  }
  const wild = collection(Tides);
  Tides.beginBattle(wild, {speciesId: 'meadowmouse', level: 12}, {now: 2000});
  assert.equal(wild.pets[0].injuredUntil, 7202000);
  assert.equal(Tides.normalizeCollection(clone(wild), 5000).pets[0].injuredUntil, 7202000);
});

test('reloading a round or intermission retires training without rewards, capture or locking the pet', () => {
  for (const between of [false, true]) {
    const c = collection(), pets = clone(c.pets), {series, battle} = start(c);
    if (between) endRound(c, series, battle, 'win');
    const loaded = T.normalizeCollection(clone(c), 10000);
    assert.equal(loaded.guildSeries, null); assert.equal(loaded.activeBattle, null); assert.deepEqual(loaded.pets, pets);
    assert.equal(T.equip(loaded, 'reserve').ok, true);
    assert.equal(G.finishRound(loaded, series, battle).reason, 'settled');
    assert.equal(G.start(loaded).ok, true);
  }
});

test('stale round results and duplicate abandonment cannot settle a later round or series', () => {
  const c = collection(), first = start(c);
  endRound(c, first.series, first.battle, 'win');
  const second = G.nextRound(c, first.series);
  assert.equal(G.finishRound(c, first.series, first.battle).reason, 'settled');
  assert.equal(G.abandon(c, first.series, first.battle).reason, 'battle');
  assert.equal(c.activeBattle.id, second.battle.id);
  assert.equal(G.abandon(c, first.series, second.battle).ok, true);
  assert.equal(G.abandon(c, first.series, second.battle).reason, 'settled');
  const nextSeries = start(c, {trainer: {name: 'Next opponent'}, rng: () => .99});
  assert.notEqual(nextSeries.series.id, first.series.id);
  assert.notEqual(nextSeries.series.opponent.speciesId, first.series.opponent.speciesId);
  assert.equal(nextSeries.series.trainer.name, 'Next opponent');
  assert.equal(G.finishRound(c, first.series, second.battle).reason, 'settled');
  assert.equal(c.activeBattle.id, nextSeries.battle.id);
});

test('all original opponents fight through the existing attack rules and emit round results without capture text', () => {
  for (let index = 0; index < 25; index++) {
    const c = collection(), {series, battle} = start(c, {rng: () => (index + .5) / 25});
    let turns = 0, events;
    while (!battle.outcome) {
      const result = T.act(battle, battle.player.powerCooldown > 0 ? 'attack' : 'power');
      assert.equal(result.ok, true); assert.ok(++turns <= 60);
      events = result.events;
    }
    assert.ok(events.some(e => e.type === 'result' && /^Round (won|lost)!?\.?$/.test(e.text)));
    assert.ok(events.every(e => !/captur|hours of rest/i.test(e.text)));
    assert.equal(G.finishRound(c, series, battle).ok, true);
  }
});
